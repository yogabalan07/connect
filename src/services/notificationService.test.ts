import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setServiceActor } from './actor';
import { setContentAdapter } from './contentAdapter';
import { notificationService, resetNotificationStoreForTests } from './notificationService';
import { createFakeContentAdapter } from './testing/fakeContentAdapter';
import type { FakeContentAdapter } from './testing/fakeContentAdapter';
import { makeUser } from './testing/contentFixtures';
import type { Notification } from '../types';

/**
 * M4: notifications are strictly per-member documents
 * (`notifications/{id}` with `userId == request.auth.uid`), so the store only
 * ever holds the signed-in member's own events.
 */
const member = makeUser({ id: 'uid_member', role: 'student', status: 'approved' });
const mentor = makeUser({ id: 'uid_mentor', role: 'mentor', status: 'approved' });

const PERMISSION_COPY = 'You do not have permission to do that. Contact your department administrator.';

let fake: FakeContentAdapter;

function draft(overrides: Partial<Omit<Notification, 'id'>> = {}): Omit<Notification, 'id'> {
  return {
    userId: member.id,
    senderId: 'uid_other',
    type: 'answer',
    title: 'New answer on your doubt',
    message: 'Mentor replied to "Merge sort overflow".',
    timestamp: 'Just now',
    read: false,
    ...overrides
  };
}

beforeEach(() => {
  fake = createFakeContentAdapter();
  setContentAdapter(fake);
  resetNotificationStoreForTests();
  setServiceActor(member.id);
});

afterEach(() => {
  setContentAdapter(null);
  setServiceActor(null);
  resetNotificationStoreForTests();
});

describe('notificationService.loadAll', () => {
  it('reads only this member\'s notifications, newest first', async () => {
    await fake.createNotification({ id: '', ...draft({ title: 'Older event', read: true }) });
    await fake.createNotification({ id: '', ...draft({ title: 'Newer event' }) });
    await fake.createNotification({ id: '', ...draft({ userId: 'uid_other', title: 'Not mine' }) });

    await notificationService.loadAll(member.id);

    expect(notificationService.store.get().status).toBe('ready');
    expect(notificationService.getAll().map(n => n.title)).toEqual(['Newer event', 'Older event']);
    expect(notificationService.getAll().some(n => n.title === 'Not mine')).toBe(false);
  });

  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await notificationService.loadAll(member.id);

    expect(notificationService.store.get()).toMatchObject({
      status: 'error',
      error: PERMISSION_COPY,
      notifications: []
    });
  });

  it('refuses to read on behalf of nobody', async () => {
    setServiceActor(null);

    await expect(notificationService.loadAll()).rejects.toMatchObject({ code: 'auth/required' });
    expect(fake.calls.listNotifications).toBe(0);
  });
});

describe('notificationService.push', () => {
  it('creates the event and puts it at the top of the feed', async () => {
    await fake.createNotification({ id: '', ...draft({ title: 'Already there' }) });
    await notificationService.loadAll(member.id);

    const created = await notificationService.push(draft({ type: 'accepted', title: 'Answer accepted' }));

    expect(created.id).toMatch(/^notif-/);
    expect(created.read).toBe(false);
    expect(notificationService.getAll().map(n => n.title)).toEqual(['Answer accepted', 'Already there']);
    expect(fake.notificationsFor(member.id)).toHaveLength(2);
  });

  it('surfaces a refused write with the campus permission copy', async () => {
    fake.setDenied(true);

    await expect(notificationService.push(draft())).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(notificationService.getAll()).toEqual([]);
  });
});

describe('notificationService fan-out', () => {
  const actor = { id: member.id, name: member.name, avatar: member.avatar };

  it('stamps the caller as the sender and never writes into their own inbox', async () => {
    const self = await notificationService.notify(member.id, actor, {
      type: 'answer',
      title: 'Answered your own question',
      message: 'You answered yourself.'
    });

    expect(self).toBeNull();
    expect(fake.notificationsFor(member.id)).toEqual([]);
  });

  it('creates one event per distinct recipient, all attributed to the actor', async () => {
    const created = await notificationService.notifyAll(
      [member.id, 'uid_b', 'uid_c', 'uid_b'],
      actor,
      { type: 'mention', title: 'Mentioned you', message: 'Take a look.' }
    );

    expect(created.map(n => n.userId)).toEqual(['uid_b', 'uid_c']);
    expect(created.every(n => n.senderId === member.id)).toBe(true);
    expect(created.every(n => n.senderName === member.name)).toBe(true);
    expect(created.every(n => n.source === 'client')).toBe(true);
    expect(created.every(n => n.read === false)).toBe(true);
    expect(created.every(n => n.type === 'mention')).toBe(true);
  });

  it('writes the product copy for each interaction event', async () => {
    const events = [
      await notificationService.notifyNewAnswer(member.id, mentor, 'doubt-1', 'Merge sort overflow'),
      await notificationService.notifyAcceptedAnswer(member.id, mentor, 'doubt-1'),
      await notificationService.notifyComment(
        member.id,
        mentor,
        'doubt-1',
        'Merge sort overflow',
        'needs more detail',
        true
      ),
      await notificationService.notifyFollow(member.id, mentor, 'CSE, 3rd Year'),
      await notificationService.notifyAdminApproval(member.id, mentor, 'approved')
    ];

    expect(events.map(e => e?.type)).toEqual(['answer', 'accepted', 'comment', 'follow', 'admin_approval']);
    expect(events.every(e => e?.senderId === mentor.id)).toBe(true);
    expect(events.every(e => e?.link?.startsWith('/'))).toBe(true);
    expect(events[3]?.message).toContain('CSE, 3rd Year');
    expect(events[1]?.title).toContain('Accepted');
  });

  it('broadcasts an announcement to every approved member except its author', async () => {
    const created = await notificationService.notifyAnnouncement(
      [member.id, 'uid_b', member.id],
      actor,
      'Mid-term schedule',
      'Exams start Monday.'
    );

    expect(created.map(n => n.userId)).toEqual(['uid_b']);
    expect(created[0].title).toBe('Campus Announcement: Mid-term schedule');
    expect(created[0].message).toBe('Exams start Monday.');
    expect(created[0].link).toBeUndefined();
  });

  it('surfaces a refused delivery as the campus permission copy', async () => {
    fake.setDenied(true);

    await expect(
      notificationService.notify('uid_b', actor, {
        type: 'answer',
        title: 'New Solution on your Question',
        message: 'Replied.'
      })
    ).rejects.toMatchObject({ code: 'firestore/permission-denied', message: PERMISSION_COPY });
  });
});

