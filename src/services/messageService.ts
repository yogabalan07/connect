import { Conversation, Message, User } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { relativeTime } from '../lib/time';
import { mapFirestoreError } from './firestoreErrors';
import {
  conversationIdFor,
  getMessagingAdapter,
  type ConversationRecord,
  type Unsubscribe
} from './messagingAdapter';
import { userService } from './userService';

interface MessageState {
  /** Raw conversation documents, ordered newest activity first. */
  records: ConversationRecord[];
  /** `{conversationId: lastReadAtMs}` for the acting member. */
  cursors: Record<string, number>;
  /** `records` projected with peers resolved and unread derived. */
  conversations: Conversation[];
  messages: Message[];
  /** `{conversationId: messages waiting for me}` - exact, never guessed. */
  unread: Record<string, number>;
  /** Sum of `unread`, so the app can badge the inbox as a whole. */
  totalUnread: number;
  activeConversationId: string | null;
  status: LoadStatus;
  error?: string;
}

const EMPTY_STATE: MessageState = {
  records: [],
  cursors: {},
  conversations: [],
  messages: [],
  unread: {},
  totalUnread: 0,
  activeConversationId: null,
  status: 'loading'
};

const store = createStore<MessageState>(EMPTY_STATE);

let actorId: string | null = null;
let directorySnapshot: User[] = [];
let unsubscribedFromDirectory = false;

/**
 * Exactly one live listener per scope. A conversation switch first tears the
 * previous thread down, then subscribes - so there is structurally no way to
 * end up with two listeners fighting over the same message list.
 */
let stopListListeners: Unsubscribe | null = null;
let stopMessageListener: Unsubscribe | null = null;
let listeningTo: string | null = null;

/** Threads whose history has arrived this session (enables a local count). */
const loadedConversations = new Set<string>();
/** `{conversationId: {key, count}}` - one count per cursor/activity pair. */
const unreadCache = new Map<string, { key: string; count: number }>();
const unreadInFlight = new Set<string>();

function readCursor(cursors: Record<string, number>, id: string): number {
  return cursors[id] ?? 0;
}

/**
 * Builds the synthetic "last message" shown in the conversation list.
 *
 * The list only needs the preview and its timestamp, both of which live on
 * the conversation document - so the sidebar renders without pulling a
 * single message subcollection for a thread nobody opened.
 */
function lastMessageOf(record: ConversationRecord, peerId: string): Message | null {
  if (record.lastMessageAtMs <= 0) return null;
  return {
    id: `${record.id}::last`,
    conversationId: record.id,
    senderId: record.lastMessageSenderId,
    receiverId: peerId,
    text: record.lastMessagePreview,
    timestamp: relativeTime(record.lastMessageAtMs),
    createdAtMs: record.lastMessageAtMs,
    read: true
  };
}

function toConversation(
  record: ConversationRecord,
  uid: string,
  cursors: Record<string, number>,
  directory: User[],
  unreadCount: number
): Conversation {
  const peerId = record.participants.find(id => id !== uid) ?? '';

  return {
    id: record.id,
    participants: record.participants,
    participant: directory.find(user => user.id === peerId) ?? null,
    lastMessage: lastMessageOf(record, peerId),
    unreadCount,
    lastMessageAtMs: record.lastMessageAtMs,
    lastReadAtMs: readCursor(cursors, record.id)
  };
}

/**
 * How many messages in `record` are still waiting for `uid`.
 *
 * Three cases, in order of cost:
 *  1. nothing after my cursor, or I spoke last -> `0` (sending can never
 *     make my own thread look unread, and `send` moves my cursor past my
 *     own message in the same round trip);
 *  2. the thread is already on screen -> counted locally from the history
 *     the listener holds, so the badge is exact and instant;
 *  3. otherwise -> one bounded Firestore count query, cached against the
 *     exact `(cursor, lastMessageAtMs)` pair that produced it. Reading the
 *     whole thread would be the expensive alternative; this stays a single
 *     aggregate and only re-runs when something actually moved.
 */
