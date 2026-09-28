import { ServiceError } from '../../lib/errors';
import { relativeTime } from '../../lib/time';
import type { Message } from '../../types';
import {
  conversationIdFor,
  type ConversationRecord,
  type MessageDraft,
  type MessagingAdapter,
  type StreamHandlers,
  type Unsubscribe
} from '../messagingAdapter';

/**
 * In-memory `MessagingAdapter` double.
 *
 * Reproduces the Firestore adapter's contract without a project, network
 * access or `.env.local`: one document per member pair (the duplicate
 * refusal falls out of `conversationIdFor`), immutable messages, a
 * conversation summary that only moves forward, and each member's own
 * monotonically non-decreasing read cursor.
 *
 * Inject with `setMessagingAdapter(createFakeMessagingAdapter())` and
 * restore with `setMessagingAdapter(null)`.
 */
export interface FakeMessagingAdapter extends MessagingAdapter {
  seedConversations(list: ConversationRecord[]): void;
  seedMessages(list: Message[]): void;
  /** Conversations, newest activity first, as `messageService` orders them. */
  conversationRecords(): ConversationRecord[];
  messageRecords(conversationId: string): Message[];
  cursorRecord(readId: string): number | undefined;
  /**
   * Simulates the rules refusing every read/write
   * (`permission-denied`), so the services' error path is exercised
   * without a project.
   */
  setDenied(denied: boolean): void;
  clear(): void;
  readonly calls: Record<string, number>;

  // ------------------------------------------------------------ realtime
  /** `{kind, key}` for every listener that has not been unsubscribed. */
  activeStreams(): Array<{ kind: StreamKind; key: string }>;
  /** Number of live listeners - the duplicate-subscription assertion. */
  activeStreamCount(): number;
  /** Fails every live listener, as Firestore does on a network drop. */
  failStreams(error: unknown): void;
}

/** The copy `firestoreErrors` maps `permission-denied` to. */
export const DENIED_COPY =
  'You do not have permission to do that. Contact your department administrator.';

/** Which realtime stream a listener is bound to. */
export type StreamKind = 'conversations' | 'cursors' | 'messages';

interface LiveStream {
  kind: StreamKind;
  /** `actorId` for list streams, `conversationId` for message streams. */
  key: string;
  onData: (value: unknown) => void;
  onError: (error: unknown) => void;
  active: boolean;
}

function notFound(message = 'That conversation no longer exists.'): ServiceError {
  return new ServiceError('message/not-found', message);
}

function denied(): ServiceError {
  return new ServiceError('firestore/permission-denied', DENIED_COPY);
}

