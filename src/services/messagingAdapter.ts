import type { CodeSnippet, Message } from '../types';
import { firebaseMessagingAdapter } from './firebaseMessagingAdapter';

/**
 * Messaging-domain persistence contract.
 *
 * Layering: pages -> context/hooks -> `messageService` -> THIS interface ->
 * `firebaseMessagingAdapter` -> Firebase SDK. Nothing above this line
 * imports the Firebase SDK; tests substitute `fakeMessagingAdapter`.
 *
 * Storage (see `firestore.rules` for the enforced half):
 *
 *   conversations/{a_b}                       one doc per member pair
 *   conversations/{a_b}/messages/{msgId}      immutable message documents
 *   conversationReads/{a_b}_{uid}             each member's own read cursor
 *
 * The conversation document id is `[a, b].sort().join('_')`, so there is
 * structurally no way to create the same thread twice - the rules rebuild
 * the identical id from `participants` and refuse a mismatch.
 */
export interface ConversationRecord {
  /** `{a_b}` - the document id. */
  id: string;
  /** `[a, b]`, ascending; exactly what the rules pin to the id. */
  participants: string[];
  createdAtMs: number;
  updatedAtMs: number;
  lastMessageAtMs: number;
  lastMessageSenderId: string;
  lastMessagePreview: string;
}

export interface MessageDraft {
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  /** Written as an explicit `null` when absent (the rules read the field). */
  codeSnippet?: CodeSnippet | null;
}

/**
 * The canonical id for a pair of members: both uids, ascending, joined by
 * `_`. Pure and symmetric, so client and rules always agree.
 */
export function conversationIdFor(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

/**
 * Stops one realtime subscription. Idempotent by contract: calling it twice
 * must not throw, so a React cleanup function and a service-level teardown
 * can both run without coordinating.
 */
export type Unsubscribe = () => void;

/** Callbacks every realtime subscription on this adapter reports through. */
export interface StreamHandlers<T> {
  /**
   * Delivers the *complete, authoritative* result of the query on every
   * change - never a delta. Applying it wholesale is what makes duplicates,
   * deletions and reordering impossible to get wrong above this line.
   */
  onData: (value: T) => void;
  /** Typed Firestore failure (`permission-denied`, `unavailable`, ...). */
  onError: (error: unknown) => void;
}

export interface MessagingAdapter {
  /**
   * Every conversation the actor belongs to. Unsorted: ordering is a
   * presentation concern and lives above this line, which is also why the
   * Firestore query needs no composite index.
   */
  listConversations(actorId: string): Promise<ConversationRecord[]>;
  /**
   * Returns the existing thread with the peer, creating it if missing.
   * Creation is a standalone write so the first `sendMessage` batch sees a
   * pre-existing parent document (`get()` inside the rules must succeed).
   */
  ensureConversation(actorId: string, peerId: string): Promise<ConversationRecord>;
  /** Messages of a thread, ascending by `createdAtMs`. */
  listMessages(conversationId: string): Promise<Message[]>;
  /**
   * Atomically appends the message and advances the conversation's
   * bookkeeping. `text` is trimmed to 1..4000 chars by the caller.
   */
  sendMessage(draft: MessageDraft): Promise<Message>;
  /** `{conversationId: lastReadAtMs}` for every cursor the actor owns. */
  listReadCursors(actorId: string): Promise<Record<string, number>>;
  /**
   * Moves the actor's own cursor forward to `atMs` (never backward - the
   * rules reject a rewind). Returns the resulting cursor value.
   */
  markConversationRead(conversationId: string, actorId: string, atMs: number): Promise<number>;
  /** Removes a message the actor authored (or a moderator). */
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
  /** Removes a thread the actor belongs to, including its messages. */
  deleteConversation(conversationId: string): Promise<void>;

  // ------------------------------------------------------- realtime (Phase 2/3)
  /**
   * Live view of the actor's conversation list: a new message from anyone in
   * any of their threads arrives here without a refresh. The query is the
   * same `array-contains` the one-shot read uses, so security and cost are
   * unchanged - only the transport becomes a stream.
   */
  subscribeToConversations(
    actorId: string,
    handlers: StreamHandlers<ConversationRecord[]>
  ): Unsubscribe;
  /** Live view of `{conversationId: lastReadAtMs}` for the actor only. */
  subscribeToReadCursors(
    actorId: string,
    handlers: StreamHandlers<Record<string, number>>
  ): Unsubscribe;
  /**
   * Live view of one thread's messages, ascending, bounded by the same
   * window as `listMessages`. Exactly one may exist per conversation - see
   * `messageService`, which owns the uniqueness guarantee.
   */
  subscribeToMessages(
    conversationId: string,
    handlers: StreamHandlers<Message[]>
  ): Unsubscribe;

  /**
   * Exact number of messages in a thread written after `sinceMs`, counted
   * inside Firestore. Used for unread badges on threads whose history the
   * client is not holding: one bounded RPC instead of downloading a thread
   * nobody opened.
   */
  countMessagesSince(conversationId: string, sinceMs: number): Promise<number>;
}

let overrideAdapter: MessagingAdapter | null = null;

/** The messaging backend the app runs against (Firebase unless overridden). */
export function getMessagingAdapter(): MessagingAdapter {
  return overrideAdapter ?? firebaseMessagingAdapter;
}

/** Injection seam for tests and local tooling; `null` restores Firebase. */
export function setMessagingAdapter(adapter: MessagingAdapter | null): void {
  overrideAdapter = adapter;
}
