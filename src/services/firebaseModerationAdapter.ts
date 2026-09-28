import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../lib/firebase';
import { ServiceError } from '../lib/errors';
import { relativeTime } from '../lib/time';
import type {
  AdminSettings,
  Announcement,
  AuditLog,
  Report,
  ReportReason,
  Warning
} from '../types';
import type {
  AnnouncementDraft,
  AuditLogDraft,
  ModerationAdapter,
  ReportDraft,
  ReportResolution,
  WarningDraft
} from './moderationAdapter';
import { reportIdFor } from './moderationAdapter';

/**
 * Firestore moderation adapter - the production backend for the report
 * queue, the announcement broadcast, the audit trail, warnings and the
 * moderation policy document.
 *
 * Document layout (mirrored by `firestore.rules`):
 *
 *   reports/{targetType}_{targetId}_{reporterId}
 *   announcements/{id}
 *   auditLogs/{id}
 *   warnings/{id}
 *   adminSettings/singleton
 *
 * Every field written here is re-validated by `firestore.rules`; the
 * mapping below exists so the rules' failure copy is never the first line
 * of defence. Nothing in this module touches React or the stores.
 */
const REPORTS = 'reports';
const ANNOUNCEMENTS = 'announcements';
const AUDIT_LOGS = 'auditLogs';
const WARNINGS = 'warnings';
const ADMIN_SETTINGS = 'adminSettings';

/** Bounded page sizes: a moderation queue is a screen, not a data export. */
const MAX_LIST = 200;