export function createFakeMessagingAdapter(): FakeMessagingAdapter {
  const conversations = new Map<string, ConversationRecord>();
  const messages = new Map<string, Message[]>();
  const cursors = new Map<string, number>();
  const calls: Record<string, number> = {};
  let deniedMode = false;

  const count = (name: string): void => {
    calls[name] = (calls[name] ?? 0) + 1;
  };

  const guard = (): void => {
    if (deniedMode) throw denied();
  };

  const streams: LiveStream[] = [];

  /**
   * Registers a listener and returns its unsubscribe. Mirrors Firestore:
   * the caller is responsible for holding exactly one per scope, and the
   * unsubscribe must be safe to call twice.
   */
  function open(
    kind: StreamKind,
    key: string,
    handlers: StreamHandlers<never>,
    initial: unknown
  ): Unsubscribe {
    if (deniedMode) {
      // Firestore reports a refused listener through `onError`, never as a
      // synchronous throw, so the service's async error path is what runs.
      queueMicrotask(() => handlers.onError(denied()));
      return () => undefined;
    }
    const entry: LiveStream = {
      kind,
      key,
      onData: handlers.onData as (value: unknown) => void,
      onError: handlers.onError as (error: unknown) => void,
      active: true
    };
    streams.push(entry);
    queueMicrotask(() => {
      if (entry.active) entry.onData(initial);
    });
    return () => {
      entry.active = false;
      const index = streams.indexOf(entry);
      if (index !== -1) streams.splice(index, 1);
    };
  }

  /** Pushes the current truth to every listener bound to `kind`/`key`. */
  function emit(kind: StreamKind, key?: string): void {
    streams
      .filter(stream => stream.active && stream.kind === kind && (key === undefined || stream.key === key))
      .forEach(stream => {
        try {
          if (kind === 'conversations') {
            stream.onData(
              adapter
                .conversationRecords()
                .filter(conversation => conversation.participants.includes(stream.key))
            );
          } else if (kind === 'cursors') {
            const result: Record<string, number> = {};
            cursors.forEach((value, readId) => {
              if (readId.endsWith(`_${stream.key}`)) result[readId] = value;
            });
            stream.onData(result);
          } else {
            stream.onData(adapter.messageRecords(stream.key));
          }
        } catch (error) {
          stream.onError(error);
        }
      });
  }

  function require(id: string): ConversationRecord {
    const conversation = conversations.get(id);
    if (!conversation) throw notFound();
    return conversation;
  }

  const adapter: FakeMessagingAdapter = {
    calls,

    clear(): void {
      conversations.clear();
      messages.clear();
      cursors.clear();
      deniedMode = false;
      streams.splice(0, streams.length);
    },

    setDenied(denied: boolean): void {
      deniedMode = denied;
    },

    activeStreams(): Array<{ kind: StreamKind; key: string }> {
      return streams.map(stream => ({ kind: stream.kind, key: stream.key }));
    },

    activeStreamCount(): number {
      return streams.length;
    },

    failStreams(error: unknown): void {
      streams.slice().forEach(stream => stream.onError(error));
    },

    seedConversations(list: ConversationRecord[]): void {
      list.forEach(conversation => conversations.set(conversation.id, { ...conversation, participants: [...conversation.participants] }));
    },

    seedMessages(list: Message[]): void {
      list.forEach(message => {
        const bucket = messages.get(message.conversationId) ?? [];
        bucket.push({ ...message });
        messages.set(message.conversationId, bucket);
      });
      messages.forEach(bucket => bucket.sort((a, b) => a.createdAtMs - b.createdAtMs));
    },

    conversationRecords(): ConversationRecord[] {
      return Array.from(conversations.values())
        .slice()
        .sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs || b.updatedAtMs - a.updatedAtMs)
        .map(conversation => ({ ...conversation, participants: [...conversation.participants] }));
    },

    messageRecords(conversationId: string): Message[] {
      return (messages.get(conversationId) ?? []).map(message => ({ ...message }));
    },

    cursorRecord(readId: string): number | undefined {
      return cursors.get(readId);
    },

    async listConversations(actorId: string): Promise<ConversationRecord[]> {
      count('listConversations');
      guard();
      return adapter
        .conversationRecords()
        .filter(conversation => conversation.participants.includes(actorId));
    },

    async ensureConversation(actorId: string, peerId: string): Promise<ConversationRecord> {
      count('ensureConversation');
      guard();
      if (!actorId || !peerId || actorId === peerId) {
        throw new ServiceError('message/invalid', 'Pick another campus member to message.');
      }
      const id = conversationIdFor(actorId, peerId);
      const existing = conversations.get(id);
      if (existing) return { ...existing, participants: [...existing.participants] };

      const now = Date.now();
      const participants = [actorId, peerId].slice().sort();
      const created: ConversationRecord = {
        id,
        // Stored explicitly: a uid may contain `_`, so parsing the id back
        // apart would fabricate members (exactly what the rules would refuse).
        participants,
        createdAtMs: now,
        updatedAtMs: now,
        lastMessageAtMs: 0,
        lastMessageSenderId: '',
        lastMessagePreview: ''
      };
      conversations.set(id, created);
      messages.set(id, []);
      // A brand-new thread is news to BOTH members, not just the creator.
      [actorId, peerId].forEach(member => emit('conversations', member));
      return { ...created, participants: [...created.participants] };
    },

    async listMessages(conversationId: string): Promise<Message[]> {
      count('listMessages');
      guard();
      if (!conversations.has(conversationId)) throw notFound();
      return adapter.messageRecords(conversationId);
    },

    async sendMessage(draft: MessageDraft): Promise<Message> {
      count('sendMessage');
      guard();
      const conversation = require(draft.conversationId);
      if (!draft.text.trim()) {
        throw new ServiceError('message/invalid', 'A message cannot be empty.');
      }
      if (!conversation.participants.includes(draft.receiverId)) {
        throw new ServiceError('message/invalid', 'That member is not in this conversation.');
      }

      const createdAtMs = Date.now();
      const message: Message = {
        id: `msg-${createdAtMs}-${messages.get(draft.conversationId)?.length ?? 0}`,
        conversationId: draft.conversationId,
        senderId: draft.senderId,
        receiverId: draft.receiverId,
        text: draft.text,
        timestamp: relativeTime(createdAtMs),
        createdAtMs,
        read: false,
        codeSnippet: draft.codeSnippet ? { ...draft.codeSnippet } : undefined
      };

      const bucket = messages.get(draft.conversationId) ?? [];
      bucket.push(message);
      messages.set(draft.conversationId, bucket);

      conversations.set(draft.conversationId, {
        ...conversation,
        updatedAtMs: createdAtMs,
        lastMessageAtMs: createdAtMs,
        lastMessageSenderId: draft.senderId,
        lastMessagePreview: draft.text.replace(/\s+/g, ' ').trim().slice(0, 200)
      });

      emit('messages', draft.conversationId);
      conversation.participants.forEach(member => emit('conversations', member));

      return { ...message };
    },

    async listReadCursors(actorId: string): Promise<Record<string, number>> {
      count('listReadCursors');
      guard();
      const result: Record<string, number> = {};
      cursors.forEach((value, readId) => {
        if (readId.endsWith(`_${actorId}`)) result[readId] = value;
      });
      return result;
    },

    async markConversationRead(conversationId: string, actorId: string, atMs: number): Promise<number> {
      count('markConversationRead');
      guard();
      if (!conversations.has(conversationId)) throw notFound();
      const readId = `${conversationId}_${actorId}`;
      const current = cursors.get(readId) ?? 0;
      const next = Math.max(current, atMs);
      cursors.set(readId, next);
      emit('cursors', actorId);
      emit('messages', conversationId);
      return next;
    },

    async deleteMessage(conversationId: string, messageId: string): Promise<void> {
      count('deleteMessage');
      guard();
      const bucket = messages.get(conversationId) ?? [];
      messages.set(
        conversationId,
        bucket.filter(message => message.id !== messageId)
      );
      emit('messages', conversationId);
    },

    async deleteConversation(conversationId: string): Promise<void> {
      count('deleteConversation');
      guard();
      const members = conversations.get(conversationId)?.participants ?? [];
      conversations.delete(conversationId);
      messages.delete(conversationId);
      Array.from(cursors.keys())
        .filter(readId => readId.startsWith(`${conversationId}_`))
        .forEach(readId => cursors.delete(readId));
      members.forEach(member => emit('conversations', member));
    },

    // -------------------------------------------------------- realtime

    subscribeToConversations(
      actorId: string,
      handlers: StreamHandlers<ConversationRecord[]>
    ): Unsubscribe {
      count('subscribeToConversations');
      const initial = adapter
        .conversationRecords()
        .filter(conversation => conversation.participants.includes(actorId));
      return open('conversations', actorId, handlers as StreamHandlers<never>, initial);
    },

    subscribeToReadCursors(
      actorId: string,
      handlers: StreamHandlers<Record<string, number>>
    ): Unsubscribe {
      count('subscribeToReadCursors');
      const initial: Record<string, number> = {};
      cursors.forEach((value, readId) => {
        if (readId.endsWith(`_${actorId}`)) initial[readId] = value;
      });
      return open('cursors', actorId, handlers as StreamHandlers<never>, initial);
    },

    subscribeToMessages(conversationId: string, handlers: StreamHandlers<Message[]>): Unsubscribe {
      count('subscribeToMessages');
      return open('messages', conversationId, handlers as StreamHandlers<never>, adapter.messageRecords(conversationId));
    },

    async countMessagesSince(conversationId: string, sinceMs: number): Promise<number> {
      count('countMessagesSince');
      guard();
      return adapter.messageRecords(conversationId).filter(message => message.createdAtMs > sinceMs).length;
    }
  };

  return adapter;
}
