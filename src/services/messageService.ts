import { Conversation, Message, User } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { relativeTime } from '../lib/time';
import { mapFirestoreError } from './firestoreErrors';
import {
  conversationIdFor,
  getMessagingAdapter,
  type ConversationRecord
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
  activeConversationId: string | null;
  status: LoadStatus;
  error?: string;
}

const EMPTY_STATE: MessageState = {
  records: [],
  cursors: {},
  conversations: [],
  messages: [],
  activeConversationId: null,
  status: 'loading'
};

const store = createStore<MessageState>(EMPTY_STATE);

let actorId: string | null = null;
let directorySnapshot: User[] = [];
let unsubscribedFromDirectory = false;

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
  directory: User[]
): Conversation {
  const peerId = record.participants.find(id => id !== uid) ?? '';
  const lastReadAtMs = readCursor(cursors, record.id);
  // Unread only when someone else spoke after my own cursor - I can never
  // make my own thread look unread, and a cursor only ever moves forward.
  const incoming = record.lastMessageAtMs > lastReadAtMs && record.lastMessageSenderId !== uid;

  return {
    id: record.id,
    participants: record.participants,
    participant: directory.find(user => user.id === peerId) ?? null,
    lastMessage: lastMessageOf(record, peerId),
    unreadCount: incoming ? 1 : 0,
    lastMessageAtMs: record.lastMessageAtMs,
    lastReadAtMs
  };
}

/** Re-derives `conversations` from records + cursors + the user directory. */
function recompute(): void {
  const uid = actorId;
  if (!uid) return;
  const { records, cursors } = store.get();
  const directory = directorySnapshot;
  store.set(prev => ({
    ...prev,
    records,
    cursors,
    conversations: records.map(record => toConversation(record, uid, cursors, directory))
  }));
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

/**
 * Direct messaging.
 *
 * Persistence is `MessagingAdapter` -> Firestore: one conversation document
 * per member pair (`conversations/{a_b}`), immutable messages beneath it and
 * each member's own read cursor in `conversationReads/{a_b}_{uid}`. The
 * document id *is* the duplicate guard, so "start a new conversation" is
 * idempotent by construction rather than by a read-then-write race.
 */
export const messageService = {
  store,

  bootstrap(): void {
    actorId = null;
    directorySnapshot = [];
    store.set({ ...EMPTY_STATE });
  },

  /**
   * Reads conversations + the actor's read cursors for this session.
   * Callers must be signed in: the rules only let an approved member list
   * threads they belong to.
   */
  async loadAll(uid: string): Promise<void> {
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

  /** Selects a conversation, loads its history and advances my read cursor. */
  async open(conversationId: string): Promise<void> {
    store.set(prev => ({ ...prev, activeConversationId: conversationId }));
    try {
      const messages = await getMessagingAdapter().listMessages(conversationId);
      store.set(prev => ({
        ...prev,
        messages: mergeMessages(prev.messages, messages)
      }));
      await messageService.markRead(conversationId);
    } catch (error) {
      throw mapFirestoreError(error);
    }
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
      store.set(prev => ({ ...prev, messages: mergeMessages(prev.messages, [message]) }));
      await messageService.markRead(conversationId);
      store.set(prev => ({ ...prev, activeConversationId: conversationId }));
      return message;
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  setActiveConversation(id: string | null): void {
    store.set(prev => ({ ...prev, activeConversationId: id }));
  },

  /** Test/diagnostic view of the stored read cursors. */
  getReadCursors(): Record<string, number> {
    return { ...store.get().cursors };
  }
};

function requireActor(): string {
  if (!actorId) throw new ServiceError('auth/required', 'Sign in to message another member.');
  return actorId;
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  existing.forEach(message => byId.set(message.id, message));
  incoming.forEach(message => byId.set(message.id, message));
  return Array.from(byId.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
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