function unreadFor(
  record: ConversationRecord,
  uid: string,
  cursors: Record<string, number>,
  messages: Message[]
): number {
  const cursor = readCursor(cursors, record.id);
  if (record.lastMessageAtMs <= cursor) return 0;
  if (record.lastMessageSenderId === uid) return 0;

  if (loadedConversations.has(record.id)) {
    return messages.filter(
      message =>
        message.conversationId === record.id &&
        message.createdAtMs > cursor &&
        message.senderId !== uid
    ).length;
  }

  const key = `${cursor}|${record.lastMessageAtMs}`;
  const cached = unreadCache.get(record.id);
  if (cached && cached.key === key) return cached.count;
  scheduleUnreadCount(record.id, cursor, key);
  // While the aggregate is in flight the activity itself already proves at
  // least one unread message, so the badge never flickers back to zero.
  return cached ? cached.count : 1;
}

function scheduleUnreadCount(conversationId: string, cursor: number, key: string): void {
  const token = `${conversationId}|${key}`;
  if (unreadInFlight.has(token)) return;
  unreadInFlight.add(token);
  getMessagingAdapter()
    .countMessagesSince(conversationId, cursor)
    .then(count => {
      unreadCache.set(conversationId, { key, count });
    })
    .catch(() => {
      // A refused aggregate keeps the optimistic `1` from `unreadFor`; the
      // inbox stays usable and the badge stays honest about "something is
      // new" rather than inventing a number.
    })
    .finally(() => {
      unreadInFlight.delete(token);
      if (actorId) recompute();
    });
}

/** Re-derives `conversations` from records + cursors + the user directory. */
function recompute(): void {
  const uid = actorId;
  if (!uid) return;
  const { records, cursors, messages } = store.get();
  const directory = directorySnapshot;
  const unread: Record<string, number> = {};
  let totalUnread = 0;

  const conversations = records.map(record => {
    const count = unreadFor(record, uid, cursors, messages);
    unread[record.id] = count;
    totalUnread += count;
    return toConversation(record, uid, cursors, directory, count);
  });

  store.set(prev => ({ ...prev, records, cursors, unread, totalUnread, conversations }));
}

function rememberRecords(records: ConversationRecord[]): void {
  store.set(prev => ({ ...prev, records: sortRecords(records) }));
  recompute();
}

function sortRecords(records: ConversationRecord[]): ConversationRecord[] {
  return records
    .slice()
    .sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs || b.updatedAtMs - a.updatedAtMs);
}

function upsertRecord(record: ConversationRecord): void {
  const records = store.get().records;
  const index = records.findIndex(item => item.id === record.id);
  if (index === -1) {
    rememberRecords([...records, record]);
    return;
  }
  const next = records.slice();
  next[index] = record;
  rememberRecords(next);
}

/** Replaces one thread's history wholesale - adds, edits and deletes alike. */
function applyMessages(conversationId: string, incoming: Message[]): void {
  store.set(prev => ({
    ...prev,
    messages: [...prev.messages.filter(message => message.conversationId !== conversationId), ...incoming]
  }));
  recompute();
}

/**
 * Optimistic local echo for a message we just wrote: merged by id so the
 * same document can arrive from the write *and* the listener without ever
 * rendering twice.
 */
