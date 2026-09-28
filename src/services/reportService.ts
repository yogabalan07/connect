import { Report, ReportReason, User } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceResult, fail, ok } from '../lib/errors';
import { mapFirestoreError } from './firestoreErrors';
import { doubtService } from './doubtService';
import { answerService } from './answerService';
import { adminService } from './adminService';
import { catalogService } from './catalogService';
import { getModerationAdapter } from './moderationAdapter';

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
 * Moderation service: the report queue, closures and academic warnings.
 *
 * Everything is persisted through `ModerationAdapter` (`reports`,
 * `warnings`, `auditLogs`). The rules make the document id itself the
 * duplicate guard - `{targetType}_{targetId}_{reporterId}` - so re-reporting
 * the same content fails as `moderation/duplicate` rather than creating a
 * second row, and only a moderator may read the queue or move a case.
 *
 * UI never writes reports directly: it always goes through these methods so
 * validation, the audit entry and the store stay in lock-step with the
 * document that Firestore actually accepted.
 */
export const reportService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, reports: [], status: 'loading' }));
  },

  /** Reads the queue once per admin session (moderator-only in the rules). */
  async loadAll(): Promise<void> {
    try {
      const reports = await getModerationAdapter().listReports();
      store.set(prev => ({ ...prev, reports, status: 'ready' }));
    } catch (error) {
      store.set(prev => ({ ...prev, status: 'error' }));
      throw mapFirestoreError(error);
    }
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

    try {
      const created = await getModerationAdapter().createReport({
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        reporterId: input.reporter.id,
        reporterName: input.reporter.name,
        reportedUserId: input.reportedUserId,
        reportedUserName: input.reportedUserName,
        reason: input.reason,
        description
      });
      store.set(prev => ({ ...prev, reports: [created, ...prev.reports] }));
      return ok(created);
    } catch (error) {
      const mapped = mapFirestoreError(error);
      if (mapped.code.endsWith('/duplicate')) {
        return fail('You already reported this content. Moderators are reviewing it.');
      }
      return fail(mapped.message);
    }
  },

  /** Closes a case without action. Moderator-only, recorded on the trail. */
  async dismissReport(reportId: string, moderator: User): Promise<ServiceResult<Report>> {
    try {
      const updated = await getModerationAdapter().resolveReport(reportId, {
        status: 'dismissed',
        resolutionNote: 'Dismissed as a false positive.',
        resolvedById: moderator.id
      });
      store.set(prev => ({
        ...prev,
        reports: prev.reports.map(r => (r.id === reportId ? updated : r))
      }));
      await adminService.logAuditSafely({
        actor: moderator,
        action: 'Dismissed report',
        target: reportId,
        type: 'moderation'
      });
      return ok(updated);
    } catch (error) {
      return fail(mapFirestoreError(error).message);
    }
  },

  /** Closes a case with action. Moderator-only, recorded on the trail. */
  async resolveReport(
    reportId: string,
    actionTaken: string,
    moderator: User
  ): Promise<ServiceResult<Report>> {
    try {
      const updated = await getModerationAdapter().resolveReport(reportId, {
        status: 'resolved',
        resolutionNote: actionTaken,
        resolvedById: moderator.id
      });
      store.set(prev => ({
        ...prev,
        reports: prev.reports.map(r => (r.id === reportId ? updated : r))
      }));
      await adminService.logAuditSafely({
        actor: moderator,
        action: `Resolved report: ${actionTaken}`,
        target: reportId,
        type: 'moderation'
      });
      return ok(updated);
    } catch (error) {
      return fail(mapFirestoreError(error).message);
    }
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

      const updated = await getModerationAdapter().resolveReport(reportId, {
        status: 'resolved',
        resolutionNote: `Removed reported ${report.targetType}`,
        resolvedById: moderator.id
      });
      store.set(prev => ({
        ...prev,
        reports: prev.reports.map(r => (r.id === reportId ? updated : r))
      }));

      await adminService.logAuditSafely({
        actor: moderator,
        action: `Removed reported ${report.targetType}`,
        target: report.targetTitle,
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

    try {
      await adminService.createWarning(moderator, userId, userName, trimmed);
      await adminService.logAuditSafely({
        actor: moderator,
        action: 'Issued academic warning',
        target: userName,
        type: 'moderation'
      });
      return ok(undefined);
    } catch (error) {
      return fail(mapFirestoreError(error).message);
    }
  }
};

export function useReportsStore(): ReportState {
  return useStore(store);
}