describe('notificationService.markRead', () => {
  it('marks one event and persists the flag', async () => {
    const stored = await fake.createNotification({ id: '', ...draft() });
    await notificationService.loadAll(member.id);

    await notificationService.markRead(stored.id);

    expect(notificationService.getAll()[0].read).toBe(true);
    expect(fake.notificationsFor(member.id)[0].read).toBe(true);
  });

  it('rolls the optimistic flag back when the write is refused', async () => {
    const stored = await fake.createNotification({ id: '', ...draft() });
    await notificationService.loadAll(member.id);
    fake.setDenied(true);

    await expect(notificationService.markRead(stored.id)).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(notificationService.getAll()[0].read).toBe(false);
    expect(fake.notificationsFor(member.id)[0].read).toBe(false);
  });

  it('requires a signed-in member', async () => {
    setServiceActor(null);

    await expect(notificationService.markRead('notif-1')).rejects.toMatchObject({ code: 'auth/required' });
    expect(fake.calls.markNotificationRead).toBe(0);
  });
});

describe('notificationService.markAllRead', () => {
  it('clears every unread event in a single batch', async () => {
    await fake.createNotification({ id: '', ...draft({ title: 'One' }) });
    await fake.createNotification({ id: '', ...draft({ title: 'Two' }) });
    await fake.createNotification({ id: '', ...draft({ title: 'Three', read: true }) });
    await notificationService.loadAll(member.id);

    await notificationService.markAllRead();

    expect(notificationService.getAll().every(n => n.read)).toBe(true);
    expect(fake.calls.markAllNotificationsRead).toBe(1);
    expect(fake.notificationsFor(member.id).every(n => n.read)).toBe(true);
  });

  it('skips the write entirely when nothing is unread', async () => {
    await fake.createNotification({ id: '', ...draft({ read: true }) });
    await notificationService.loadAll(member.id);

    await notificationService.markAllRead();

    expect(fake.calls.markAllNotificationsRead).toBe(0);
  });

  it('rolls every flag back when the batch is refused', async () => {
    await fake.createNotification({ id: '', ...draft() });
    await notificationService.loadAll(member.id);
    fake.setDenied(true);

    await expect(notificationService.markAllRead()).rejects.toMatchObject({
      code: 'firestore/permission-denied'
    });
    expect(notificationService.getAll()[0].read).toBe(false);
    expect(fake.notificationsFor(member.id)[0].read).toBe(false);
  });
});

describe('realtime stream', () => {
  it('adds an event that arrives on the stream without another read', async () => {
    await notificationService.loadAll(member.id);
    const reads = fake.calls.listNotifications;

    await fake.createNotification({ id: '', ...draft({ title: 'Just arrived' }) });

    expect(fake.calls.listNotifications).toBe(reads);
    expect(notificationService.getAll().map(n => n.title)).toContain('Just arrived');
  });

  it('keeps exactly one subscription however many times it loads', async () => {
    await notificationService.loadAll(member.id);
    await notificationService.loadAll(member.id);

    expect(fake.activeStreamCount()).toBe(1);
  });

  it('drops the stream when the session is torn down', async () => {
    await notificationService.loadAll(member.id);
    expect(fake.activeStreamCount()).toBe(1);

    notificationService.bootstrap();

    expect(fake.activeStreamCount()).toBe(0);
  });

  it('keeps the loaded feed on screen when the stream fails', async () => {
    await fake.createNotification({ id: '', ...draft({ title: 'Already loaded' }) });
    await notificationService.loadAll(member.id);

    fake.failStreams(new Error('connection lost'));

    const state = notificationService.store.get();
    expect(state.status).toBe('ready');
    expect(state.notifications.map(n => n.title)).toEqual(['Already loaded']);
    expect(state.error).toBeTruthy();
  });
});
