import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { conversationIdFor, setMessagingAdapter } from './messagingAdapter';
import { messageService } from './messageService';
import { setUserAdapter } from './userAdapter';
import { userService, resetUserDirectoryForTests } from './userService';
import {
  createFakeMessagingAdapter,
  DENIED_COPY,
  type FakeMessagingAdapter
} from './testing/fakeMessagingAdapter';
import { createFakeUserAdapter, type FakeUserAdapter } from './testing/fakeUserAdapter';
import { makeUser } from './testing/contentFixtures';

/**
 * Messaging is a real persistence concern, not a session-only store: the
 * document id (`{a_b}`) is what makes a duplicate conversation impossible,
 * and unread state comes from my own read cursor in
 * `conversationReads/{a_b}_{uid}` rather than from a flag on the thread.
 */
const alice = makeUser({ id: 'uid_alice', name: 'Alice Kumar', role: 'student', status: 'approved' });
const bob = makeUser({ id: 'uid_bob', name: 'Bob Mentor', role: 'mentor', status: 'approved' });
const carol = makeUser({ id: 'uid_carol', name: 'Carol Sen', role: 'student', status: 'approved' });

const PAIR = 'uid_alice_uid_bob';

let fake: FakeMessagingAdapter;
let fakeUsers: FakeUserAdapter;

beforeEach(async () => {
  fake = createFakeMessagingAdapter();
  setMessagingAdapter(fake);
  fakeUsers = createFakeUserAdapter();
  fakeUsers.seed([alice, bob, carol]);
  setUserAdapter(fakeUsers);
  resetUserDirectoryForTests();
  messageService.bootstrap();
  await userService.loadDirectory();
});

afterEach(() => {
  setMessagingAdapter(null);
  setUserAdapter(null);
  resetUserDirectoryForTests();
  messageService.bootstrap();
});

function seedIncoming(from = bob): void {
  fake.seedConversations([
    {
      id: PAIR,
      participants: [alice.id, bob.id].sort(),
      createdAtMs: 1_000,
      updatedAtMs: 2_000,
      lastMessageAtMs: 5_000,
      lastMessageSenderId: from.id,
      lastMessagePreview: 'did you finish the lab?'
    }
  ]);
  // A thread never carries `lastMessageAtMs` without the document that
  // produced it - `sendMessage` writes both in one batch - so the fixture
  // seeds the message too. Unread is counted off the real history, and a
  // summary with nothing behind it would count as nothing.
  fake.seedMessages([
    {
      id: 'msg_incoming_1',
      conversationId: PAIR,
      senderId: from.id,
      receiverId: from.id === alice.id ? bob.id : alice.id,
      text: 'did you finish the lab?',
      timestamp: 'now',
      createdAtMs: 5_000,
      read: false
    }
  ]);
}

describe('conversation identity', () => {
  it('uses the sorted pair as the document id, so order never matters', async () => {
    expect(conversationIdFor(bob.id, alice.id)).toBe(PAIR);
    expect(conversationIdFor(alice.id, bob.id)).toBe(PAIR);

    await messageService.loadAll(alice.id);
    const opened = await messageService.startConversation(bob.id);
    expect(opened).toBe(PAIR);
    expect(fake.conversationRecords()[0].participants).toEqual([alice.id, bob.id].sort());
  });

  it('reopening the same peer never mints a second conversation', async () => {
    await messageService.loadAll(alice.id);

    const first = await messageService.startConversation(bob.id);
    const second = await messageService.startConversation(bob.id);

    expect(second).toBe(first);
    expect(fake.conversationRecords()).toHaveLength(1);
    expect(fake.calls.ensureConversation).toBe(2);
  });

  it('refuses to open a thread with myself', async () => {
    await messageService.loadAll(alice.id);
    await expect(messageService.startConversation(alice.id)).rejects.toThrow(
      'Pick another campus member to message.'
    );
  });

  it('lists only the threads the acting member belongs to', async () => {
    fake.seedConversations([
      {
        id: 'uid_bob_uid_carol',
        participants: ['uid_bob', 'uid_carol'],
        createdAtMs: 1,
        updatedAtMs: 2,
        lastMessageAtMs: 3,
        lastMessageSenderId: carol.id,
        lastMessagePreview: 'hi'
      }
    ]);

    await messageService.loadAll(alice.id);

    expect(messageService.store.get().conversations).toEqual([]);
  });
});

