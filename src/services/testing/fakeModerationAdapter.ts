import { ServiceError } from '../../lib/errors';
import { relativeTime } from '../../lib/time';
import type {
  AdminSettings,
  Announcement,
  AuditLog,
  Report,
  ReportReason,
  Warning
} from '../../types';
import type {
  AnnouncementDraft,
  AuditLogDraft,
  ModerationAdapter,
  ReportDraft,
  ReportResolution,
  WarningDraft
} from '../moderationAdapter';
import { reportIdFor } from '../moderationAdapter';

/**
 * In-memory `ModerationAdapter` double.
 *
 * Mirrors the Firestore adapter's contract exactly - the deterministic
 * `{targetType}_{targetId}_{reporterId}` report id (and the
 * `moderation/duplicate` refusal it produces), append-only audit rows,
 * moderator-only closures and the `adminSettings/singleton` document - so
 * `reportService` and `adminService` run hermetically in tests with no
 * project, no network and no `.env.local`.
 *
 * Inject with `setModerationAdapter(createFakeModerationAdapter())` and
 * restore with `setModerationAdapter(null)`.
 */
export interface FakeModerationAdapter extends ModerationAdapter {
  seedReports(reports: Report[]): void;
  seedAnnouncements(list: Announcement[]): void;
  seedAuditLogs(list: AuditLog[]): void;
  seedWarnings(list: Warning[]): void;
  /** Raw documents, newest first, as the admin queue sees them. */
  reportRecords(): Report[];
  auditRecords(): AuditLog[];
  warningRecords(): Warning[];
  announcementRecords(): Announcement[];
  settingsRecord(): AdminSettings | null;
  /**
   * Simulates the rules refusing every read/write (`permission-denied`),
   * so the services' error path is exercised without a project.
   */
  setDenied(denied: boolean): void;
  clear(): void;
  readonly calls: Record<string, number>;
}

/** The copy `firestoreErrors` maps `permission-denied` to. */
export const DENIED_COPY =
  'You do not have permission to do that. Contact your department administrator.';

