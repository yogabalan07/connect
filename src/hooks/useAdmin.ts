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

  useEffect(() => {
    if (!actorId || actorRole !== 'admin') return;
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
  }, [actorId, actorRole]);

  const approveUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.approveUser(userId);
      adminService.logAudit({
        actor: actor ? actor.name : 'System',
        action: 'Approved student account',
        target: target ? `${target.name} (${target.department})` : userId,
        timestamp: 'Just now',
        type: 'user'
      });
      return updated;
    },
    [actor]
  );

  const rejectUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.rejectUser(userId);
      // Record is preserved as `rejected` for audit history — never deleted.
      adminService.logAudit({
        actor: actor ? actor.name : 'System',
        action: 'Rejected student registration',
        target: target ? target.email : userId,
        timestamp: 'Just now',
        type: 'user'
      });
      return updated;
    },
    [actor]
  );

  const blockUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.blockUser(userId);
      adminService.logAudit({
        actor: actor ? actor.name : 'System',
        action: 'Blocked account',
        target: target ? target.name : userId,
        timestamp: 'Just now',
        type: 'moderation'
      });
      return updated;
    },
    [actor]
  );

  const unblockUser = useCallback(
    async (userId: string): Promise<User> => {
      const target = userService.getById(userId);
      const updated = await userService.unblockUser(userId);
      adminService.logAudit({
        actor: actor ? actor.name : 'System',
        action: 'Unblocked account',
        target: target ? target.name : userId,
        timestamp: 'Just now',
        type: 'moderation'
      });
      return updated;
    },
    [actor]
  );

  const dismissReport = useCallback((reportId: string) => {
    reportService.dismissReport(reportId);
  }, []);

  const resolveReport = useCallback((reportId: string, actionTaken: string) => {
    reportService.resolveReport(reportId, actionTaken);
  }, []);

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
    (input: Omit<Announcement, 'id' | 'createdAt' | 'authorName' | 'isActive'>): Announcement => {
      if (!actor) throw new Error('Sign in to publish announcements.');
      return adminService.createAnnouncement(actor, input);
    },
    [actor]
  );

  const saveAdminSettings = useCallback(
    (patch: Partial<AdminSettings>) => adminService.saveAdminSettings(patch),
    []
  );

  const warnings = useMemo(() => adminState.warnings, [adminState.warnings]);

  return {
    reports: reportState.reports,
    pendingUsers,
    announcements: adminState.announcements,
    auditLogs: adminState.auditLogs,
    warnings,
    adminSettings: adminState.adminSettings,
    status: reportState.status === 'ready' && adminState.status === 'ready' ? 'ready' : adminState.status,
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
