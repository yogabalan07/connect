import { AdminSettings, Announcement, AuditLog, User, Warning } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError, ServiceResult, fail, ok } from '../lib/errors';

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
 * Admin-side services (announcements, audit trail, moderation policies).
 * `saveAdminSettings` maps to the future `adminSettings/{singleton}` doc.
 */
export const adminService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  getAdminSettings(): AdminSettings {
    return store.get().adminSettings;
  },

  /**
   * Validates and persists moderation policies.
   * Stored in memory for this session only - the success
   * message must say so until Firestore is wired up.
   */
  async saveAdminSettings(patch: Partial<AdminSettings>): Promise<ServiceResult<AdminSettings>> {
    const allowedDomain = (patch.allowedDomain ?? '').trim();
    if (!allowedDomain) {
      return fail('Allowed email domain cannot be empty.');
    }
    if (/\s/.test(allowedDomain)) {
      return fail('Allowed email domain must not contain spaces.');
    }

    const rawMinRep = Number(patch.minRepToComment ?? DEFAULT_ADMIN_SETTINGS.minRepToComment);
    if (!Number.isFinite(rawMinRep) || rawMinRep < 0 || !Number.isInteger(rawMinRep)) {
      return fail('Minimum reputation must be a whole number of 0 or more.');
    }

    const next: AdminSettings = {
      requireFacultyApproval:
        patch.requireFacultyApproval ?? store.get().adminSettings.requireFacultyApproval,
      autoFlagSpamWords: patch.autoFlagSpamWords ?? store.get().adminSettings.autoFlagSpamWords,
      allowedDomain,
      minRepToComment: rawMinRep,
      updatedAt: 'Just now'
    };

    try {
      store.set(prev => ({ ...prev, adminSettings: next }));
      return ok(next);
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Could not save admin settings.');
    }
  },

  logAudit(entry: Omit<AuditLog, 'id'>): AuditLog {
    const created: AuditLog = { ...entry, id: `log-${Date.now()}` };
    store.set(prev => ({ ...prev, auditLogs: [created, ...prev.auditLogs] }));
    return created;
  },

  createAnnouncement(
    actor: User,
    input: Omit<Announcement, 'id' | 'createdAt' | 'authorName' | 'isActive'>
  ): Announcement {
    if (!input.title.trim() || !input.content.trim()) {
      throw new ServiceError('announcement/invalid', 'Announcement title and body are required.');
    }
    const created: Announcement = {
      ...input,
      id: `ann-${Date.now()}`,
      createdAt: 'Today',
      authorName: actor.name,
      isActive: true
    };
    store.set(prev => ({ ...prev, announcements: [created, ...prev.announcements] }));
    return created;
  },

  addWarning(warning: Omit<Warning, 'id'>): Warning {
    const created: Warning = { ...warning, id: `warn-${Date.now()}` };
    store.set(prev => ({ ...prev, warnings: [created, ...prev.warnings] }));
    return created;
  }
};

export function useAdminStore(): AdminState {
  return useStore(store);
}