function db() {
  return getFirebaseDb();
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function read(snapshot: { data(): DocumentData; id: string }): DocumentData {
  return snapshot.data();
}

function alreadyExists(what: string): ServiceError {
  return new ServiceError('moderation/duplicate', `You have already ${what}.`);
}

// ------------------------------------------------------------------ mapping

function toReport(snapshot: QueryDocumentSnapshot<DocumentData>): Report {
  const data = read(snapshot);
  return {
    id: snapshot.id,
    targetType: (data.targetType as Report['targetType']) ?? 'doubt',
    targetId: str(data.targetId),
    targetTitle: str(data.targetTitle),
    reporterId: str(data.reporterId),
    reporterName: str(data.reporterName),
    reportedUserId: str(data.reportedUserId),
    reportedUserName: str(data.reportedUserName),
    reason: (data.reason as ReportReason) ?? 'Spam',
    description: str(data.description),
    status: (data.status as Report['status']) ?? 'pending',
    createdAtMs: num(data.createdAtMs),
    resolvedAtMs: data.resolvedAtMs ? num(data.resolvedAtMs) : undefined,
    resolvedById: data.resolvedById ? str(data.resolvedById) : undefined,
    resolutionNote: data.resolutionNote ? str(data.resolutionNote) : undefined
  };
}

function toAnnouncement(snapshot: QueryDocumentSnapshot<DocumentData>): Announcement {
  const data = read(snapshot);
  const createdAtMs = num(data.createdAtMs);
  return {
    id: snapshot.id,
    title: str(data.title),
    content: str(data.content),
    priority: (data.priority as Announcement['priority']) ?? 'normal',
    targetAudience: (data.targetAudience as Announcement['targetAudience']) ?? 'all',
    authorId: str(data.authorId),
    authorName: str(data.authorName),
    createdAtMs,
    createdAt: relativeTime(createdAtMs),
    isActive: bool(data.isActive, true)
  };
}

function toAuditLog(snapshot: QueryDocumentSnapshot<DocumentData>): AuditLog {
  const data = read(snapshot);
  const createdAtMs = num(data.createdAtMs);
  return {
    id: snapshot.id,
    actorId: str(data.actorId),
    actor: str(data.actorName),
    action: str(data.action),
    target: str(data.target),
    createdAtMs,
    timestamp: relativeTime(createdAtMs),
    type: (data.type as AuditLog['type']) ?? 'system'
  };
}

function toWarning(snapshot: QueryDocumentSnapshot<DocumentData>): Warning {
  const data = read(snapshot);
  const createdAtMs = num(data.createdAtMs);
  return {
    id: snapshot.id,
    userId: str(data.userId),
    userName: str(data.userName),
    reason: str(data.reason),
    issuedById: str(data.issuedById),
    issuedByName: str(data.issuedByName),
    createdAtMs,
    issuedAt: relativeTime(createdAtMs)
  };
}

function toAdminSettings(snapshot: { data(): DocumentData; id: string }): AdminSettings {
  const data = read(snapshot);
  const updatedAtMs = data.updatedAtMs ? num(data.updatedAtMs) : undefined;
  return {
    requireFacultyApproval: bool(data.requireFacultyApproval, true),
    autoFlagSpamWords: bool(data.autoFlagSpamWords, true),
    allowedDomain: str(data.allowedDomain, 'college.edu'),
    minRepToComment: num(data.minRepToComment, 0),
    updatedAtMs,
    updatedBy: data.updatedBy ? str(data.updatedBy) : undefined,
    updatedAt: updatedAtMs === undefined ? undefined : relativeTime(updatedAtMs)
  };
}

// ------------------------------------------------------------------ adapter

export const firebaseModerationAdapter: ModerationAdapter = {
  // ---------------------------------------------------------------- reports
  async listReports(): Promise<Report[]> {
    const snapshot = await getDocs(
      query(collection(db(), REPORTS), orderBy('createdAtMs', 'desc'), limitTo(MAX_LIST))
    );
    return snapshot.docs.map(toReport);
  },

  async createReport(draft: ReportDraft): Promise<Report> {
    const id = reportIdFor(draft);
    const now = Date.now();
    const payload: DocumentData = {
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
      resolvedById: '',
      resolvedAtMs: 0,
      resolutionNote: '',
      createdAtMs: now
    };

    try {
      await setDoc(doc(db(), REPORTS, id), payload);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code.includes('already-exists')) {
        throw alreadyExists('reported this content');
      }
      throw error;
    }

    return {
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
      createdAtMs: now
    };
  },

  async resolveReport(reportId: string, resolution: ReportResolution): Promise<Report> {
    const reference = doc(db(), REPORTS, reportId);
    const reopening = resolution.status === 'pending';
    // The rules pin `resolvedById` to `request.auth.uid` on every update -
    // including a reopen - so the caller must pass its own id; anything else
    // is refused by the rules rather than recorded as a forged decision.
    await updateDoc(reference, {
      status: resolution.status,
      resolvedById: resolution.resolvedById,
      resolvedAtMs: reopening ? 0 : Date.now(),
      resolutionNote: reopening ? '' : (resolution.resolutionNote ?? '').slice(0, 500)
    });
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw new ServiceError('moderation/not-found', 'That report no longer exists.');
    return toReport(snapshot as QueryDocumentSnapshot<DocumentData>);
  },

  async deleteReport(reportId: string): Promise<void> {
    await deleteDoc(doc(db(), REPORTS, reportId));
  },

  // ----------------------------------------------------------- announcements
  async listAnnouncements(): Promise<Announcement[]> {
    const snapshot = await getDocs(
      query(collection(db(), ANNOUNCEMENTS), orderBy('createdAtMs', 'desc'), limitTo(MAX_LIST))
    );
    return snapshot.docs.map(toAnnouncement);
  },

  async createAnnouncement(draft: AnnouncementDraft): Promise<Announcement> {
    const reference = doc(collection(db(), ANNOUNCEMENTS));
    const createdAtMs = Date.now();
    const payload: DocumentData = {
      id: reference.id,
      title: draft.title,
      content: draft.content,
      priority: draft.priority,
      targetAudience: draft.targetAudience,
      authorId: draft.authorId,
      authorName: draft.authorName,
      createdAtMs,
      isActive: true
    };
    await setDoc(reference, payload);
    return {
      id: reference.id,
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
  },

  // ------------------------------------------------------------- audit trail
  async listAuditLogs(limit = MAX_LIST): Promise<AuditLog[]> {
    const snapshot = await getDocs(
      query(collection(db(), AUDIT_LOGS), orderBy('createdAtMs', 'desc'), limitTo(Math.min(limit, MAX_LIST)))
    );
    return snapshot.docs.map(toAuditLog);
  },

  async createAuditLog(draft: AuditLogDraft): Promise<AuditLog> {
    const reference = doc(collection(db(), AUDIT_LOGS));
    const createdAtMs = Date.now();
    const payload: DocumentData = {
      id: reference.id,
      actorId: draft.actorId,
      actorName: draft.actorName,
      action: draft.action,
      target: draft.target,
      type: draft.type,
      createdAtMs
    };
    await setDoc(reference, payload);
    return {
      id: reference.id,
      actorId: draft.actorId,
      actor: draft.actorName,
      action: draft.action,
      target: draft.target,
      createdAtMs,
      timestamp: relativeTime(createdAtMs),
      type: draft.type
    };
  },

  // ---------------------------------------------------------------- warnings
  async listWarnings(): Promise<Warning[]> {
    const snapshot = await getDocs(
      query(collection(db(), WARNINGS), orderBy('createdAtMs', 'desc'), limitTo(MAX_LIST))
    );
    return snapshot.docs.map(toWarning);
  },

  async createWarning(draft: WarningDraft): Promise<Warning> {
    const reference = doc(collection(db(), WARNINGS));
    const createdAtMs = Date.now();
    const payload: DocumentData = {
      id: reference.id,
      userId: draft.userId,
      userName: draft.userName,
      reason: draft.reason,
      issuedById: draft.issuedById,
      issuedByName: draft.issuedByName,
      createdAtMs
    };
    await setDoc(reference, payload);
    return {
      id: reference.id,
      userId: draft.userId,
      userName: draft.userName,
      reason: draft.reason,
      issuedById: draft.issuedById,
      issuedByName: draft.issuedByName,
      createdAtMs,
      issuedAt: relativeTime(createdAtMs)
    };
  },

  // ---------------------------------------------------------- admin settings
  async getAdminSettings(): Promise<AdminSettings | null> {
    const snapshot = await getDoc(doc(db(), ADMIN_SETTINGS, 'singleton'));
    if (!snapshot.exists()) return null;
    return toAdminSettings(snapshot);
  },

  async saveAdminSettings(settings: AdminSettings, actorId: string): Promise<AdminSettings> {
    const payload: DocumentData = {
      id: 'singleton',
      requireFacultyApproval: settings.requireFacultyApproval,
      autoFlagSpamWords: settings.autoFlagSpamWords,
      allowedDomain: settings.allowedDomain,
      minRepToComment: settings.minRepToComment,
      updatedAtMs: Date.now(),
      updatedBy: actorId
    };
    const reference = doc(db(), ADMIN_SETTINGS, 'singleton');
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) await updateDoc(reference, payload);
    else await setDoc(reference, payload);
    return toAdminSettings({ data: () => payload, id: 'singleton' });
  }
};

/** Re-exported for tests that assert the collection and id shapes. */
export { REPORTS, ANNOUNCEMENTS, AUDIT_LOGS, WARNINGS, ADMIN_SETTINGS, MAX_LIST };