describe('conversation projection', () => {
  it('resolves the peer from the user directory', async () => {
    await messageService.loadAll(alice.id);
    await messageService.startConversation(bob.id);

    const [conversation] = messageService.store.get().conversations;
    expect(conversation.participant?.name).toBe('Bob Mentor');
    expect(conversation.participant?.role).toBe('mentor');
  });

  it('leaves an unknown peer as null instead of dropping the thread', async () => {
    fake.seedConversations([
      {
        id: 'uid_alice_uid_ghost',
        participants: ['uid_alice', 'uid_ghost'],
        createdAtMs: 1,
        updatedAtMs: 2,
        lastMessageAtMs: 3,
        lastMessageSenderId: 'uid_ghost',
        lastMessagePreview: 'hi'
      }
    ]);

    await messageService.loadAll(alice.id);

    const [conversation] = messageService.store.get().conversations;
    expect(conversation.id).toBe('uid_alice_uid_ghost');
    expect(conversation.participant).toBeNull();
    expect(conversation.lastMessage?.text).toBe('hi');
  });
});

describe('sending', () => {
  it('trims, persists and moves the conversation summary', async () => {
    await messageService.loadAll(alice.id);

    const message = await messageService.send(alice, bob, '  hello there  ');

    expect(message.text).toBe('hello there');
    expect(fake.messageRecords(PAIR)).toHaveLength(1);

    const [conversation] = fake.conversationRecords();
    expect(conversation.lastMessagePreview).toBe('hello there');
    expect(conversation.lastMessageSenderId).toBe(alice.id);
    expect(conversation.lastMessageAtMs).toBe(message.createdAtMs);
  });

  it('rejects a blank message before any write happens', async () => {
    await messageService.loadAll(alice.id);
    await expect(messageService.send(alice, bob, '   ')).rejects.toThrow(
      'A message cannot be empty.'
    );
    expect(fake.calls.sendMessage).toBeUndefined();
  });

  it('never marks my own outgoing message as unread for me', async () => {
    await messageService.loadAll(alice.id);
    await messageService.send(alice, bob, 'ping');

    expect(messageService.store.get().conversations[0].unreadCount).toBe(0);
    expect(fake.cursorRecord(`${PAIR}_${alice.id}`)).toBeGreaterThan(0);
  });

  it('carries a code snippet through to the stored message', async () => {
    await messageService.loadAll(alice.id);

    await messageService.send(alice, bob, 'see this', { language: 'cpp', code: 'int x;' });

    const [stored] = fake.messageRecords(PAIR);
    expect(stored.codeSnippet).toEqual({ language: 'cpp', code: 'int x;' });
  });
});

describe('unread state', () => {
  it('is unread only when someone else spoke after my read cursor', async () => {
    seedIncoming();

    await messageService.loadAll(alice.id);

    expect(messageService.store.get().conversations[0].unreadCount).toBe(1);
  });

  it('clears once I open the thread, by moving only my own cursor', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);

    await messageService.open(PAIR);

    expect(messageService.store.get().conversations[0].unreadCount).toBe(0);
    expect(fake.cursorRecord(`${PAIR}_${alice.id}`)).toBeGreaterThan(0);
    // Bob's cursor is untouched: a read receipt can only be written by its
    // owner, which is exactly what `firestore.rules` enforces.
    expect(fake.cursorRecord(`${PAIR}_${bob.id}`)).toBeUndefined();
  });

  it('never moves a cursor backwards', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    const first = await messageService.markRead(PAIR);
    const earlier = await messageService.markRead(PAIR);

    expect(earlier).toBe(first);
  });
});

describe('failures', () => {
  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await messageService.loadAll(alice.id);

    expect(messageService.store.get().status).toBe('error');
    expect(messageService.store.get().error).toBe(DENIED_COPY);
    expect(messageService.store.get().conversations).toEqual([]);
  });

  it('returns to loading on bootstrap so a logout never leaks a thread', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    expect(messageService.store.get().conversations).toHaveLength(1);

    messageService.bootstrap();

    expect(messageService.store.get()).toMatchObject({
      status: 'loading',
      conversations: [],
      messages: [],
      activeConversationId: null
    });
  });
});

const CAROL_PAIR = 'uid_alice_uid_carol';

