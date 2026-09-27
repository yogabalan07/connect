import { Report, ReportReason, User } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceResult, fail, ok } from '../lib/errors';
import { doubtService } from './doubtService';
import { answerService } from './answerService';
import { adminService } from './adminService';
import { catalogService } from './catalogService';

interface ReportState {
  reports: Report[];
  status: LoadStatus;
}

const store = createStore<ReportState>({ reports: [], status: 'loading' });

export const REPORT_REASONS: ReportReason[] = [
  'Spam',
  'Wrong information',
  'Abusive content',
  'Inappropriate content',
  'Harassment',
  'Duplicate question',
  'Other'
];

export interface CreateReportInput {
  targetType: Report['targetType'];
  targetId: string;
  targetTitle: string;
  reporter: User;
  reportedUserId: string;
  reportedUserName: string;
  reason: ReportReason;
  description: string;
}

/**
 * Moderation service. UI never writes reports directly — it always goes
 * through these methods so Cloud Functions can take over the same call sites.
 * Reports are kept in memory for this session only.
 */
export const reportService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  async createReport(input: CreateReportInput): Promise<ServiceResult<Report>> {
    if (!input.targetId || !input.targetType) {
      return fail('Missing report target.');
    }
    if (!input.reporter?.id) {
      return fail('You must be signed in to file a report.');
    }
    if (!REPORT_REASONS.includes(input.reason)) {
      return fail('Choose a valid reason for the report.');
    }

    const description = (input.description || '').trim();
    if (input.reason === 'Other' && description.length < 10) {
      return fail('Please describe the issue (at least 10 characters) when choosing "Other".');
    }
    if (description.length > 1000) {
      return fail('Report description must be 1000 characters or fewer.');
    }

    const created: Report = {
      id: `report-${Date.now()}`,
      targetType: input.targetType,
      targetId: input.targetId,
      targetTitle: input.targetTitle,
      reporterId: input.reporter.id,
      reporterName: input.reporter.name,
      reportedUserId: input.reportedUserId,
      reportedUserName: input.reportedUserName,
      reason: input.reason,
      description,
      status: 'pending',
      createdAt: 'Just now'
    };

    store.set(prev => ({ ...prev, reports: [created, ...prev.reports] }));
    return ok(created);
  },

  dismissReport(reportId: string): void {
    store.set(prev => ({
      ...prev,
      reports: prev.reports.map(r => (r.id === reportId ? { ...r, status: 'dismissed' as const } : r))
    }));
  },

  resolveReport(reportId: string, actionTaken: string): void {
    store.set(prev => ({
      ...prev,
      reports: prev.reports.map(r =>
        r.id === reportId ? { ...r, status: 'resolved' as const } : r
      )
    }));
    adminService.logAudit({
      actor: 'Moderation',
      action: `Resolved report: ${actionTaken}`,
      target: reportId,
      timestamp: 'Just now',
      type: 'moderation'
    });
  },

  /** Removes the reported content, then closes the report. */
  async deleteReportedContent(reportId: string, moderator: User): Promise<ServiceResult<void>> {
    const report = store.get().reports.find(r => r.id === reportId);
    if (!report) return fail('That report no longer exists.');

    try {
      if (report.targetType === 'doubt') {
        const doubt = doubtService.getById(report.targetId);
        if (doubt) {
          await doubtService.remove(doubt.id);
          answerService.removeForDoubt(doubt.id);
          await catalogService.adjustQuestionCount(doubt.category, -1);
        }
      } else if (report.targetType === 'answer') {
        const answer = answerService.getAll().find(a => a.id === report.targetId);
        if (answer) {
          // The adapter moves `answersCount` and `lastAnswerId` in the same
          // atomic write as the answer document itself.
          await answerService.remove(answer.id, moderator);
        }
      }

      store.set(prev => ({
        ...prev,
        reports: prev.reports.map(r =>
          r.id === reportId ? { ...r, status: 'resolved' as const } : r
        )
      }));

      adminService.logAudit({
        actor: moderator.name,
        action: `Removed reported ${report.targetType}`,
        target: report.targetTitle,
        timestamp: 'Just now',
        type: 'moderation'
      });

      return ok(undefined);
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not remove the reported content.');
    }
  },

  /** Official warning attached to a user record (kept for audit history). */
  async issueWarning(
    moderator: User,
    userId: string,
    userName: string,
    reason: string
  ): Promise<ServiceResult<void>> {
    const trimmed = (reason || '').trim();
    if (trimmed.length < 5) {
      return fail('Describe the warning in at least 5 characters.');
    }

    adminService.addWarning({
      userId,
      userName,
      reason: trimmed,
      issuedBy: moderator.name,
      issuedAt: 'Just now'
    });
    adminService.logAudit({
      actor: moderator.name,
      action: 'Issued academic warning',
      target: userName,
      timestamp: 'Just now',
      type: 'moderation'
    });

    return ok(undefined);
  }
};

export function useReportsStore(): ReportState {
  return useStore(store);
}
