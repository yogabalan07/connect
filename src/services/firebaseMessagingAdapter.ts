import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import type { CollectionReference, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '../lib/firebase';
import { relativeTime } from '../lib/time';
import type { CodeSnippet, Message } from '../types';
import {
  conversationIdFor,
  type ConversationRecord,
  type MessageDraft,
  type MessagingAdapter,
  type StreamHandlers,
  type Unsubscribe
} from './messagingAdapter';

/**
 * Firestore messaging adapter - the production backend for direct messages.
 *
 * Layout:
 *   conversations/{a_b}                     pair document + activity summary
 *   conversations/{a_b}/messages/{msgId}    immutable messages
 *   conversationReads/{a_b}_{uid}           each member's own read cursor
 *
 * Write strategy:
 * - `ensureConversation` is its own `setDoc` so a later batch's `get()`
 *   inside `firestore.rules` finds an existing parent (a document created
 *   in the same batch would make the rule's `get()` fail).
 * - `sendMessage` is a single `writeBatch`: message create + conversation
 *   activity update. Both halves are validated together, so a rejected
 *   message can never leave the conversation's counters moving.
 *
 * Read ordering is applied here rather than with a composite `orderBy`,
 * which keeps the `array-contains` / `==` queries on the automatic single
 * field indexes.
 *
 * Realtime: `subscribeTo*` wraps `onSnapshot` over the *same* queries as the
 * one-shot reads, so a listener obeys the identical `firestore.rules` checks
 * and the identical index footprint. The Firebase SDK never leaks past this
 * file - `messageService` only ever sees `Unsubscribe` callbacks.
 */
const CONVERSATIONS = 'conversations';
const CONVERSATION_READS = 'conversationReads';

/** A screen of history is enough; older pages are a future concern. */
const MAX_MESSAGES = 300;
const MAX_CURSORS = 500;
/** Firestore batches are capped at 500 writes. */
const BATCH_SIZE = 400;

function db() {
  return getFirebaseDb();
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function messagesRef(conversationId: string): CollectionReference<DocumentData> {
  return collection(db(), CONVERSATIONS, conversationId, 'messages');
}

function toConversationRecord(data: DocumentData, id: string): ConversationRecord {
  return {
    id,
    participants: Array.isArray(data.participants) ? (data.participants as string[]).slice(0, 2) : [],
    createdAtMs: num(data.createdAtMs),
    updatedAtMs: num(data.updatedAtMs),
    lastMessageAtMs: num(data.lastMessageAtMs),
    lastMessageSenderId: str(data.lastMessageSenderId),
    lastMessagePreview: str(data.lastMessagePreview)
  };
}

function toMessage(snapshot: QueryDocumentSnapshot<DocumentData>): Message {
  const data = snapshot.data();
  const createdAtMs = num(data.createdAtMs);
  const snippet = data.codeSnippet;
  return {
    id: snapshot.id,
    conversationId: str(data.conversationId),
    senderId: str(data.senderId),
    receiverId: str(data.receiverId),
    text: str(data.text),
    timestamp: relativeTime(createdAtMs),
    createdAtMs,
    // Never opened, never edited: the sender is the only one who can unsend.
    read: false,
    codeSnippet:
      snippet && typeof snippet === 'object' && typeof snippet.code === 'string'
        ? { language: str(snippet.language, 'text'), code: str(snippet.code) }
        : undefined
  };
}

/** Preview text as it is stored on the conversation summary. */
function previewOf(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 197)}...` : collapsed;
}

export const firebaseMessagingAdapter: MessagingAdapter = {
  async listConversations(actorId: string): Promise<ConversationRecord[]> {
    const snapshot = await getDocs(
      query(collection(db(), CONVERSATIONS), where('participants', 'array-contains', actorId))
    );
    return snapshot.docs.map(data => toConversationRecord(data.data(), data.id));
  },

  async ensureConversation(actorId: string, peerId: string): Promise<ConversationRecord> {
    const id = conversationIdFor(actorId, peerId);
    const reference = doc(db(), CONVERSATIONS, id);

    // Reading a thread that does not exist yet is DENIED, not reported as
    // "not found": `threadMember()` cannot test membership against a document
    // that is not there, and the rules engine refuses rather than guessing.
    // That refusal is therefore this method's signal that the pair has no
    // thread yet - it is not an error, it is the whole point of the call.
    // A genuine permission problem still surfaces, because the create below
    // is refused for exactly the same reason.
    let existing: ConversationRecord | null = null;
    try {
      const snapshot = await getDoc(reference);
      if (snapshot.exists()) existing = toConversationRecord(snapshot.data(), snapshot.id);
    } catch {
      existing = null;
    }
    if (existing) return existing;

    const now = Date.now();
    const payload: DocumentData = {
      id,
      // Ascending order is what lets the rules prove
      // `p[0] < p[1] && id == p[0] + '_' + p[1]`.
      // Stored explicitly rather than parsed back out of the id: a uid may
      // itself contain `_`, and splitting would fabricate members.
      participants: [actorId, peerId].slice().sort(),
      createdAtMs: now,
      updatedAtMs: now,
      lastMessageAtMs: 0,
      lastMessageSenderId: '',
      lastMessagePreview: ''
    };

    try {
      await setDoc(reference, payload);
    } catch {
      // Two members opened the same thread at once: whoever lost the race
      // would have turned a `create` into a full-document `update`, which the
      // rules refuse. Re-read so both sides converge on the winner.
      const raced = await getDoc(reference);
      if (raced.exists()) return toConversationRecord(raced.data(), raced.id);
      throw new Error('Could not open a conversation with this member.');
    }

    return toConversationRecord(payload, id);
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    const snapshot = await getDocs(
      query(messagesRef(conversationId), orderBy('createdAtMs', 'asc'), limitTo(MAX_MESSAGES))
    );
    return snapshot.docs.map(toMessage);
  },

  async sendMessage(draft: MessageDraft): Promise<Message> {
    const conversationReference = doc(db(), CONVERSATIONS, draft.conversationId);
    const messageReference = doc(messagesRef(draft.conversationId));
    const createdAtMs = Date.now();
    const preview = previewOf(draft.text);

    const payload: DocumentData = {
      id: messageReference.id,
      conversationId: draft.conversationId,
      senderId: draft.senderId,
      receiverId: draft.receiverId,
      text: draft.text,
      // Always present so `firestore.rules` can read `codeSnippet` without
      // hitting a missing-key error on a plain text message.
      codeSnippet: draft.codeSnippet ? { ...draft.codeSnippet } : null,
      createdAtMs
    };

    const batch = writeBatch(db());
    batch.set(messageReference, payload);
    batch.update(conversationReference, {
      updatedAtMs: createdAtMs,
      lastMessageAtMs: createdAtMs,
      lastMessageSenderId: draft.senderId,
      lastMessagePreview: preview
    });
    await batch.commit();

    return {
      id: messageReference.id,
      conversationId: draft.conversationId,
      senderId: draft.senderId,
      receiverId: draft.receiverId,
      text: draft.text,
      timestamp: relativeTime(createdAtMs),
      createdAtMs,
      read: false,
      codeSnippet: draft.codeSnippet ? { ...draft.codeSnippet } : undefined
    };
  },

  async listReadCursors(actorId: string): Promise<Record<string, number>> {
    const snapshot = await getDocs(
      query(collection(db(), CONVERSATION_READS), where('userId', '==', actorId), limitTo(MAX_CURSORS))
    );
    const cursors: Record<string, number> = {};
    snapshot.docs.forEach(data => {
      cursors[str(data.id)] = num(data.data().lastReadAtMs);
    });
    return cursors;
  },

  async markConversationRead(conversationId: string, actorId: string, atMs: number): Promise<number> {
    const id = `${conversationId}_${actorId}`;
    const reference = doc(db(), CONVERSATION_READS, id);

    // One write instead of read-then-write: the rules already refuse a receipt
    // that would move backwards, so the client never has to read a document
    // that does not exist yet (and cannot be read until it does).
    try {
      await setDoc(reference, { id, conversationId, userId: actorId, lastReadAtMs: atMs });
      return atMs;
    } catch (error) {
      // Either the write would rewind the cursor, or the caller has no business
      // in this thread. An existing receipt is mine to read, so the real value
      // is available in the first case and the original error is rethrown.
      const existing = await getDoc(reference);
      if (!existing.exists()) throw error;
      return num(existing.data().lastReadAtMs);
    }
  },

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    await deleteDoc(doc(messagesRef(conversationId), messageId));
  },

  async deleteConversation(conversationId: string): Promise<void> {
    // Subcollections do not cascade: drain the messages first, in batches,
    // so no orphaned document survives the parent.
    for (;;) {
      const snapshot = await getDocs(query(messagesRef(conversationId), limitTo(BATCH_SIZE)));
      if (snapshot.empty) break;
      const batch = writeBatch(db());
      snapshot.docs.forEach(message => batch.delete(message.ref));
      await batch.commit();
      if (snapshot.size < BATCH_SIZE) break;
    }
    await deleteDoc(doc(db(), CONVERSATIONS, conversationId));
  },

  // ---------------------------------------------------------- realtime
  subscribeToConversations(
    actorId: string,
    handlers: StreamHandlers<ConversationRecord[]>
  ): Unsubscribe {
    const reference = query(
      collection(db(), CONVERSATIONS),
      where('participants', 'array-contains', actorId)
    );
    return onSnapshot(
      reference,
      // Latency compensation is exactly what we want: a local send shows up
      // in the sender's own list at once, then the server confirms it.
      // Cache-only metadata changes (a re-read from disk) carry no new data
      // for a query this small, so they are deliberately not delivered -
      // that keeps the recompute work proportional to real activity.
      { includeMetadataChanges: false },
      snapshot => handlers.onData(snapshot.docs.map(item => toConversationRecord(item.data(), item.id))),
      handlers.onError
    );
  },

  subscribeToReadCursors(
    actorId: string,
    handlers: StreamHandlers<Record<string, number>>
  ): Unsubscribe {
    const reference = query(
      collection(db(), CONVERSATION_READS),
      where('userId', '==', actorId),
      limitTo(MAX_CURSORS)
    );
    return onSnapshot(
      reference,
      { includeMetadataChanges: false },
      snapshot => {
        const cursors: Record<string, number> = {};
        snapshot.docs.forEach(item => {
          cursors[str(item.id)] = num(item.data().lastReadAtMs);
        });
        handlers.onData(cursors);
      },
      handlers.onError
    );
  },

  subscribeToMessages(
    conversationId: string,
    handlers: StreamHandlers<Message[]>
  ): Unsubscribe {
    const reference = query(
      messagesRef(conversationId),
      orderBy('createdAtMs', 'asc'),
      limitTo(MAX_MESSAGES)
    );
    return onSnapshot(
      reference,
      { includeMetadataChanges: false },
      // The snapshot is the whole window in order, so sorting it here and
      // replacing the view wholesale is both duplicate-proof and delete-aware
      // - a document removed by its author simply stops appearing.
      snapshot => handlers.onData(snapshot.docs.map(toMessage).sort((a, b) => a.createdAtMs - b.createdAtMs)),
      handlers.onError
    );
  },

  async countMessagesSince(conversationId: string, sinceMs: number): Promise<number> {
    const snapshot = await getCountFromServer(
      query(messagesRef(conversationId), where('createdAtMs', '>', sinceMs))
    );
    return snapshot.data().count;
  }
};

export { CONVERSATIONS, CONVERSATION_READS, MAX_MESSAGES, MAX_CURSORS, previewOf };