function denied(): ServiceError {
  return new ServiceError('firestore/permission-denied', DENIED_COPY);
}

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function createFakeModerationAdapter(): FakeModerationAdapter {
  const reports = new Map<string, Report>();
  const announcements = new Map<string, Announcement>();
  const auditLogs = new Map<string, AuditLog>();
  const warnings = new Map<string, Warning>();
  let settings: AdminSettings | null = null;
  let deniedMode = false;
  const calls: Record<string, number> = {};

  const count = (name: string): void => {
    calls[name] = (calls[name] ?? 0) + 1;
  };

  const guard = (): void => {
    if (deniedMode) throw denied();
  };

  const newestFirst = <T extends { createdAtMs: number }>(list: T[]): T[] =>
    list.slice().sort((a, b) => b.createdAtMs - a.createdAtMs);

  const adapter: FakeModerationAdapter = {
    calls,

    clear(): void {
      reports.clear();
      announcements.clear();
      auditLogs.clear();
      warnings.clear();
      settings = null;
      deniedMode = false;
    },

    setDenied(denied: boolean): void {
      deniedMode = denied;
    },

    seedReports(list: Report[]): void {
      list.forEach(report => reports.set(report.id, { ...report }));
    },
    seedAnnouncements(list: Announcement[]): void {
      list.forEach(item => announcements.set(item.id, { ...item }));
    },
    seedAuditLogs(list: AuditLog[]): void {
      list.forEach(item => auditLogs.set(item.id, { ...item }));
    },
    seedWarnings(list: Warning[]): void {
      list.forEach(item => warnings.set(item.id, { ...item }));
    },

    reportRecords(): Report[] {
      return newestFirst(Array.from(reports.values())).map(item => ({ ...item }));
    },
    auditRecords(): AuditLog[] {
      return newestFirst(Array.from(auditLogs.values())).map(item => ({ ...item }));
    },
    warningRecords(): Warning[] {
      return newestFirst(Array.from(warnings.values())).map(item => ({ ...item }));
    },
    announcementRecords(): Announcement[] {
      return newestFirst(Array.from(announcements.values())).map(item => ({ ...item }));
    },
    settingsRecord(): AdminSettings | null {
      return settings ? { ...settings } : null;
    },

    async listReports(): Promise<Report[]> {
      count('listReports');
      guard();
      return adapter.reportRecords();
    },

    async createReport(draft: ReportDraft): Promise<Report> {
      count('createReport');
      guard();
      const id = reportIdFor(draft);
      if (reports.has(id)) {
        throw new ServiceError('moderation/duplicate', 'You have already reported this content.');
      }
      const created: Report = {
        id,
        targetType: draft.targetType,
        targetId: draft.targetId,
        targetTitle: draft.targetTitle,
        reporterId: draft.reporterId,
        reporterName: draft.reporterName,
        reportedUserId: draft.reportedUserId,
        reportedUserName: draft.reportedUserName,
        reason: draft.reason,
        description: draft.description,
        status: 'pending',
        createdAtMs: Date.now()
      };
      reports.set(id, created);
      return { ...created };
    },

    async resolveReport(reportId: string, resolution: ReportResolution): Promise<Report> {
      count('resolveReport');
      guard();
      const existing = reports.get(reportId);
      if (!existing) {
        throw new ServiceError('moderation/not-found', 'That report no longer exists.');
      }
      const reopening = resolution.status === 'pending';
      const updated: Report = {
        ...existing,
        status: resolution.status,
        // Never cleared on reopen: `firestore.rules` rewrites it to
        // `request.auth.uid` on every update.
        resolvedById: resolution.resolvedById,
        resolvedAtMs: reopening ? 0 : Date.now(),
        resolutionNote: reopening ? '' : (resolution.resolutionNote ?? '').slice(0, 500)
      };
      reports.set(reportId, updated);
      return { ...updated };
    },

    async deleteReport(reportId: string): Promise<void> {
      count('deleteReport');
      guard();
      reports.delete(reportId);
    },

    async listAnnouncements(): Promise<Announcement[]> {
      count('listAnnouncements');
      guard();
      return adapter.announcementRecords();
    },

    async createAnnouncement(draft: AnnouncementDraft): Promise<Announcement> {
      count('createAnnouncement');
      guard();
      if (!draft.title.trim() || !draft.content.trim()) {
        throw new ServiceError('announcement/invalid', 'Announcement title and body are required.');
      }
      const createdAtMs = Date.now();
      const created: Announcement = {
        id: nextId('ann'),
        title: draft.title,
        content: draft.content,
        priority: draft.priority,
        targetAudience: draft.targetAudience,
        authorId: draft.authorId,
        authorName: draft.authorName,
        createdAtMs,
        createdAt: relativeTime(createdAtMs),
        isActive: true
      };
      announcements.set(created.id, created);
      return { ...created };
    },

    async listAuditLogs(limit = 200): Promise<AuditLog[]> {
      count('listAuditLogs');
      guard();
      return adapter.auditRecords().slice(0, limit);
    },

    async createAuditLog(draft: AuditLogDraft): Promise<AuditLog> {
      count('createAuditLog');
      guard();
      const createdAtMs = Date.now();
      const created: AuditLog = {
        id: nextId('log'),
        actorId: draft.actorId,
        actor: draft.actorName,
        action: draft.action,
        target: draft.target,
        createdAtMs,
        timestamp: relativeTime(createdAtMs),
        type: draft.type
      };
      auditLogs.set(created.id, created);
      return { ...created };
    },

    async listWarnings(): Promise<Warning[]> {
      count('listWarnings');
      guard();
      return adapter.warningRecords();
    },

    async createWarning(draft: WarningDraft): Promise<Warning> {
      count('createWarning');
      guard();
      const createdAtMs = Date.now();
      const created: Warning = {
        id: nextId('warn'),
        userId: draft.userId,
        userName: draft.userName,
        reason: draft.reason,
        issuedById: draft.issuedById,
        issuedByName: draft.issuedByName,
        createdAtMs,
        issuedAt: relativeTime(createdAtMs)
      };
      warnings.set(created.id, created);
      return { ...created };
    },

    async getAdminSettings(): Promise<AdminSettings | null> {
      count('getAdminSettings');
      guard();
      return adapter.settingsRecord();
    },

    async saveAdminSettings(patch: AdminSettings, actorId: string): Promise<AdminSettings> {
      count('saveAdminSettings');
      guard();
      settings = {
        requireFacultyApproval: patch.requireFacultyApproval,
        autoFlagSpamWords: patch.autoFlagSpamWords,
        allowedDomain: patch.allowedDomain,
        minRepToComment: patch.minRepToComment,
        updatedAtMs: Date.now(),
        updatedBy: actorId,
        updatedAt: 'Just now'
      };
      return { ...settings };
    }
  };

  return adapter;
}
