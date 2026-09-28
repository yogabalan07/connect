import { AdminSettings, Announcement, AuditLog, User, Warning } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError, ServiceResult, fail, ok } from '../lib/errors';
import { mapFirestoreError } from './firestoreErrors';
import { getModerationAdapter } from './moderationAdapter';

interface AdminState {
  announcements: Announcement[];
  auditLogs: AuditLog[];
  warnings: Warning[];
  adminSettings: AdminSettings;
  status: LoadStatus;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  requireFacultyApproval: true,
  autoFlagSpamWords: true,
  allowedDomain: 'college.edu',
  minRepToComment: 0
};

const store = createStore<AdminState>({
  announcements: [],
  auditLogs: [],
  warnings: [],
  adminSettings: DEFAULT_ADMIN_SETTINGS,
  status: 'loading'
});

/**
 * What an audit row records about the person who acted.
 *
 * Only the caller's own `User` object is accepted: the adapter pins
 * `actorId` to `request.auth.uid` in `firestore.rules`, so a fabricated
 * name can never be filed under someone else's uid.
 */
export interface AuditLogEntry {
  actor: User;
  action: string;
  target: string;
  type: AuditLog['type'];
}

/**
 * Admin-side services: the announcement broadcast, the append-only audit
 * trail, moderator warnings and the moderation policy document.
 *
 * All five live in Firestore (`announcements`, `auditLogs`, `warnings`,
 * `adminSettings/singleton`) behind `ModerationAdapter`. Reads are
 * moderator-only in the rules, so `loadAll` is only ever called for an
 * admin session - an ordinary member would get `permission-denied` on every
 * one of them.
 */
export const adminService = {
  store,

  bootstrap(): void {
    store.set(prev => ({
      ...prev,
      announcements: [],
      auditLogs: [],
      warnings: [],
      adminSettings: DEFAULT_ADMIN_SETTINGS,
      status: 'loading'
    }));
  },

  /** Reads every admin collection once per admin session. */
  async loadAll(): Promise<void> {
    const adapter = getModerationAdapter();
    try {
      const [announcements, auditLogs, warnings, saved] = await Promise.all([
        adapter.listAnnouncements(),
        adapter.listAuditLogs(),
        adapter.listWarnings(),
        adapter.getAdminSettings()
      ]);
      store.set(prev => ({
        ...prev,
        announcements,
        auditLogs,
        warnings,
        adminSettings: saved ?? prev.adminSettings,
        status: 'ready'
      }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error' }));
      throw new ServiceError(mapped.code, mapped.message);
    }
  },

  getAdminSettings(): AdminSettings {
    return store.get().adminSettings;
  },

  /**
   * Validates and persists moderation policies to `adminSettings/singleton`.
   *
   * `actor` must be the signed-in moderator: `firestore.rules` pins
   * `updatedBy` to `request.auth.uid`, so any other value is refused. The
   * client checks produce the friendly copy; the rules re-check the same
   * bounds.
   */
  async saveAdminSettings(
    patch: Partial<AdminSettings>,
    actor: User
  ): Promise<ServiceResult<AdminSettings>> {
    // Partial patches are merged onto the stored policy, so a caller that
    // only flips one toggle does not have to re-send (and cannot accidentally
    // clear) the rest of it.
    const current = store.get().adminSettings;
    const allowedDomain = (patch.allowedDomain ?? current.allowedDomain).trim();
    if (!allowedDomain) {
      return fail('Allowed email domain cannot be empty.');
    }
    if (/\s/.test(allowedDomain)) {
      return fail('Allowed email domain must not contain spaces.');
    }

    const rawMinRep = Number(
      patch.minRepToComment ?? current.minRepToComment ?? DEFAULT_ADMIN_SETTINGS.minRepToComment
    );
    if (!Number.isFinite(rawMinRep) || rawMinRep < 0 || !Number.isInteger(rawMinRep)) {
      return fail('Minimum reputation must be a whole number of 0 or more.');
    }

    const next: AdminSettings = {
      requireFacultyApproval: patch.requireFacultyApproval ?? current.requireFacultyApproval,
      autoFlagSpamWords: patch.autoFlagSpamWords ?? current.autoFlagSpamWords,
      allowedDomain,
      minRepToComment: rawMinRep
    };

    try {
      const saved = await getModerationAdapter().saveAdminSettings(next, actor.id);
      store.set(prev => ({ ...prev, adminSettings: saved }));
      return ok(saved);
    } catch (error) {
      const mapped = mapFirestoreError(error);
      return fail(mapped.message);
    }
  },

  /**
   * Appends one row to the immutable trail.
   *
   * Fire-and-forget from the UI's perspective: an audit failure must never
   * roll back the action it describes, so callers `.catch()` it and the
   * action's own result stands on its own.
   */
  async logAudit(entry: AuditLogEntry): Promise<AuditLog> {
    try {
      const created = await getModerationAdapter().createAuditLog({
        actorId: entry.actor.id,
        actorName: entry.actor.name,
        action: entry.action,
        target: entry.target,
        type: entry.type
      });
      store.set(prev => ({ ...prev, auditLogs: [created, ...prev.auditLogs] }));
      return created;
    } catch (error) {
      const mapped = mapFirestoreError(error);
      throw new ServiceError(mapped.code, mapped.message);
    }
  },

  /** Best-effort variant used next to an already-committed action. */
  async logAuditSafely(entry: AuditLogEntry): Promise<void> {
    try {
      await adminService.logAudit(entry);
    } catch {
      // The trail is a side effect; losing one row must not surface an error
      // for an action that already succeeded.
    }
  },

  async createAnnouncement(
    actor: User,
    input: Omit<Announcement, 'id' | 'createdAt' | 'createdAtMs' | 'authorId' | 'authorName' | 'isActive'>
  ): Promise<Announcement> {
    if (!input.title.trim() || !input.content.trim()) {
      throw new ServiceError('announcement/invalid', 'Announcement title and body are required.');
    }
    const created = await getModerationAdapter().createAnnouncement({
      title: input.title.trim(),
      content: input.content.trim(),
      priority: input.priority,
      targetAudience: input.targetAudience,
      authorId: actor.id,
      authorName: actor.name
    });
    store.set(prev => ({ ...prev, announcements: [created, ...prev.announcements] }));
    return created;
  },

  /** Persists a moderator-issued academic warning. */
  async createWarning(moderator: User, userId: string, userName: string, reason: string): Promise<Warning> {
    const created = await getModerationAdapter().createWarning({
      userId,
      userName,
      reason,
      issuedById: moderator.id,
      issuedByName: moderator.name
    });
    store.set(prev => ({ ...prev, warnings: [created, ...prev.warnings] }));
    return created;
  }
};

export function useAdminStore(): AdminState {
  return useStore(store);
}
