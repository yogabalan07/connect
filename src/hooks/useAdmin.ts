import { useCallback, useMemo } from 'react';
import { AdminSettings, Announcement, User } from '../types';
import { useAdminStore, adminService } from '../services/adminService';
import { useReportsStore, reportService } from '../services/reportService';
import { userService } from '../services/userService';
import { ServiceResult } from '../lib/errors';
import { useAuth } from './useAuth';

/**
 * Admin/moderation surface: user approval, report queue, announcements,
 * audit trail and moderation policies. Every mutation goes through a service
 * so Cloud Functions / Firestore can replace the mock adapter later.
 */
export function useAdmin() {
  const adminState = useAdminStore();
  const reportState = useReportsStore();
  const { currentUser } = useAuth();

  const actor: User | null = currentUser;

  const approveUser = useCallback((userId: string) => {
    const target = userService.getById(userId);
    userService.setStatus(userId, 'active');
    adminService.logAudit({
      actor: actor ? actor.name : 'System',
      action: 'Approved student account',
      target: target ? `${target.name} (${target.department})` : userId,
      timestamp: 'Just now',
      type: 'user'
    });
  }, [actor]);

  const rejectUser = useCallback((userId: string) => {
    const target = userService.getById(userId);
    // Record is preserved as `rejected` for audit history — never deleted.
    userService.setStatus(userId, 'rejected');
    adminService.logAudit({
      actor: actor ? actor.name : 'System',
      action: 'Rejected student registration',
      target: target ? target.email : userId,
      timestamp: 'Just now',
      type: 'user'
    });
  }, [actor]);

  const blockUser = useCallback((userId: string) => {
    const target = userService.getById(userId);
    userService.setStatus(userId, 'blocked');
    adminService.logAudit({
      actor: actor ? actor.name : 'System',
      action: 'Blocked account',
      target: target ? target.name : userId,
      timestamp: 'Just now',
      type: 'moderation'
    });
  }, [actor]);

  const unblockUser = useCallback((userId: string) => {
    const target = userService.getById(userId);
    userService.setStatus(userId, 'active');
    adminService.logAudit({
      actor: actor ? actor.name : 'System',
      action: 'Unblocked account',
      target: target ? target.name : userId,
      timestamp: 'Just now',
      type: 'moderation'
    });
  }, [actor]);

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
