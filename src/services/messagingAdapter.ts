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
