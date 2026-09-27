import {
  collection,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  runTransaction,
  setDoc,
  sum,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import type {
  DocumentData,
  DocumentReference,
  Query,
  QueryConstraint,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { getFirebaseDb } from '../lib/firebase';
import { ServiceError } from '../lib/errors';
import { relativeTime } from '../lib/time';
import type {
  AcademicYear,
  Answer,
  Attachment,
  BadgeDefinition,
  Category,
  CodeSnippet,
  Comment,
  Department,
  Doubt,
  Follow,
  Notification,
  ReputationEvent,
  Tag,
  UserBadge,
  UserRole,
  UserSnapshot
} from '../types';
import type {
  AnswerContentPatch,
  AnswerStatePatch,
  CommentRecord,
  CommentUpdate,
  ContentAdapter,
  DoubtContentPatch,
  DoubtStatePatch,
  FollowQuery,
  ReputationEventDraft,
  ReputationQuery,
  UserBadgeDraft,
  UserVotes,
  VoteValue,
  VoteWrite
} from './contentAdapter';

/**
 * Firestore doubt-domain adapter — the single production content backend.
 *
 * Document layout (mirrored by `firestore.rules`):
 *
 *   doubts/{doubtId}
 *   doubts/{doubtId}/answers/{answerId}
 *   doubts/{doubtId}/comments/{commentId}      (`answerId: ''` = doubt-level)
 *   votes/{d|a}_{targetId}_{uid}               one doc per voter per target
 *   bookmarks/{doubtId}_{uid}
 *   follows/{userId}_{uid}
 *   tagFollows/{tagId}_{uid}
 *   categories/{categoryId}
 *   tags/{tagId}
 *   notifications/{notificationId}
 *
 * Rules enforced here (the rules file is the real boundary; these are the
 * matching client-side guarantees that keep the common path honest):
 * - Counters are never written blindly: votes run in a transaction that
 *   re-reads the voter's own `votes/…` document, so the counter delta is
 *   derived from persisted state instead of a possibly stale client copy.
 * - `answersCount` and `lastAnswerId` move together in one atomic write, and
 *   the same batch creates or deletes the answer document the id points at —
 *   that is what lets the rules prove the counter tracks real answers.
 * - `hasAcceptedAnswer` and `acceptedAnswerId` always move together with the
 *   answer's `isAccepted` flag, which is how "one accepted answer" is
 *   enforced across two documents.
 * - Timestamps are epoch milliseconds validated by the rules against a sane
 *   window and immutable after create.
 */
const DOUBTS = 'doubts';
const ANSWERS = 'answers';
const COMMENTS = 'comments';
const VOTES = 'votes';
const BOOKMARKS = 'bookmarks';
const FOLLOWS = 'follows';
const TAG_FOLLOWS = 'tagFollows';
const CATEGORIES = 'categories';
const TAGS = 'tags';
const NOTIFICATIONS = 'notifications';
const REPUTATION_EVENTS = 'reputationEvents';
const BADGES = 'badges';
const USER_BADGES = 'userBadges';
const USERS = 'users';

/**
 * Ledger rows any approved member may count off a profile: they restate a
 * public fact (somebody asked, answered or was accepted) and carry no voter.
 * `vote` rows are deliberately absent - they name the member who voted.
 */
const NON_VOTE_TYPES = ['question', 'answer', 'accepted'];

/** `writeBatch` hard limit is 500; leave headroom for the parent update. */
const MAX_BATCH_DELETES = 400;

function db() {
  return getFirebaseDb();
}

function malformed(): ServiceError {
  return new ServiceError(
    'content/malformed',
    'This record is invalid. Contact your department administrator.'
  );
}

function notFound(): ServiceError {
  return new ServiceError('content/not-found', 'That record no longer exists.');
}

// --------------------------------------------------------------- primitives

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Firestore rejects `undefined` field values; drop them before any write. */
function compact(data: DocumentData): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function normalizeVote(value: unknown): VoteValue {
  if (value === 1 || value === 'up') return 1;
  if (value === -1 || value === 'down') return -1;
  return 0;
}

function readSnapshot(snapshot: QueryDocumentSnapshot<DocumentData> | { data(): DocumentData; id: string }): DocumentData {
  return snapshot.data();
}

function toUserSnapshot(value: unknown): UserSnapshot {
  const data = (value ?? {}) as DocumentData;
  return {
    id: str(data.id),
    name: str(data.name),
    username: str(data.username),
    avatar: str(data.avatar),
    department: str(data.department, 'CSE') as Department,
    year: str(data.year, '1st') as AcademicYear,
    role: str(data.role, 'student') as UserRole,
    reputation: num(data.reputation)
  };
}

function toAttachments(value: unknown): Attachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(
    (item): item is Attachment =>
      typeof item === 'object' && item !== null && typeof (item as Attachment).url === 'string'
  );
  return items.length > 0 ? items : undefined;
}

function toCodeSnippet(value: unknown): CodeSnippet | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const data = value as DocumentData;
  if (typeof data.code !== 'string') return undefined;
  return { language: str(data.language, 'text'), code: data.code };
}

