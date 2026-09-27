import { Notification } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { getContentAdapter } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { requireServiceActor } from './actor';

interface NotificationState {
  notifications: Notification[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<NotificationState>({
  notifications: [],
  status: 'loading',
  error: undefined
});

async function viaAdapter<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

/**
 * Notifications for the signed-in member.
 *
 * `push` is the single entry point every other service uses to raise an
 * event (new answer, accepted answer, new follower, mention, admin notice).
 * Today it writes `notifications/{id}` from the client; the moment Cloud
 * Functions ship, only this method changes — callers, pages and hooks do not.
 *
 * Reads are scoped to the caller by `firestore.rules`
 * (`resource.data.userId == request.auth.uid`), so one member can never list
 * another member's notifications.
 */
export const notificationService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'loading', error: undefined }));
  },

  async loadAll(actorId?: string): Promise<void> {
    const uid = actorId ?? requireServiceActor();
    try {
      const notifications = await viaAdapter(() => getContentAdapter().listNotifications(uid));
      store.set(prev => ({ ...prev, notifications, status: 'ready', error: undefined }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
  },

  getAll(): Notification[] {
    return store.get().notifications;
  },

  async push(notification: Omit<Notification, 'id'>): Promise<Notification> {
    try {
      const created = await getContentAdapter().createNotification({
        ...notification,
        // `timestamp` is derived from the persisted epoch on read; the value
        // supplied by the caller is only a hint for the optimistic copy.
        id: '',
        timestamp: notification.timestamp || 'Just now'
      });
      store.set(prev => ({ ...prev, notifications: [created, ...prev.notifications] }));
      return created;
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  async markRead(id: string): Promise<void> {
    const actorId = requireServiceActor();
    const previous = store.get().notifications;
    store.set(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => (n.id === id ? { ...n, read: true } : n))
    }));
    try {
      await viaAdapter(() => getContentAdapter().markNotificationRead(actorId, id));
    } catch (error) {
      store.set(prev => ({ ...prev, notifications: previous }));
      throw error;
    }
  },

  async markAllRead(): Promise<void> {
    const actorId = requireServiceActor();
    const previous = store.get().notifications;
    const unread = previous.filter(n => !n.read).map(n => n.id);
    if (unread.length === 0) return;
    store.set(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true }))
    }));
    try {
      await viaAdapter(() => getContentAdapter().markAllNotificationsRead(actorId, unread));
    } catch (error) {
      store.set(prev => ({ ...prev, notifications: previous }));
      throw error;
    }
  }
};

export function useNotificationsStore(): NotificationState {
  return useStore(store);
}

/** Test seam: empties the notification feed without touching the adapter. */
export function resetNotificationStoreForTests(): void {
  store.set({ notifications: [], status: 'loading', error: undefined });
}
