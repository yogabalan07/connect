import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
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
import { conversationIdFor, type ConversationRecord, type MessageDraft, type MessagingAdapter } from './messagingAdapter';

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
    const existing = await getDoc(reference);
    if (existing.exists()) return toConversationRecord(existing.data(), existing.id);

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
    const existing = await getDoc(reference);

    if (!existing.exists()) {
      await setDoc(reference, { id, conversationId, userId: actorId, lastReadAtMs: atMs });
      return atMs;
    }

    const current = num(existing.data().lastReadAtMs);
    const next = Math.max(current, atMs);
    if (next !== current) await updateDoc(reference, { lastReadAtMs: next });
    return next;
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
  }
};

export { CONVERSATIONS, CONVERSATION_READS, MAX_MESSAGES, MAX_CURSORS, previewOf };