// ------------------------------------------------------------------ mapping

export function toDoubt(data: DocumentData, id: string): Doubt {
  const visibility = data.visibility === 'private' ? 'private' : 'public';
  return {
    id,
    title: str(data.title),
    description: str(data.description),
    authorId: str(data.authorId),
    authorSnapshot: toUserSnapshot(data.authorSnapshot),
    createdAt: relativeTime(num(data.createdAtMs)),
    updatedAt: data.updatedAtMs === undefined ? undefined : relativeTime(num(data.updatedAtMs)),
    category: str(data.category),
    subject: str(data.subject),
    tags: strList(data.tags),
    visibility,
    allowedUserIds: strList(data.allowedUserIds),
    priority: (data.priority as Doubt['priority']) ?? 'normal',
    upvotes: num(data.upvotes),
    downvotes: num(data.downvotes),
    views: num(data.views),
    answersCount: num(data.answersCount),
    hasAcceptedAnswer: bool(data.hasAcceptedAnswer),
    codeSnippet: toCodeSnippet(data.codeSnippet),
    attachments: toAttachments(data.attachments),
    mentions: strList(data.mentions),
    mentionIds: strList(data.mentionIds),
    isPinned: bool(data.isPinned) || undefined,
    lastAnswerId: typeof data.lastAnswerId === 'string' ? data.lastAnswerId : null,
    acceptedAnswerId: typeof data.acceptedAnswerId === 'string' ? data.acceptedAnswerId : null
  };
}

function toAnswer(data: DocumentData, id: string, doubtId: string): Answer {
  return {
    id,
    doubtId,
    authorId: str(data.authorId),
    authorSnapshot: toUserSnapshot(data.authorSnapshot),
    content: str(data.content),
    createdAt: relativeTime(num(data.createdAtMs)),
    updatedAt: data.updatedAtMs === undefined ? undefined : relativeTime(num(data.updatedAtMs)),
    upvotes: num(data.upvotes),
    downvotes: num(data.downvotes),
    isAccepted: bool(data.isAccepted),
    codeSnippet: toCodeSnippet(data.codeSnippet),
    attachments: toAttachments(data.attachments),
    mentions: strList(data.mentions),
    mentionIds: strList(data.mentionIds),
    comments: []
  };
}

function toComment(data: DocumentData, id: string): CommentRecord {
  const comment: Comment = {
    id,
    authorId: str(data.authorId),
    authorName: str(data.authorName),
    authorAvatar: str(data.authorAvatar),
    content: str(data.content),
    createdAt: relativeTime(num(data.createdAtMs)),
    updatedAt: data.updatedAtMs === undefined ? undefined : relativeTime(num(data.updatedAtMs)),
    parentCommentId: optStr(data.parentCommentId),
    mentions: strList(data.mentions),
    mentionIds: strList(data.mentionIds)
  };
  return { ...comment, doubtId: str(data.doubtId), answerId: str(data.answerId) };
}

function toCategory(data: DocumentData, id: string): Category {
  return {
    id,
    name: str(data.name),
    slug: str(data.slug),
    description: str(data.description),
    icon: str(data.icon),
    domain: (data.domain as Category['domain']) ?? 'Academics',
    questionsCount: num(data.questionsCount),
    status: data.status === 'inactive' ? 'inactive' : 'active'
  };
}

function toTag(data: DocumentData, id: string): Tag {
  return {
    id,
    name: str(data.name),
    description: str(data.description),
    count: num(data.count),
    followersCount: num(data.followersCount),
    isTrending: bool(data.isTrending) || undefined
  };
}

function toNotification(data: DocumentData, id: string): Notification {
  return {
    id,
    userId: str(data.userId),
    senderId: str(data.senderId),
    type: (data.type as Notification['type']) ?? 'answer',
    title: str(data.title),
    message: str(data.message),
    timestamp: relativeTime(num(data.createdAtMs)),
    read: bool(data.read),
    link: optStr(data.link),
    sourceId: optStr(data.sourceId),
    senderName: optStr(data.senderName),
    senderAvatar: optStr(data.senderAvatar),
    source: data.source === 'server' ? 'server' : 'client'
  };
}

// ------------------------------------------------------- reputation ledger

function toFollow(data: DocumentData, id: string): Follow {
  return {
    id,
    userId: str(data.userId),
    targetUserId: str(data.targetUserId),
    createdAtMs: num(data.createdAtMs)
  };
}

function toReputationEvent(data: DocumentData, id: string): ReputationEvent {
  return {
    id,
    userId: str(data.userId),
    type: (data.type as ReputationEvent['type']) ?? 'question',
    delta: num(data.delta),
    sourceId: str(data.sourceId),
    doubtId: str(data.doubtId),
    voterId: optStr(data.voterId),
    value: typeof data.value === 'number' ? data.value : undefined,
    actorId: optStr(data.actorId),
    createdAtMs: num(data.createdAtMs)
  };
}