function mergeIntoConversation(conversationId: string, incoming: Message[]): void {
  store.set(prev => {
    const byId = new Map<string, Message>();
    prev.messages
      .filter(message => message.conversationId === conversationId)
      .forEach(message => byId.set(message.id, message));
    incoming.forEach(message => byId.set(message.id, message));
    const bucket = Array.from(byId.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
    return {
      ...prev,
      messages: [...prev.messages.filter(message => message.conversationId !== conversationId), ...bucket]
    };
  });
  recompute();
}

/**
 * A stream failure. The last good snapshot stays on screen: a dropped
 * connection must not blank an inbox somebody is reading. The typed message
 * is recorded and exposed (never swallowed), and only a failure that
 * happened before any data arrived promotes the store to `error`.
 */
function onStreamError(error: unknown): void {
  const mapped = mapFirestoreError(error);
  store.set(prev => ({
    ...prev,
    status: prev.status === 'loading' ? 'error' : prev.status,
    error: mapped.message
  }));
}

function stopRealtime(): void {
  if (stopListListeners) stopListListeners();
  stopListListeners = null;
  if (stopMessageListener) stopMessageListener();
  stopMessageListener = null;
  listeningTo = null;
  loadedConversations.clear();
  unreadCache.clear();
  unreadInFlight.clear();
}

/**
 * Subscribes to one thread, replacing whatever was open before.
 *
 * The `listeningTo` check is the duplicate guard: clicking the same row
 * twice, or React re-running a mount effect, must not stack a second
 * listener on a conversation that is already streaming.
 */
function listenToMessages(conversationId: string): void {
  if (listeningTo === conversationId && stopMessageListener) return;

  if (stopMessageListener) stopMessageListener();
  stopMessageListener = null;
  listeningTo = null;

  const stop = getMessagingAdapter().subscribeToMessages(conversationId, {
    onData: incoming => {
      // Ignore a snapshot from a thread the user has already navigated away
      // from: by the time it lands, `listeningTo` has moved on.
      if (listeningTo !== conversationId) return;
      loadedConversations.add(conversationId);
      applyMessages(conversationId, incoming);
    },
    onError: error => {
      if (listeningTo !== conversationId) return;
      onStreamError(error);
    }
  });

  listeningTo = conversationId;
  stopMessageListener = stop;
}

/** Starts the inbox + read-receipt streams for `uid`, replacing any prior. */
function startListListeners(uid: string): void {
  if (stopListListeners) stopListListeners();
  stopListListeners = null;

  const adapter = getMessagingAdapter();
  const stopConversations = adapter.subscribeToConversations(uid, {
    onData: records => {
      if (actorId !== uid) return;
      rememberRecords(records);
    },
    onError: error => {
      if (actorId !== uid) return;
      onStreamError(error);
    }
  });
  const stopCursors = adapter.subscribeToReadCursors(uid, {
    onData: cursors => {
      if (actorId !== uid) return;
      store.set(prev => ({ ...prev, cursors }));
      recompute();
    },
    onError: error => {
      if (actorId !== uid) return;
      onStreamError(error);
    }
  });

  stopListListeners = () => {
    stopConversations();
    stopCursors();
  };
}

/**
 * Direct messaging.
 *
 * Persistence is `MessagingAdapter` -> Firestore: one conversation document
 * per member pair (`conversations/{a_b}`), immutable messages beneath it and
 * each member's own read cursor in `conversationReads/{a_b}_{uid}`. The
 * document id *is* the duplicate guard, so "start a new conversation" is
 * idempotent by construction rather than by a read-then-write race.
 *
 * Realtime: `loadAll` opens two streams for the session (conversation list
 * and my read receipts) and `open` opens exactly one message stream, which
 * it replaces on every switch. There is no polling anywhere - every update
 * arrives as a Firestore `onSnapshot` callback delivered by the adapter.
 */
export const messageService = {
  store,

  bootstrap(): void {
    stopRealtime();
    actorId = null;
    directorySnapshot = [];
    store.set({ ...EMPTY_STATE });
  },

  /**
   * Reads conversations + the actor's read cursors for this session, then
   * leaves both streams open so the list keeps moving on its own.
   * Callers must be signed in: the rules only let an approved member list
   * threads they belong to.
   */
  async loadAll(uid: string): Promise<void> {
    // A re-login (or a second `loadAll` in one session) must not stack a
    // second pair of listeners on the same queries.
    if (stopListListeners) stopListListeners();
    stopListListeners = null;

    actorId = uid;
    // Snapshot the directory as it stands right now: the subscription below
    // only fires on *subsequent* directory updates, so a directory that
    // loaded first would otherwise leave every peer unresolved.
    directorySnapshot = userService.store.get().users;
    subscribeToDirectory();
    try {
      const adapter = getMessagingAdapter();
      const [records, cursors] = await Promise.all([
        adapter.listConversations(uid),
        adapter.listReadCursors(uid)
      ]);
      store.set(prev => ({ ...prev, records: sortRecords(records), cursors }));
      recompute();
      store.set(prev => ({ ...prev, status: 'ready', error: undefined }));
      startListListeners(uid);
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
  },

  /**
   * Opens (or creates) the thread with a peer and selects it.
   *
   * Idempotent: calling it for an existing pair returns the same document,
   * which is why the profile page's "Message" button can always land here
   * without ever minting a second conversation.
   */
  async startConversation(peerId: string): Promise<string> {
    const uid = requireActor();
    if (!peerId || peerId === uid) {
      throw new ServiceError('message/invalid', 'Pick another campus member to message.');
    }
    try {
      const record = await getMessagingAdapter().ensureConversation(uid, peerId);
      upsertRecord(record);
      await messageService.open(record.id);
      return record.id;
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  /**
   * Selects a conversation and streams its history.
   *
   * There is no follow-up `listMessages`: the subscription's first snapshot
   * already carries the whole window, so the thread is read exactly once
   * instead of once per navigation.
   */
  async open(conversationId: string): Promise<void> {
    store.set(prev => ({ ...prev, activeConversationId: conversationId }));
    try {
      listenToMessages(conversationId);
    } catch (error) {
      throw mapFirestoreError(error);
    }
    await messageService.markRead(conversationId);
  },

  /** Stops the thread stream without touching the inbox streams. */
  stopListening(): void {
    if (stopMessageListener) stopMessageListener();
    stopMessageListener = null;
    listeningTo = null;
  },

  /**
   * Moves my own read cursor to "now". Never stored on the conversation, so
   * no client can forge a receipt on somebody else's behalf - the rules only
   * accept a write to `conversationReads/{a_b}_{uid}` by that uid.
   */
  async markRead(conversationId: string): Promise<void> {
    const uid = actorId;
    if (!uid) return;
    try {
      const next = await getMessagingAdapter().markConversationRead(
        conversationId,
        uid,
        Date.now()
      );
      store.set(prev => ({ ...prev, cursors: { ...prev.cursors, [conversationId]: next } }));
      recompute();
    } catch {
      // A refused cursor is cosmetic: the thread still opens and the
      // conversation list simply shows the count it had before.
    }
  },

  /** Sends one message, creating the thread first when it does not exist. */
  async send(
    sender: User,
    receiver: User,
    text: string,
    codeSnippet?: Message['codeSnippet']
  ): Promise<Message> {
    const trimmed = (text || '').trim();
    if (!trimmed) throw new ServiceError('message/invalid', 'A message cannot be empty.');

    // The acting member is the sender; recording it keeps `recompute`
    // working even when a caller sends before the first `loadAll` resolved.
    actorId = sender.id;
    const conversationId = conversationIdFor(sender.id, receiver.id);
    try {
      const adapter = getMessagingAdapter();
      const record = await adapter.ensureConversation(sender.id, receiver.id);
      const message = await adapter.sendMessage({
        conversationId,
        senderId: sender.id,
        receiverId: receiver.id,
        text: trimmed,
        codeSnippet: codeSnippet ?? null
      });

      upsertRecord({
        ...record,
        updatedAtMs: message.createdAtMs,
        lastMessageAtMs: message.createdAtMs,
        lastMessageSenderId: message.senderId,
        lastMessagePreview: trimmed.replace(/\s+/g, ' ').slice(0, 200)
      });
      mergeIntoConversation(conversationId, [message]);
      await messageService.markRead(conversationId);
      store.set(prev => ({ ...prev, activeConversationId: conversationId }));
      return message;
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  setActiveConversation(id: string | null): void {
    store.set(prev => ({ ...prev, activeConversationId: id }));
    // Nothing is on screen any more: drop the thread stream but keep the
    // inbox streams so badges still move in the background.
    if (!id) messageService.stopListening();
  },

  /** Test/diagnostic view of the stored read cursors. */
  getReadCursors(): Record<string, number> {
    return { ...store.get().cursors };
  },

  /** Diagnostic view of which streams are currently live. */
  getLiveStreams(): string[] {
    const streams: string[] = [];
    if (stopListListeners) streams.push('conversations', 'cursors');
    if (listeningTo) streams.push(`messages:${listeningTo}`);
    return streams;
  }
};

function requireActor(): string {
  if (!actorId) throw new ServiceError('auth/required', 'Sign in to message another member.');
  return actorId;
}

/**
 * Keeps conversation peers resolved.
 *
 * The directory is read on a separate request from the conversation list, so
 * a member's card could arrive afterwards; re-deriving here means the list
 * never renders a thread whose peer is still unknown.
 */
function subscribeToDirectory(): void {
  if (unsubscribedFromDirectory) return;
  unsubscribedFromDirectory = true;
  userService.store.subscribe(() => {
    const users = userService.store.get().users;
    if (users === directorySnapshot) return;
    directorySnapshot = users;
    if (actorId) recompute();
  });
}

export function useMessagesStore(): MessageState {
  return useStore(store);
}
