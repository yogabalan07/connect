import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminSettings, Announcement, User } from '../types';
import { useAdminStore, adminService } from '../services/adminService';
import { useReportsStore, reportService } from '../services/reportService';
import { userService } from '../services/userService';
import { ServiceResult } from '../lib/errors';
import { useAuth } from './useAuth';

/**
 * Admin/moderation surface: user approval, report queue, announcements,
 * audit trail and moderation policies.
 *
 * Account transitions are async because they are persisted by the user
 * adapter: every call resolves only after Firestore accepted the write, so
 * the audit entry and the caller's toast can never claim an approval that
 * did not happen. Failures (missing permission, unknown account) propagate
 * as typed `ServiceError`s for the UI to render.
 */
export function useAdmin() {
  const adminState = useAdminStore();
  const reportState = useReportsStore();
  const { currentUser } = useAuth();

  const actor: User | null = currentUser;

  // The admin queue is re-read from Firestore on every admin session so a
  // pending registration submitted by someone else shows up without a reload.
  // Dependencies are plain strings: a directory merge replaces user objects
  // and would otherwise refetch in a loop.
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const actorId = actor?.id ?? null;
  const actorRole = actor?.role ?? null;
  const adminKey = actorId && actorRole === 'admin' ? actorId : null;

  useEffect(() => {
    if (!adminKey) return;
    let cancelled = false;
    void userService
      .listPendingUsers()
      .then(list => {
        if (!cancelled) setPendingUsers(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  /**
   * Reads the moderator-only collections for this session.
   *
   * Only an admin may read `reports`, `announcements`, `auditLogs`,
   * `warnings` and `adminSettings` - the rules refuse everyone else - so
   * this runs behind the same guard as the pending queue instead of inside
   * `loadContent`, where an ordinary member would produce four
   * `permission-denied` errors on every login.
   */
  useEffect(() => {
    if (!adminKey) return;
    let cancelled = false;
    void (async () => {
      try {
        await reportService.loadAll();
        if (!cancelled) await adminService.loadAll();
      } catch {
        // Each store has already flipped to `error`; the pages render their
        // own empty state from there.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  const approveUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.approveUser(userId);
      if (actor) {
        await adminService.logAuditSafely({
          actor,
          action: 'Approved student account',
          target: target ? `${target.name} (${target.department})` : userId,
          type: 'user'
        });
      }
      return updated;
    },
    [actor]
  );

  const rejectUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.rejectUser(userId);
      // Record is preserved as `rejected` for audit history — never deleted.
      if (actor) {
        await adminService.logAuditSafely({
          actor,
          action: 'Rejected student registration',
          target: target ? target.email : userId,
          type: 'user'
        });
      }
      return updated;
    },
    [actor]
  );

  const blockUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.blockUser(userId);
      if (actor) {
        await adminService.logAuditSafely({
          actor,
          action: 'Blocked account',
          target: target ? target.name : userId,
          type: 'moderation'
        });
      }
      return updated;
    },
    [actor]
  );

  const unblockUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.unblockUser(userId);
      if (actor) {
        await adminService.logAuditSafely({
          actor,
          action: 'Unblocked account',
          target: target ? target.name : userId,
          type: 'moderation'
        });
      }
      return updated;
    },
    [actor]
  );

  const dismissReport = useCallback(
    async (reportId: string): Promise<ServiceResult<unknown>> => {
      if (!actor) return { ok: false, message: 'Sign in as an admin to moderate reports.' };
      return reportService.dismissReport(reportId, actor);
    },
    [actor]
  );

  const resolveReport = useCallback(
    async (reportId: string, actionTaken: string): Promise<ServiceResult<unknown>> => {
      if (!actor) return { ok: false, message: 'Sign in as an admin to moderate reports.' };
      return reportService.resolveReport(reportId, actionTaken, actor);
    },
    [actor]
  );

  const deleteReportedContent = useCallback(
    async (reportId: string): Promise<ServiceResult<void>> => {
      if (!actor) return { ok: false, message: 'Sign in as an admin to moderate content.' };
      return reportService.deleteReportedContent(reportId, actor);
    },
    [actor]
  );

  const issueWarning = useCallback(
    async (userId: string, userName: string, reason: string): Promise<ServiceResult<void>> => {
      if (!actor) return { ok: false, message: 'Sign in as an admin to issue warnings.' };
      return reportService.issueWarning(actor, userId, userName, reason);
    },
    [actor]
  );

  const createAnnouncement = useCallback(
    async (
      input: Omit<Announcement, 'id' | 'createdAt' | 'createdAtMs' | 'authorId' | 'authorName' | 'isActive'>
    ): Promise<Announcement> => {
      if (!actor) throw new Error('Sign in to publish announcements.');
      return adminService.createAnnouncement(actor, input);
    },
    [actor]
  );

  const saveAdminSettings = useCallback(
    (patch: Partial<AdminSettings>): Promise<ServiceResult<AdminSettings>> => {
      if (!actor) {
        return Promise.resolve({ ok: false, message: 'Sign in as an admin to change policies.' });
      }
      return adminService.saveAdminSettings(patch, actor);
    },
    [actor]
  );

  const warnings = useMemo(() => adminState.warnings, [adminState.warnings]);

  return {
    reports: reportState.reports,
    pendingUsers,
    announcements: adminState.announcements,
    auditLogs: adminState.auditLogs,
    warnings,
    adminSettings: adminState.adminSettings,
    status:
      reportState.status === 'ready' && adminState.status === 'ready'
        ? 'ready'
        : adminState.status === 'error' || reportState.status === 'error'
          ? 'error'
          : adminState.status,
    approveUser,
    rejectUser,
    blockUser,
    unblockUser,
    dismissReport,
    resolveReport,
    deleteReportedContent,
    issueWarning,
    createAnnouncement,
    saveAdminSettings
  };
}
