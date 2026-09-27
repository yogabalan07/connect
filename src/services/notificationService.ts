import { Notification } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';

interface NotificationState {
  notifications: Notification[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<NotificationState>({
  notifications: [],
  status: 'loading'
});

export const notificationService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  getAll(): Notification[] {
    return store.get().notifications;
  },

  push(notification: Omit<Notification, 'id'>): Notification {
    const created: Notification = { ...notification, id: `notif-${Date.now()}` };
    store.set(prev => ({ ...prev, notifications: [created, ...prev.notifications] }));
    return created;
  },

  markRead(id: string): void {
    store.set(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => (n.id === id ? { ...n, read: true } : n))
    }));
  },

  markAllRead(): void {
    store.set(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true }))
    }));
  }
};

export function useNotificationsStore(): NotificationState {
  return useStore(store);
}
