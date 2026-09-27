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
 * `push` is the single low-level write every other service uses to raise an
 * event. Pages and hooks should prefer the typed `notify…` helpers below:
 * they own the copy, stamp the true `senderId` (which `firestore.rules`
 * pins to `request.auth.uid`), and refuse to notify a member about their
 * own action - invariants that are easy to forget at a call site.
 *
 * Today it writes `notifications/{id}` from the client; the moment Cloud
 * Functions ship, only this method changes — callers, pages and hooks do not.
 *
 * Reads are scoped to the caller by `firestore.rules`
 * (`resource.data.userId == request.auth.uid`), so one member can never list
 * another member's notifications.
 */

/** Who caused the event - never the recipient. */
export interface NotifyActor {
  id: string;
  name: string;
  avatar?: string;
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

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

  /**
   * Delivers one event, or silently skips it when it would tell a member
   * about something they did themselves.
   */
  async notify(
    recipientId: string,
    actor: NotifyActor,
    draft: { type: Notification['type']; title: string; message: string; link?: string }
  ): Promise<Notification | null> {
    if (!recipientId || !actor?.id || recipientId === actor.id) return null;
    return notificationService.push({
      userId: recipientId,
      senderId: actor.id,
      senderName: actor.name,
      senderAvatar: actor.avatar,
      // This path only ever runs in a browser, and the rules require the
      // marker: a `server` event has to come from the Admin SDK instead.
      source: 'client',
      type: draft.type,
      title: draft.title,
      message: draft.message,
      link: draft.link,
      timestamp: 'Just now',
      read: false
    });
  },

  /** Same fan-out as `notify`, in document order, for group events. */
  async notifyAll(
    recipients: string[],
    actor: NotifyActor,
    draft: { type: Notification['type']; title: string; message: string; link?: string }
  ): Promise<Notification[]> {
    const created: Notification[] = [];
    for (const recipientId of Array.from(new Set(recipients))) {
      const event = await notificationService.notify(recipientId, actor, draft);
      if (event) created.push(event);
    }
    return created;
  },

  notifyNewAnswer(recipientId: string, actor: NotifyActor, doubtId: string, doubtTitle: string) {
    return notificationService.notify(recipientId, actor, {
      type: 'answer',
      title: 'New Solution on your Question',
      message: `${actor.name} posted an answer to: "${clip(doubtTitle, 50)}..."`,
      link: `/app/doubts/${doubtId}`
    });
  },

  notifyAcceptedAnswer(recipientId: string, actor: NotifyActor, doubtId: string) {
    return notificationService.notify(recipientId, actor, {
      type: 'accepted',
      title: 'Answer Accepted! (+15 Rep)',
      message: `${actor.name} marked your answer as the accepted solution!`,
      link: `/app/doubts/${doubtId}`
    });
  },

  notifyComment(
    recipientId: string,
    actor: NotifyActor,
    doubtId: string,
    doubtTitle: string,
    excerpt: string,
    onAnswer: boolean
  ) {
    return notificationService.notify(recipientId, actor, {
      type: 'comment',
      title: onAnswer ? 'New comment on your answer' : 'New comment on your question',
      message: `${actor.name} commented on "${clip(doubtTitle, 40)}": ${clip(excerpt, 80)}`,
      link: `/app/doubts/${doubtId}`
    });
  },

  notifyMentions(recipients: string[], actor: NotifyActor, link: string, excerpt: string) {
    return notificationService.notifyAll(recipients, actor, {
      type: 'mention',
      title: `${actor.name} mentioned you`,
      message: `${actor.name} mentioned you: ${clip(excerpt, 120)}`,
      link
    });
  },

  notifyFollow(recipientId: string, actor: NotifyActor, actorProfile: string) {
    return notificationService.notify(recipientId, actor, {
      type: 'follow',
      title: 'New Follower',
      message: `${actor.name} (${actorProfile}) started following you.`,
      link: `/app/users/${actor.id}`
    });
  },

  notifyAnnouncement(recipients: string[], actor: NotifyActor, title: string, content: string) {
    return notificationService.notifyAll(recipients, actor, {
      type: 'announcement',
      title: `Campus Announcement: ${title}`,
      message: content
    });
  },

  notifyAdminApproval(
    recipientId: string,
    actor: NotifyActor,
    decision: 'approved' | 'rejected'
  ) {
    return notificationService.notify(recipientId, actor, {
      type: 'admin_approval',
      title: decision === 'approved' ? 'Registration Approved' : 'Registration Update',
      message:
        decision === 'approved'
          ? `${actor.name} approved your account. You can now ask and answer doubts.`
          : `${actor.name} reviewed your registration. Contact your department administrator for details.`,
      link: decision === 'approved' ? '/app/doubts' : '/login'
    });
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
