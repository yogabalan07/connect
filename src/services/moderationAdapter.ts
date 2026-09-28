import type {
  AdminSettings,
  Announcement,
  AuditLog,
  Report,
  ReportReason,
  Warning
} from '../types';
import { firebaseModerationAdapter } from './firebaseModerationAdapter';

/**
 * Moderation-domain persistence contract.
 *
 * Layering: pages -> context/hooks -> domain services (reportService,
 * adminService) -> THIS interface -> `firebaseModerationAdapter` ->
 * Firebase SDK.
 *
 * Nothing above this line imports the Firebase SDK, and nothing here knows
 * about React. Tests substitute an in-memory double through
 * `setModerationAdapter`, so the whole moderation domain runs without a
 * project, without network access and without `.env.local`.
 *
 * Document identity (see `firestore.rules` for the enforced half):
 * - `reports/{targetType}_{targetId}_{reporterId}`  one case per member per target
 * - `announcements/{id}`                            admin-published notices
 * - `auditLogs/{id}`                                append-only trail
 * - `warnings/{id}`                                 moderator-issued warnings
 * - `adminSettings/singleton`                       the policy document
 */

/** Everything a member may claim when filing a report. */
export interface ReportDraft {
  targetType: Report['targetType'];
  targetId: string;
  targetTitle: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reason: ReportReason;
  description: string;
}

/**
 * The canonical report document id: `{targetType}_{targetId}_{reporterId}`.
 *
 * One member can only report a given target once - `firestore.rules`
 * rebuilds this exact string on create, so a duplicate write is refused by
 * the rules rather than by a read-then-write race.
 */
export function reportIdFor(draft: ReportDraft): string {
  return `${draft.targetType}_${draft.targetId}_${draft.reporterId}`;
}

/** A moderator closing (or reopening) a case. */
export interface ReportResolution {
  status: Report['status'];
  resolutionNote?: string;
  /**
   * The moderator deciding. `firestore.rules` pins this to
   * `request.auth.uid`, so passing anyone else's id is refused rather than
   * silently forging a decision.
   */
  resolvedById: string;
}

export interface AnnouncementDraft {
  title: string;
  content: string;
  priority: Announcement['priority'];
  targetAudience: Announcement['targetAudience'];
  authorId: string;
  authorName: string;
}

/** An audit row. `actorId` is always the authenticated caller. */
export interface AuditLogDraft {
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  type: AuditLog['type'];
}

export interface WarningDraft {
  userId: string;
  userName: string;
  reason: string;
  issuedById: string;
  issuedByName: string;
}

export interface ModerationAdapter {
  // ---------------------------------------------------------------- reports
  /** Every case, newest first. The rules open this to moderators only. */
  listReports(): Promise<Report[]>;
  /**
   * Files a case. The adapter derives the deterministic id, so a second
   * report of the same target by the same member fails with
   * `already-exists` instead of creating a duplicate row.
   */
  createReport(draft: ReportDraft): Promise<Report>;
  resolveReport(reportId: string, resolution: ReportResolution): Promise<Report>;
  deleteReport(reportId: string): Promise<void>;

  // ----------------------------------------------------------- announcements
  listAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(draft: AnnouncementDraft): Promise<Announcement>;

  // ------------------------------------------------------------- audit trail
  listAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(draft: AuditLogDraft): Promise<AuditLog>;

  // ---------------------------------------------------------------- warnings
  listWarnings(): Promise<Warning[]>;
  createWarning(draft: WarningDraft): Promise<Warning>;

  // ---------------------------------------------------------- admin settings
  /** `null` when nobody has saved a policy yet (callers use defaults). */
  getAdminSettings(): Promise<AdminSettings | null>;
  saveAdminSettings(settings: AdminSettings, actorId: string): Promise<AdminSettings>;
}

let overrideAdapter: ModerationAdapter | null = null;

/** The moderation backend the app runs against (Firebase unless overridden). */
export function getModerationAdapter(): ModerationAdapter {
  return overrideAdapter ?? firebaseModerationAdapter;
}

/**
 * Injection seam for tests and local tooling. Production code paths always
 * resolve to the Firebase adapter (`setModerationAdapter(null)` restores it).
 */
export function setModerationAdapter(adapter: ModerationAdapter | null): void {
  overrideAdapter = adapter;
}