/** Lets the fake's promise chains (and Firestore's first snapshot) land. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('realtime streams', () => {
  it('moves the conversation list from the live stream, never a refetch', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    const reads = fake.calls.listConversations;

    await fake.sendMessage({
      conversationId: PAIR,
      senderId: bob.id,
      receiverId: alice.id,
      text: 'are you up?'
    });

    expect(fake.calls.listConversations).toBe(reads);
    expect(messageService.store.get().conversations[0].lastMessage?.text).toBe('are you up?');
  });

  it('streams a peer message into the open thread without ever listing', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    await messageService.open(PAIR);
    // History arrives on the subscription's first snapshot: the one-shot
    // `listMessages` read is gone from the path entirely.
    expect(fake.calls.listMessages ?? 0).toBe(0);

    await fake.sendMessage({
      conversationId: PAIR,
      senderId: bob.id,
      receiverId: alice.id,
      text: 'second one'
    });

    expect(fake.calls.listMessages ?? 0).toBe(0);
    expect(
      messageService.store.get()
        .messages.filter(message => message.conversationId === PAIR)
        .map(message => message.text)
    ).toEqual(['did you finish the lab?', 'second one']);
  });

  it('opens one message stream no matter how often the thread is selected', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);

    await messageService.open(PAIR);
    await messageService.open(PAIR);
    await messageService.startConversation(bob.id);

    expect(fake.activeStreams().filter(stream => stream.kind === 'messages')).toEqual([
      { kind: 'messages', key: PAIR }
    ]);
    expect(messageService.getLiveStreams()).toEqual([
      'conversations',
      'cursors',
      `messages:${PAIR}`
    ]);
  });

  it('replaces the previous thread stream when switching instead of stacking', async () => {
    seedIncoming();
    fake.seedConversations([
      {
        id: CAROL_PAIR,
        participants: [alice.id, carol.id],
        createdAtMs: 1_000,
        updatedAtMs: 3_000,
        lastMessageAtMs: 4_000,
        lastMessageSenderId: carol.id,
        lastMessagePreview: 'yo'
      }
    ]);
    await messageService.loadAll(alice.id);

    await messageService.open(PAIR);
    await messageService.open(CAROL_PAIR);

    expect(fake.activeStreams().filter(stream => stream.kind === 'messages')).toEqual([
      { kind: 'messages', key: CAROL_PAIR }
    ]);
  });

  it('ignores a snapshot for a thread the user has already left', async () => {
    seedIncoming();
    fake.seedConversations([
      {
        id: CAROL_PAIR,
        participants: [alice.id, carol.id],
        createdAtMs: 1_000,
        updatedAtMs: 3_000,
        lastMessageAtMs: 4_000,
        lastMessageSenderId: carol.id,
        lastMessagePreview: 'yo'
      }
    ]);
    await messageService.loadAll(alice.id);
    await messageService.open(PAIR);
    await messageService.open(CAROL_PAIR);

    await fake.sendMessage({
      conversationId: PAIR,
      senderId: bob.id,
      receiverId: alice.id,
      text: 'too late for this thread'
    });

    expect(
      messageService.store.get().messages.some(message => message.text === 'too late for this thread')
    ).toBe(false);
  });

  it('raises the unread badge when a peer speaks in a thread nobody has open', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    expect(messageService.store.get().conversations[0].unreadCount).toBe(1);
    expect(messageService.store.get().totalUnread).toBe(1);

    await fake.sendMessage({
      conversationId: PAIR,
      senderId: bob.id,
      receiverId: alice.id,
      text: 'and one more'
    });
    await flush();

    expect(messageService.store.get().conversations[0].unreadCount).toBe(2);
    expect(messageService.store.get().totalUnread).toBe(2);
  });

  it('leaves the last snapshot on screen when a stream fails', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    expect(messageService.store.get().status).toBe('ready');

    fake.failStreams(new Error('connection lost'));

    const state = messageService.store.get();
    expect(state.status).toBe('ready');
    expect(state.conversations).toHaveLength(1);
    expect(state.error).toBeTruthy();
  });

  it('tears every stream down on bootstrap so a logout leaks nothing', async () => {
    seedIncoming();
    await messageService.loadAll(alice.id);
    await messageService.open(PAIR);
    expect(fake.activeStreamCount()).toBe(3);

    messageService.bootstrap();

    expect(fake.activeStreamCount()).toBe(0);
    expect(messageService.getLiveStreams()).toEqual([]);
  });
});
