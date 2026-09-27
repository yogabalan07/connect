import type { Answer, Category, Comment, Doubt, Notification, Tag } from '../types';
import { firebaseContentAdapter } from './firebaseContentAdapter';

/**
 * Doubt-domain persistence contract.
 *
 * Layering: pages -> context/hooks -> domain services (doubtService,
 * answerService, socialService, catalogService, notificationService) ->
 * THIS interface -> `firebaseContentAdapter` -> Firebase SDK.
 *
 * Nothing above this line imports the Firebase SDK, and nothing here knows
 * about React. Tests substitute an in-memory double through
 * `setContentAdapter`, so the whole doubt domain runs without a project,
 * without network access and without `.env.local`.
 *
 * Document identity (see `firestore.rules` for the enforced half):
 * - `doubts/{id}`, `doubts/{id}/answers/{aid}`, `doubts/{id}/.../comments/{cid}`
 * - `votes/{d|a}_{targetId}_{uid}`  - one document per voter per target, so a
 *   second vote is structurally impossible and the parent counter delta is a
 *   pure function of the voter's own transition.
 * - `bookmarks/{doubtId}_{uid}`, `follows/{userId}_{uid}`, `tagFollows/{tagId}_{uid}`
 * - `categories/{id}`, `tags/{id}`, `notifications/{id}`
 */
export type VoteValue = 1 | -1 | 0;
export type VoteTargetType = 'doubt' | 'answer';

/**
 * Content an author (or an admin) may edit on an existing doubt.
 *
 * `updatedAtMs` is written by the adapter, never by a form; it is listed
 * here because it is the field the rules allow alongside a content edit.
 */
export const DOUBT_CONTENT_KEYS = [
  'title',
  'description',
  'category',
  'subject',
  'tags',
  'visibility',
  'allowedUserIds',
  'priority',
  'codeSnippet',
  'attachments',
  'mentions',
  'updatedAtMs'
] as const;

export type DoubtContentPatch = Partial<
  Pick<
    Doubt,
    | 'title'
    | 'description'
    | 'category'
    | 'subject'
    | 'tags'
    | 'visibility'
    | 'allowedUserIds'
    | 'priority'
    | 'codeSnippet'
    | 'attachments'
    | 'mentions'
  >
>;

/**
 * Counter/flag bookkeeping on a doubt. Every key here is validated by
 * `firestore.rules` with a bounded delta; none of them is trusted merely
 * because the client sent it.
 */
export interface DoubtStatePatch {
  views?: number;
  answersCount?: number;
  hasAcceptedAnswer?: boolean;
}

export type AnswerContentPatch = Partial<
  Pick<Answer, 'content' | 'codeSnippet' | 'attachments' | 'mentions'>
>;

export interface AnswerStatePatch {
  upvotes?: number;
  downvotes?: number;
}

/**
 * A stored comment: the domain `Comment` plus the doubt/answer it hangs off.
 *
 * Comments are stored in ONE collection per doubt (`doubts/{id}/comments`)
 * with an `answerId` field, so a single read hydrates every clarification on
 * a doubt page instead of one read per answer.
 */
export interface CommentRecord extends Comment {
  doubtId: string;
  /** `''` for a doubt-level comment, otherwise the owning answer's id. */
  answerId: string;
}

/** A vote write: the caller's own `votes/…` document plus the parent counters. */
export interface VoteWrite {
  targetType: VoteTargetType;
  /** The doubt that owns the target (answers live under their doubt). */
  doubtId: string;
  targetId: string;
  value: VoteValue;
  upvotes: number;
  downvotes: number;
}

export interface UserVotes {
  doubts: Record<string, VoteValue>;
  answers: Record<string, VoteValue>;
}

