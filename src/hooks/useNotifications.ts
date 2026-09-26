import { useMemo } from 'react';
import { useNotificationsStore, notificationService } from '../services/notificationService';

export function useNotifications() {
  const state = useNotificationsStore();

  const unreadCount = useMemo(
    () => state.notifications.filter(n => !n.read).length,
    [state.notifications]
  );

  return {
    notifications: state.notifications,
    status: state.status,
    unreadCount,
    markRead: notificationService.markRead,
    markAllRead: notificationService.markAllRead
  };
}