/**
 * Fields a ledger row always carries, even when they are meaningless for its
 * type. `firestore.rules` declares the whole shape up front, so an absent key
 * would be refused rather than silently defaulted - the adapter writes them
 * explicitly instead.
 */
function eventTail(): DocumentData {
  return { actorId: '', voterId: '', targetType: '', targetId: '', value: 0 };
}

/**
 * Document id + payload for a milestone. The id is derived from the work
 * itself, which is what makes a second claim of the same milestone an
 * `already-exists` failure instead of a second helping of points.
 */
function serializeEvent(actorId: string, draft: ReputationEventDraft): { id: string; data: DocumentData } {
  const base: DocumentData = { ...eventTail(), createdAtMs: Date.now() };
  if (draft.type === 'question') {
    const id = `question_${draft.doubtId}_${draft.userId}`;
    return {
      id,
      data: {
        ...base,
        id,
        userId: draft.userId,
        actorId,
        type: 'question',
        delta: 5,
        sourceId: draft.doubtId,
        doubtId: draft.doubtId
      }
    };
  }
  if (draft.type === 'answer') {
    const id = `answer_${draft.doubtId}_${draft.answerId}_${draft.userId}`;
    return {
      id,
      data: {
        ...base,
        id,
        userId: draft.userId,
        actorId,
        type: 'answer',
        delta: 10,
        sourceId: draft.answerId,
        doubtId: draft.doubtId
      }
    };
  }
  const id = `accepted_${draft.answerId}_${draft.userId}`;
  return {
    id,
    data: {
      ...base,
      id,
      userId: draft.userId,
      actorId,
      type: 'accepted',
      delta: 15,
      sourceId: draft.answerId,
      doubtId: draft.doubtId
    }
  };
}

/** Point value the published policy assigns to one vote (see ReputationPage). */
function voteReward(targetType: VoteWrite['targetType'], value: number): number {
  if (value === 0) return 0;
  if (targetType === 'doubt') return value === 1 ? 5 : -2;
  return value === 1 ? 10 : -2;
}

function serializeVoteEvent(actorId: string, write: VoteWrite, authorId: string): { id: string; data: DocumentData } {
  const id = `vote_${write.targetId}_${actorId}`;
  const withdrawn = write.value === 0;
  return {
    id,
    data: {
      ...eventTail(),
      id,
      // A withdrawn vote leaves no beneficiary, which is exactly what a
      // zero-delta row should say.
      userId: withdrawn ? '' : authorId,
      voterId: actorId,
      type: 'vote',
      delta: voteReward(write.targetType, write.value),
      sourceId: write.targetId,
      doubtId: write.doubtId ?? '',
      targetType: write.targetType,
      targetId: write.targetId,
      value: write.value,
      createdAtMs: Date.now()
    }
  };
}

function toBadgeDefinition(data: DocumentData, id: string): BadgeDefinition {
  return {
    id,
    name: str(data.name),
    description: str(data.description),
    icon: str(data.icon),
    tier: (data.tier as BadgeDefinition['tier']) ?? 'bronze',
    kind: data.kind === 'threshold' ? 'threshold' : 'self',
    threshold: typeof data.threshold === 'number' ? data.threshold : undefined
  };
}

function toUserBadge(data: DocumentData, id: string): UserBadge {
  return {
    id,
    uid: str(data.uid),
    badgeId: str(data.badgeId),
    sourceId: str(data.sourceId),
    doubtId: optStr(data.doubtId),
    awardedAtMs: num(data.awardedAtMs)
  };
}

/** `getCountFromServer` / `getAggregateFromServer` are reads with rules on. */
async function countOf(target: Query<DocumentData>): Promise<number> {
  const snapshot = await getCountFromServer(target);
  return snapshot.data().count;
}

async function sumOf(target: Query<DocumentData>, field: string): Promise<number> {
  const snapshot = await getAggregateFromServer(target, { total: sum(field) });
  return snapshot.data().total;
}

function bounded(query: Query<DocumentData>, options?: FollowQuery): Query<DocumentData> {
  return options?.limit ? queryLimit(query, options.limit) : query;
}

function queryLimit(target: Query<DocumentData>, size: number): Query<DocumentData> {
  return query(target, limitTo(Math.max(1, Math.min(size, 200))));
}

function serializeDoubt(doubt: Doubt): DocumentData {
  return {
    id: doubt.id,
    title: doubt.title,
    description: doubt.description,
    authorId: doubt.authorId,
    authorSnapshot: doubt.authorSnapshot,
    category: doubt.category,
    subject: doubt.subject,
    tags: doubt.tags,
    visibility: doubt.visibility,
    allowedUserIds: doubt.allowedUserIds ?? [],
    priority: doubt.priority ?? 'normal',
    upvotes: doubt.upvotes,
    downvotes: doubt.downvotes,
    views: doubt.views,
    answersCount: doubt.answersCount,
    hasAcceptedAnswer: doubt.hasAcceptedAnswer,
    codeSnippet: doubt.codeSnippet,
    attachments: doubt.attachments,
    mentions: doubt.mentions,
    mentionIds: doubt.mentionIds,
    isPinned: doubt.isPinned ?? false
  };
}