export interface ContentAdapter {
  // ------------------------------------------------------------------ Doubts
  /** Every doubt the caller is allowed to see (rules filter server-side). */
  /**
   * Reads the feed for `actorId`. The Firebase implementation cannot ask for
   * the whole collection: Firestore proves a `list` request against the
   * query's potential result set, so the private-doubt predicate in
   * `firestore.rules` is only satisfied by queries that constrain the fields
   * it inspects.
   */
  listDoubts(actorId: string): Promise<Doubt[]>;
  getDoubt(id: string): Promise<Doubt | null>;
  /** `doubt.id` and `doubt.authorId` are supplied by the service, never by a form. */
  createDoubt(doubt: Doubt): Promise<Doubt>;
  updateDoubt(id: string, patch: DoubtContentPatch): Promise<Doubt>;
  deleteDoubt(id: string): Promise<void>;
  /** Views / answers / accepted-flag bookkeeping (bounded by the rules). */
  setDoubtState(id: string, patch: DoubtStatePatch): Promise<void>;

  // ----------------------------------------------------------------- Answers
  listAnswers(doubtId: string): Promise<Answer[]>;
  createAnswer(answer: Answer): Promise<Answer>;
  updateAnswer(doubtId: string, answerId: string, patch: AnswerContentPatch): Promise<Answer>;
  deleteAnswer(doubtId: string, answerId: string): Promise<void>;
  setAnswerState(doubtId: string, answerId: string, patch: AnswerStatePatch): Promise<void>;
  /**
   * Single accepted answer per doubt: clears every other accepted answer and
   * writes `doubt.acceptedAnswerId` / `doubt.hasAcceptedAnswer` in one atomic
   * batch (the rules require both sides to move together).
   * `answerId === null` means "clear the accepted answer".
   */
  setAcceptedAnswer(doubtId: string, answerId: string | null, accepted: boolean): Promise<void>;

  // ---------------------------------------------------------------- Comments
  /** Every comment on a doubt (both doubt-level and per-answer). */
  listComments(doubtId: string): Promise<CommentRecord[]>;
  createComment(doubtId: string, answerId: string | null, comment: Comment): Promise<CommentRecord>;
  deleteComment(doubtId: string, commentId: string): Promise<void>;

  // ------------------------------------------------------------------- Votes
  /** The caller's own votes, keyed by target id. */
  listVotes(actorId: string): Promise<UserVotes>;
  /**
   * Writes the caller's `votes/{…}_{uid}` document and the parent counters
   * together. `value: 0` deletes the vote document.
   */
  saveVote(actorId: string, write: VoteWrite): Promise<void>;

  // ----------------------------------------------------- Bookmarks / follows
  listBookmarkIds(actorId: string): Promise<string[]>;
  setBookmark(actorId: string, doubtId: string, bookmarked: boolean): Promise<void>;
  listFollowingUserIds(actorId: string): Promise<string[]>;
  setFollowing(actorId: string, userId: string, following: boolean): Promise<void>;
  listFollowingTagIds(actorId: string): Promise<string[]>;
  setTagFollowing(actorId: string, tagId: string, following: boolean): Promise<void>;

  // ----------------------------------------------------------------- Catalog
  listCategories(): Promise<Category[]>;
  createCategory(category: Category): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  /** Bounded `questionsCount` adjustment (rules allow at most ±1 per write). */
  adjustQuestionCount(categoryName: string, delta: number): Promise<void>;
  listTags(): Promise<Tag[]>;
  createTag(tag: Tag): Promise<Tag>;

  // ------------------------------------------------------------ Notifications
  listNotifications(actorId: string): Promise<Notification[]>;
  createNotification(notification: Notification): Promise<Notification>;
  markNotificationRead(actorId: string, id: string): Promise<void>;
  markAllNotificationsRead(actorId: string, ids: string[]): Promise<void>;
}

let overrideAdapter: ContentAdapter | null = null;

/** The doubt-domain backend the app runs against (Firebase unless overridden). */
export function getContentAdapter(): ContentAdapter {
  return overrideAdapter ?? firebaseContentAdapter;
}

/**
 * Injection seam for tests and local tooling. Production code paths always
 * resolve to the Firebase adapter (`setContentAdapter(null)` restores it).
 */
export function setContentAdapter(adapter: ContentAdapter | null): void {
  overrideAdapter = adapter;
}