function serializeAnswer(answer: Answer): DocumentData {
  return {
    id: answer.id,
    doubtId: answer.doubtId,
    authorId: answer.authorId,
    authorSnapshot: answer.authorSnapshot,
    content: answer.content,
    upvotes: answer.upvotes,
    downvotes: answer.downvotes,
    isAccepted: answer.isAccepted,
    codeSnippet: answer.codeSnippet,
    attachments: answer.attachments,
    mentions: answer.mentions,
    mentionIds: answer.mentionIds
  };
}

// ------------------------------------------------------------------- paths

function doubtRef(id: string): DocumentReference<DocumentData> {
  return doc(db(), DOUBTS, id);
}

function answerRef(doubtId: string, answerId: string): DocumentReference<DocumentData> {
  return doc(db(), DOUBTS, doubtId, ANSWERS, answerId);
}

function commentsCollection(doubtId: string) {
  return collection(db(), DOUBTS, doubtId, COMMENTS);
}

function voteIdFor(targetType: VoteWrite['targetType'], targetId: string, actorId: string): string {
  return `${targetType === 'doubt' ? 'd' : 'a'}_${targetId}_${actorId}`;
}

// ---------------------------------------------------------------- adapter

export const firebaseContentAdapter: ContentAdapter = {
  // ---------------------------------------------------------------- Doubts
  /**
   * The feed, read as three scoped queries rather than one collection pull.
   *
   * Firestore proves a `list` request against the query's *potential* result
   * set, not against the documents that come back, so a rule that inspects a
   * field can only be satisfied by a query that constrains that same field.
   * `firestore.rules` gates `doubts` on the private-doubt predicate
   * (public OR author OR invited OR admin), which leaves three shapes a
   * non-admin query can prove: one per field branch. They are merged here,
   * and the sort/filter the feed needs already happens in the service layer.
   *
   * Every query is a single equality filter, so each is served by the
   * automatic single-field index - no composite index is required.
   */
  async listDoubts(actorId: string): Promise<Doubt[]> {
    const doubts = collection(db(), DOUBTS);
    const [visibleToEveryone, own, invited] = await Promise.all([
      getDocs(query(doubts, where('visibility', '==', 'public'))),
      getDocs(query(doubts, where('authorId', '==', actorId))),
      getDocs(query(doubts, where('allowedUserIds', 'array-contains', actorId)))
    ]);

    const merged = new Map<string, Doubt>();
    for (const snapshot of [visibleToEveryone, own, invited]) {
      for (const item of snapshot.docs) {
        const doubt = toDoubt(readSnapshot(item), item.id);
        merged.set(doubt.id, doubt);
      }
    }
    return Array.from(merged.values());
  },

  async getDoubt(id: string): Promise<Doubt | null> {
    const snapshot = await getDoc(doubtRef(id));
    if (!snapshot.exists()) return null;
    return toDoubt(snapshot.data(), snapshot.id);
  },

  async createDoubt(doubt: Doubt): Promise<Doubt> {
    const reference = doc(collection(db(), DOUBTS));
    const payload = compact({
      ...serializeDoubt(doubt),
      id: reference.id,
      createdAtMs: Date.now(),
      lastAnswerId: null,
      acceptedAnswerId: null
    });
    await setDoc(reference, payload);
    return toDoubt(payload, reference.id);
  },

  async updateDoubt(id: string, patch: DoubtContentPatch): Promise<Doubt> {
    await updateDoc(doubtRef(id), compact({ ...patch, updatedAtMs: Date.now() }));
    const snapshot = await getDoc(doubtRef(id));
    if (!snapshot.exists()) throw notFound();
    return toDoubt(snapshot.data(), snapshot.id);
  },

  async deleteDoubt(id: string): Promise<void> {
    // Answers and comments go with the doubt in one atomic batch: the rules
    // refuse an answer whose parent survives with a stale `answersCount`, and
    // a comment left behind would be unreadable (its guard `get()`s a doubt
    // that no longer exists) as well as undeletable.
    const [answers, comments] = await Promise.all([
      getDocs(collection(db(), DOUBTS, id, ANSWERS)),
      getDocs(commentsCollection(id))
    ]);
    const batch = writeBatch(db());
    batch.delete(doubtRef(id));
    let ops = 1;
    for (const item of [...answers.docs, ...comments.docs]) {
      if (ops >= MAX_BATCH_DELETES) break;
      batch.delete(item.ref);
      ops += 1;
    }
    await batch.commit();
  },

  async setDoubtState(id: string, patch: DoubtStatePatch): Promise<void> {
    await updateDoc(doubtRef(id), compact(patch));
  },

  // --------------------------------------------------------------- Answers
  async listAnswers(doubtId: string): Promise<Answer[]> {
    const snapshot = await getDocs(collection(db(), DOUBTS, doubtId, ANSWERS));
    return snapshot.docs.map(item => toAnswer(readSnapshot(item), item.id, doubtId));
  },

  async createAnswer(answer: Answer): Promise<Answer> {
    const reference = doc(collection(db(), DOUBTS, answer.doubtId, ANSWERS));
    const now = Date.now();
    const payload = compact({
      ...serializeAnswer(answer),
      id: reference.id,
      doubtId: answer.doubtId,
      createdAtMs: now
    });

    await runTransaction(db(), async transaction => {
      const parent = transaction.get(doubtRef(answer.doubtId));
      const parentSnapshot = await parent;
      if (!parentSnapshot.exists()) throw notFound();
      transaction.set(reference, payload);
      transaction.update(doubtRef(answer.doubtId), {
        answersCount: num(parentSnapshot.data().answersCount) + 1,
        lastAnswerId: reference.id
      });
    });

    return toAnswer(payload, reference.id, answer.doubtId);
  },

  async updateAnswer(doubtId: string, answerId: string, patch: AnswerContentPatch): Promise<Answer> {
    await updateDoc(answerRef(doubtId, answerId), compact({ ...patch, updatedAtMs: Date.now() }));
    const snapshot = await getDoc(answerRef(doubtId, answerId));
    if (!snapshot.exists()) throw notFound();
    return toAnswer(snapshot.data(), snapshot.id, doubtId);
  },

  async deleteAnswer(doubtId: string, answerId: string): Promise<void> {
    const comments = await getDocs(commentsCollection(doubtId));
    const staleCommentRefs = comments.docs
      .filter(item => str(readSnapshot(item).answerId) === answerId)
      .slice(0, MAX_BATCH_DELETES)
      .map(item => item.ref);

    await runTransaction(db(), async transaction => {
      const parent = transaction.get(doubtRef(doubtId));
      const target = transaction.get(answerRef(doubtId, answerId));
      const [parentSnapshot, targetSnapshot] = await Promise.all([parent, target]);
      if (!targetSnapshot.exists()) throw notFound();

      transaction.delete(answerRef(doubtId, answerId));
      for (const reference of staleCommentRefs) transaction.delete(reference);

      if (parentSnapshot.exists()) {
        const current = num(parentSnapshot.data().answersCount);
        const next = Math.max(0, current - 1);
        if (next !== current) {
          transaction.update(doubtRef(doubtId), { answersCount: next, lastAnswerId: answerId });
        }
      }
    });
  },

  async setAnswerState(doubtId: string, answerId: string, patch: AnswerStatePatch): Promise<void> {
    await updateDoc(answerRef(doubtId, answerId), compact(patch));
  },

  async setAcceptedAnswer(doubtId: string, answerId: string | null, accepted: boolean): Promise<void> {
    const answers = await getDocs(collection(db(), DOUBTS, doubtId, ANSWERS));

    await runTransaction(db(), async transaction => {
      const parentSnapshot = await transaction.get(doubtRef(doubtId));
      if (!parentSnapshot.exists()) throw notFound();

      for (const item of answers.docs) {
        const shouldAccept = accepted && item.id === answerId;
        if (bool(readSnapshot(item).isAccepted) !== shouldAccept) {
          transaction.update(item.ref, { isAccepted: shouldAccept });
        }
      }

      transaction.update(doubtRef(doubtId), {
        hasAcceptedAnswer: Boolean(accepted && answerId),
        acceptedAnswerId: accepted && answerId ? answerId : null
      });
    });
  },

  // -------------------------------------------------------------- Comments
  async listComments(doubtId: string): Promise<CommentRecord[]> {
    const snapshot = await getDocs(commentsCollection(doubtId));
    return snapshot.docs.map(item => toComment(readSnapshot(item), item.id));
  },

  async createComment(doubtId: string, answerId: string | null, comment: Comment): Promise<CommentRecord> {
    const reference = doc(commentsCollection(doubtId));
    const payload = compact({
      id: reference.id,
      doubtId,
      answerId: answerId ?? '',
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorAvatar: comment.authorAvatar,
      content: comment.content,
      parentCommentId: comment.parentCommentId,
      mentions: comment.mentions,
      mentionIds: comment.mentionIds,
      createdAtMs: Date.now()
    });
    await setDoc(reference, payload);
    return toComment(payload, reference.id);
  },

  async updateComment(doubtId: string, commentId: string, patch: CommentUpdate): Promise<CommentRecord> {
    const reference = doc(commentsCollection(doubtId), commentId);
    await updateDoc(reference, { ...patch, updatedAtMs: Date.now() });
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw notFound();
    return toComment(snapshot.data(), snapshot.id);
  },

  async deleteComment(doubtId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(commentsCollection(doubtId), commentId));
  },

  // ----------------------------------------------------------------- Votes
  async listVotes(actorId: string): Promise<UserVotes> {
    const snapshot = await getDocs(query(collection(db(), VOTES), where('userId', '==', actorId)));
    const votes: UserVotes = { doubts: {}, answers: {} };
    snapshot.docs.forEach(item => {
      const data = readSnapshot(item);
      const targetId = str(data.targetId);
      const value = normalizeVote(data.value);
      if (!targetId || value === 0) return;
      if (data.targetType === 'answer') votes.answers[targetId] = value;
      else votes.doubts[targetId] = value;
    });
    return votes;
  },

  async saveVote(actorId: string, write: VoteWrite): Promise<void> {
    const voteRef = doc(db(), VOTES, voteIdFor(write.targetType, write.targetId, actorId));
    const parentRef =
      write.targetType === 'doubt'
        ? doubtRef(write.targetId)
        : answerRef(write.doubtId, write.targetId);

    await runTransaction(db(), async transaction => {
      const [voteSnapshot, parentSnapshot] = await Promise.all([
        transaction.get(voteRef),
        transaction.get(parentRef)
      ]);
      if (!parentSnapshot.exists()) throw notFound();

      const current = voteSnapshot.exists() ? normalizeVote(voteSnapshot.data().value) : 0;
      const parentData = parentSnapshot.data();
      const authorId = str(parentData.authorId);
      // Reads must all precede writes, so the beneficiary's record is opened
      // up front - and only when this vote can actually credit somebody.
      const credits = authorId && authorId !== actorId ? authorId : '';
      const userSnapshot = credits ? await transaction.get(doc(db(), USERS, credits)) : null;
      let upvotes = num(parentData.upvotes);
      let downvotes = num(parentData.downvotes);

      if (current === 1) upvotes -= 1;
      else if (current === -1) downvotes -= 1;

      if (write.value === 1) upvotes += 1;
      else if (write.value === -1) downvotes += 1;

      upvotes = Math.max(0, upvotes);
      downvotes = Math.max(0, downvotes);

      if (write.value === 0) {
        if (voteSnapshot.exists()) transaction.delete(voteRef);
      } else {
        transaction.set(voteRef, {
          userId: actorId,
          targetType: write.targetType,
          targetId: write.targetId,
          doubtId: write.doubtId,
          value: write.value,
          createdAtMs: voteSnapshot.exists() ? num(voteSnapshot.data().createdAtMs) : Date.now()
        });
      }

      transaction.update(parentRef, { upvotes, downvotes });

      // The ledger row and the beneficiary's public score move WITH the vote.
      // `firestore.rules` reads this same `votes/…` document before and after
      // the commit, so the credit is the difference between the two states -
      // not a number the browser got to pick - and a self-vote (which can
      // never be an event) is skipped entirely.
      if (credits && userSnapshot?.exists()) {
        const event = serializeVoteEvent(actorId, write, credits);
        const before = num(userSnapshot.data().reputation);
        const credit =
          voteReward(write.targetType, write.value) - voteReward(write.targetType, current);
        transaction.set(doc(db(), REPUTATION_EVENTS, event.id), event.data);
        transaction.update(doc(db(), USERS, credits), {
          reputation: Math.max(0, before + credit),
          reputationEventRef: event.id
        });
      }
    });
  },

  // ------------------------------------------------------ Bookmarks/follows
  async listBookmarkIds(actorId: string): Promise<string[]> {
    const snapshot = await getDocs(query(collection(db(), BOOKMARKS), where('userId', '==', actorId)));
    return snapshot.docs.map(item => str(readSnapshot(item).doubtId)).filter(Boolean);
  },

  async setBookmark(actorId: string, doubtId: string, bookmarked: boolean): Promise<void> {
    const reference = doc(db(), BOOKMARKS, `${doubtId}_${actorId}`);
    if (bookmarked) {
      await setDoc(reference, { userId: actorId, doubtId, createdAtMs: Date.now() });
    } else {
      await deleteDoc(reference);
    }
  },

  async listFollowingUserIds(actorId: string): Promise<string[]> {
    const snapshot = await getDocs(query(collection(db(), FOLLOWS), where('userId', '==', actorId)));
    return snapshot.docs.map(item => str(readSnapshot(item).targetUserId)).filter(Boolean);
  },

  async setFollowing(actorId: string, userId: string, following: boolean): Promise<void> {
    const reference = doc(db(), FOLLOWS, `${userId}_${actorId}`);
    if (following) {
      await setDoc(reference, { userId: actorId, targetUserId: userId, createdAtMs: Date.now() });
    } else {
      await deleteDoc(reference);
    }
  },

  async listFollowingTagIds(actorId: string): Promise<string[]> {
    const snapshot = await getDocs(query(collection(db(), TAG_FOLLOWS), where('userId', '==', actorId)));
    return snapshot.docs.map(item => str(readSnapshot(item).tagId)).filter(Boolean);
  },

  async setTagFollowing(actorId: string, tagId: string, following: boolean): Promise<void> {
    const followRef = doc(db(), TAG_FOLLOWS, `${tagId}_${actorId}`);
    const tagRef = doc(db(), TAGS, tagId);

    await runTransaction(db(), async transaction => {
      const [followSnapshot, tagSnapshot] = await Promise.all([
        transaction.get(followRef),
        transaction.get(tagRef)
      ]);

      if (following) {
        if (!followSnapshot.exists()) {
          transaction.set(followRef, { userId: actorId, tagId, createdAtMs: Date.now() });
        }
      } else if (followSnapshot.exists()) {
        transaction.delete(followRef);
      }

      if (tagSnapshot.exists()) {
        const current = num(tagSnapshot.data().followersCount);
        const next = Math.max(0, current + (following ? 1 : -1));
        if (next !== current) transaction.update(tagRef, { followersCount: next });
      }
    });
  },

  // --------------------------------------------------------- Social graph
  async listFollowers(userId: string, options?: FollowQuery): Promise<Follow[]> {
    const ordered = query(
      collection(db(), FOLLOWS),
      where('targetUserId', '==', userId),
      orderBy('createdAtMs', 'desc')
    );
    const snapshot = await getDocs(bounded(ordered, options));
    return snapshot.docs.map(item => toFollow(readSnapshot(item), item.id));
  },

  async listFollowing(userId: string, options?: FollowQuery): Promise<Follow[]> {
    const ordered = query(
      collection(db(), FOLLOWS),
      where('userId', '==', userId),
      orderBy('createdAtMs', 'desc')
    );
    const snapshot = await getDocs(bounded(ordered, options));
    return snapshot.docs.map(item => toFollow(readSnapshot(item), item.id));
  },

  async countFollowers(userId: string): Promise<number> {
    return countOf(query(collection(db(), FOLLOWS), where('targetUserId', '==', userId)));
  },

  async countFollowing(userId: string): Promise<number> {
    return countOf(query(collection(db(), FOLLOWS), where('userId', '==', userId)));
  },

  // ----------------------------------------------------- Reputation ledger
  async listReputationEvents(userId: string, options?: ReputationQuery): Promise<ReputationEvent[]> {
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];
    // A `vote` row names its voter, which is what the `votes` collection
    // keeps private - so only the beneficiary's own history may include them.
    if (!options?.includeVotes) constraints.push(where('type', 'in', NON_VOTE_TYPES));
    const ordered = query(
      collection(db(), REPUTATION_EVENTS),
      ...constraints,
      orderBy('createdAtMs', 'desc')
    );
    const snapshot = await getDocs(bounded(ordered, options));
    return snapshot.docs.map(item => toReputationEvent(readSnapshot(item), item.id));
  },

  async sumReputation(userId: string): Promise<number> {
    return sumOf(query(collection(db(), REPUTATION_EVENTS), where('userId', '==', userId)), 'delta');
  },

  async countAccepted(userId: string): Promise<number> {
    return countOf(
      query(
        collection(db(), REPUTATION_EVENTS),
        where('userId', '==', userId),
        where('type', '==', 'accepted')
      )
    );
  },

  /**
   * Books a milestone and the score it earns in ONE transaction.
   *
   * The event id is derived from the work itself and `firestore.rules`
   * requires the event to be minted inside the very commit that moves
   * `users.reputation`, so the credit can be applied exactly once - a retry,
   * a second claim or a hand-edited delta all fail the transaction instead of
   * quietly inflating a score.
   */
  async createReputationEvent(actorId: string, draft: ReputationEventDraft): Promise<ReputationEvent> {
    const { id, data } = serializeEvent(actorId, draft);
    const beneficiary = str(data.userId);
    const eventRef = doc(db(), REPUTATION_EVENTS, id);
    const userRef = doc(db(), USERS, beneficiary);

    await runTransaction(db(), async transaction => {
      const [eventSnapshot, userSnapshot] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(userRef)
      ]);
      // The id is a pure function of the work, so "already exists" means the
      // milestone was booked before - a second credit is refused, not summed.
      if (eventSnapshot.exists()) {
        throw new ServiceError('content/exists', 'That milestone is already booked.');
      }
      if (!userSnapshot.exists()) throw notFound();
      const before = num(userSnapshot.data().reputation);
      transaction.set(eventRef, data);
      transaction.update(userRef, {
        reputation: Math.max(0, before + num(data.delta)),
        reputationEventRef: id
      });
    });

    return toReputationEvent(data, id);
  },

  // -------------------------------------------------------------- Statistics
  /**
   * Profile counters come off the ledger rather than the content collections:
   * `reputationEvents` is readable by any approved member for the non-vote
   * rows (they restate a public fact), so a profile somebody else is looking
   * at proves exactly the same query the owner's own profile does - while a
   * `doubts` / collection-group `answers` count could never be proven for a
   * private thread. Like the score itself, these do not shrink when content
   * is deleted: the work was real when it was booked.
   */
  async countDoubtsBy(authorId: string): Promise<number> {
    return countOf(
      query(
        collection(db(), REPUTATION_EVENTS),
        where('userId', '==', authorId),
        where('type', '==', 'question')
      )
    );
  },

  async countAnswersBy(authorId: string): Promise<number> {
    return countOf(
      query(
        collection(db(), REPUTATION_EVENTS),
        where('userId', '==', authorId),
        where('type', '==', 'answer')
      )
    );
  },

  // ------------------------------------------------------------------ Badges
  async listBadgeDefinitions(): Promise<BadgeDefinition[]> {
    const snapshot = await getDocs(collection(db(), BADGES));
    return snapshot.docs.map(item => toBadgeDefinition(readSnapshot(item), item.id));
  },

  async listUserBadges(uid: string): Promise<UserBadge[]> {
    const ordered = query(
      collection(db(), USER_BADGES),
      where('uid', '==', uid),
      orderBy('awardedAtMs', 'desc')
    );
    const snapshot = await getDocs(ordered);
    return snapshot.docs.map(item => toUserBadge(readSnapshot(item), item.id));
  },

  async createUserBadge(draft: UserBadgeDraft): Promise<UserBadge> {
    const id = `${draft.uid}_${draft.badgeId}`;
    const data: DocumentData = {
      id,
      uid: draft.uid,
      badgeId: draft.badgeId,
      sourceId: draft.sourceId,
      doubtId: draft.doubtId ?? '',
      awardedAtMs: Date.now()
    };
    await setDoc(doc(db(), USER_BADGES, id), data);
    return toUserBadge(data, id);
  },

  // --------------------------------------------------------------- Catalog
  async listCategories(): Promise<Category[]> {
    const snapshot = await getDocs(collection(db(), CATEGORIES));
    return snapshot.docs.map(item => toCategory(readSnapshot(item), item.id));
  },

  async createCategory(category: Category): Promise<Category> {
    const reference = doc(db(), CATEGORIES, category.id);
    const payload = compact({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      domain: category.domain,
      questionsCount: 0,
      status: category.status
    });
    await setDoc(reference, payload);
    return toCategory(payload, reference.id);
  },

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db(), CATEGORIES, id));
  },

  async adjustQuestionCount(categoryName: string, delta: number): Promise<void> {
    if (!categoryName || delta === 0) return;
    const matches = await getDocs(query(collection(db(), CATEGORIES), where('name', '==', categoryName)));
    const target = matches.docs[0];
    if (!target) return;
    const next = Math.max(0, num(readSnapshot(target).questionsCount) + delta);
    await updateDoc(target.ref, { questionsCount: next });
  },

  async listTags(): Promise<Tag[]> {
    const snapshot = await getDocs(collection(db(), TAGS));
    return snapshot.docs.map(item => toTag(readSnapshot(item), item.id));
  },

  async createTag(tag: Tag): Promise<Tag> {
    const reference = doc(db(), TAGS, tag.id);
    const payload = compact({
      id: reference.id,
      name: tag.name,
      description: tag.description,
      count: tag.count,
      followersCount: tag.followersCount,
      isTrending: tag.isTrending ?? false
    });
    await setDoc(reference, payload);
    return toTag(payload, reference.id);
  },

  // --------------------------------------------------------- Notifications
  async listNotifications(actorId: string): Promise<Notification[]> {
    const snapshot = await getDocs(query(collection(db(), NOTIFICATIONS), where('userId', '==', actorId)));
    return snapshot.docs
      .slice()
      .sort((a, b) => num(readSnapshot(b).createdAtMs) - num(readSnapshot(a).createdAtMs))
      .map(item => toNotification(readSnapshot(item), item.id));
  },

  async createNotification(notification: Notification): Promise<Notification> {
    const reference = doc(collection(db(), NOTIFICATIONS));
    const payload = compact({
      id: reference.id,
      userId: notification.userId,
      // Identity of the event's originator. The rules pin this to
      // `request.auth.uid`, so an omitted or forged sender is refused rather
      // than stored.
      senderId: notification.senderId,
      // This adapter only ever runs in a browser: `server` is reserved for a
      // future Cloud Function writing through the Admin SDK (which the rules
      // do not evaluate).
      source: 'client' as const,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      link: notification.link,
      sourceId: notification.sourceId,
      senderName: notification.senderName,
      senderAvatar: notification.senderAvatar,
      createdAtMs: Date.now()
    });
    await setDoc(reference, payload);
    return toNotification(payload, reference.id);
  },

  async markNotificationRead(_actorId: string, id: string): Promise<void> {
    await updateDoc(doc(db(), NOTIFICATIONS, id), { read: true });
  },

  async markAllNotificationsRead(_actorId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const batch = writeBatch(db());
    for (const id of ids.slice(0, MAX_BATCH_DELETES)) {
      batch.update(doc(db(), NOTIFICATIONS, id), { read: true });
    }
    await batch.commit();
  }
};
