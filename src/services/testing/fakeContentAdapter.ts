import { ServiceError } from '../../lib/errors';
import { relativeTime } from '../../lib/time';
import type {
  Answer,
  Category,
  Comment,
  Doubt,
  Notification,
  Tag
} from '../../types';
import type {
  AnswerContentPatch,
  AnswerStatePatch,
  CommentRecord,
  ContentAdapter,
  DoubtContentPatch,
  DoubtStatePatch,
  UserVotes,
  VoteWrite
} from '../contentAdapter';

/**
 * In-memory `ContentAdapter` double.
 *
 * Mirrors the Firestore adapter's contract (and the invariants
 * `firestore.rules` enforces) without a project, network access or
 * `.env.local`, so `doubtService`, `answerService`, `socialService`,
 * `catalogService` and `notificationService` run hermetically in tests.
 *
 * Inject with `setContentAdapter(createFakeContentAdapter())` and restore with
 * `setContentAdapter(null)`.
 */
export interface FakeContentAdapter extends ContentAdapter {
  doubts(): Doubt[];
  answers(doubtId: string): Answer[];
  comments(doubtId: string): CommentRecord[];
  categories(): Category[];
  tags(): Tag[];
  notificationsFor(userId: string): Notification[];
  bookmarkIds(actorId: string): string[];
  followIds(actorId: string): string[];
  tagFollowIds(actorId: string): string[];
  /** Forces every call to fail with Firestore's `permission-denied` code. */
  setDenied(denied: boolean): void;
  reset(): void;
  readonly calls: Record<string, number>;
}

function notFound(): ServiceError {
  return new ServiceError('content/not-found', 'That record no longer exists.');
}

function denied(): ServiceError {
  return new ServiceError(
    'firestore/permission-denied',
    'You do not have permission to do that. Contact your department administrator.'
  );
}

const METHODS = [
  'listDoubts',
  'getDoubt',
  'createDoubt',
  'updateDoubt',
  'deleteDoubt',
  'setDoubtState',
  'listAnswers',
  'createAnswer',
  'updateAnswer',
  'deleteAnswer',
  'setAnswerState',
  'setAcceptedAnswer',
  'listComments',
  'createComment',
  'deleteComment',
  'listVotes',
  'saveVote',
  'listBookmarkIds',
  'setBookmark',
  'listFollowingUserIds',
  'setFollowing',
  'listFollowingTagIds',
  'setTagFollowing',
  'listCategories',
  'createCategory',
  'deleteCategory',
  'adjustQuestionCount',
  'listTags',
  'createTag',
  'listNotifications',
  'createNotification',
  'markNotificationRead',
  'markAllNotificationsRead'
] as const;

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

export function createFakeContentAdapter(): FakeContentAdapter {
  const store = {
    doubts: new Map<string, Doubt>(),
    answers: new Map<string, Answer>(),
    comments: new Map<string, CommentRecord>(),
    votes: new Map<string, { targetType: 'doubt' | 'answer'; targetId: string; value: 1 | -1; userId: string }>(),
    bookmarks: new Map<string, { doubtId: string; userId: string }>(),
    follows: new Map<string, { targetUserId: string; userId: string }>(),
    tagFollows: new Map<string, { tagId: string; userId: string }>(),
    categories: new Map<string, Category>(),
    tags: new Map<string, Tag>(),
    notifications: new Map<string, Notification>()
  };

  const calls: Record<string, number> = {};
  for (const method of METHODS) calls[method] = 0;
  let denyAll = false;

  const count = (name: string): void => {
    calls[name] = (calls[name] ?? 0) + 1;
    if (denyAll) throw denied();
  };

  const answersOf = (doubtId: string): Answer[] =>
    Array.from(store.answers.values()).filter(answer => answer.doubtId === doubtId);

  const commentsOf = (doubtId: string): CommentRecord[] =>
    Array.from(store.comments.values()).filter(comment => comment.doubtId === doubtId);

  const requireDoubt = (id: string): Doubt => {
    const doubt = store.doubts.get(id);
    if (!doubt) throw notFound();
    return doubt;
  };

  const applyVoteDelta = (current: number, before: number, after: number): number =>
    Math.max(0, current - (before === 1 ? 1 : 0) + (after === 1 ? 1 : 0));

  const adapter: FakeContentAdapter = {
    calls,

    doubts: () => Array.from(store.doubts.values()),
    answers: answersOf,
    comments: commentsOf,
    categories: () => Array.from(store.categories.values()),
    tags: () => Array.from(store.tags.values()),
    notificationsFor: userId =>
      Array.from(store.notifications.values())
        .filter(item => item.userId === userId)
        .reverse(),
    bookmarkIds: actorId =>
      Array.from(store.bookmarks.values())
        .filter(item => item.userId === actorId)
        .map(item => item.doubtId),
    followIds: actorId =>
      Array.from(store.follows.values())
        .filter(item => item.userId === actorId)
        .map(item => item.targetUserId),
    tagFollowIds: actorId =>
      Array.from(store.tagFollows.values())
        .filter(item => item.userId === actorId)
        .map(item => item.tagId),

    setDenied(denied: boolean): void {
      denyAll = denied;
    },

    reset(): void {
      denyAll = false;
      for (const method of METHODS) calls[method] = 0;
      store.doubts.clear();
      store.answers.clear();
      store.comments.clear();
      store.votes.clear();
      store.bookmarks.clear();
      store.follows.clear();
      store.tagFollows.clear();
      store.categories.clear();
      store.tags.clear();
      store.notifications.clear();
    },

    // -------------------------------------------------------------- Doubts
    async listDoubts(): Promise<Doubt[]> {
      count('listDoubts');
      return adapter.doubts().map(item => ({ ...item }));
    },

    async getDoubt(id: string): Promise<Doubt | null> {
      count('getDoubt');
      const doubt = store.doubts.get(id);
      return doubt ? { ...doubt } : null;
    },

    async createDoubt(doubt: Doubt): Promise<Doubt> {
      count('createDoubt');
      const id = nextId('doubt');
      const created: Doubt = {
        ...doubt,
        id,
        createdAt: relativeTime(Date.now()),
        lastAnswerId: null,
        acceptedAnswerId: null
      };
      store.doubts.set(id, created);
      return { ...created };
    },

    async updateDoubt(id: string, patch: DoubtContentPatch): Promise<Doubt> {
      count('updateDoubt');
      const existing = { ...requireDoubt(id), ...patch };
      store.doubts.set(id, existing);
      return { ...existing };
    },

    async deleteDoubt(id: string): Promise<void> {
      count('deleteDoubt');
      requireDoubt(id);
      store.doubts.delete(id);
      for (const [key, answer] of store.answers) {
        if (answer.doubtId === id) store.answers.delete(key);
      }
      for (const [key, comment] of store.comments) {
        if (comment.doubtId === id) store.comments.delete(key);
      }
    },

    async setDoubtState(id: string, patch: DoubtStatePatch): Promise<void> {
      count('setDoubtState');
      store.doubts.set(id, { ...requireDoubt(id), ...patch });
    },

    // ------------------------------------------------------------- Answers
    async listAnswers(doubtId: string): Promise<Answer[]> {
      count('listAnswers');
      return answersOf(doubtId).map(item => ({ ...item, comments: [] }));
    },

    async createAnswer(answer: Answer): Promise<Answer> {
      count('createAnswer');
      const doubt = requireDoubt(answer.doubtId);
      const id = nextId('ans');
      const created: Answer = { ...answer, id, comments: [] };
      store.answers.set(id, created);
      store.doubts.set(doubt.id, {
        ...doubt,
        answersCount: doubt.answersCount + 1,
        lastAnswerId: id
      });
      return { ...created };
    },

    async updateAnswer(doubtId: string, answerId: string, patch: AnswerContentPatch): Promise<Answer> {
      count('updateAnswer');
      const existing = store.answers.get(answerId);
      if (!existing || existing.doubtId !== doubtId) throw notFound();
      const updated = { ...existing, ...patch };
      store.answers.set(answerId, updated);
      return { ...updated };
    },

    async deleteAnswer(doubtId: string, answerId: string): Promise<void> {
      count('deleteAnswer');
      const existing = store.answers.get(answerId);
      if (!existing || existing.doubtId !== doubtId) throw notFound();
      store.answers.delete(answerId);
      for (const [key, comment] of store.comments) {
        if (comment.doubtId === doubtId && comment.answerId === answerId) store.comments.delete(key);
      }
      const doubt = requireDoubt(doubtId);
      const next = Math.max(0, doubt.answersCount - 1);
      store.doubts.set(doubtId, {
        ...doubt,
        answersCount: next,
        lastAnswerId: next === doubt.answersCount ? doubt.lastAnswerId : answerId
      });
    },

    async setAnswerState(doubtId: string, answerId: string, patch: AnswerStatePatch): Promise<void> {
      count('setAnswerState');
      const existing = store.answers.get(answerId);
      if (!existing || existing.doubtId !== doubtId) throw notFound();
      store.answers.set(answerId, { ...existing, ...patch });
    },

    async setAcceptedAnswer(doubtId: string, answerId: string | null, accepted: boolean): Promise<void> {
      count('setAcceptedAnswer');
      const doubt = requireDoubt(doubtId);
      for (const answer of answersOf(doubtId)) {
        store.answers.set(answer.id, { ...answer, isAccepted: Boolean(accepted && answer.id === answerId) });
      }
      store.doubts.set(doubtId, {
        ...doubt,
        hasAcceptedAnswer: Boolean(accepted && answerId),
        acceptedAnswerId: accepted && answerId ? answerId : null
      });
    },

    // ------------------------------------------------------------ Comments
    async listComments(doubtId: string): Promise<CommentRecord[]> {
      count('listComments');
      return commentsOf(doubtId).map(item => ({ ...item }));
    },

    async createComment(doubtId: string, answerId: string | null, comment: Comment): Promise<CommentRecord> {
      count('createComment');
      requireDoubt(doubtId);
      const created: CommentRecord = {
        ...comment,
        id: nextId('comm'),
        doubtId,
        answerId: answerId ?? ''
      };
      store.comments.set(created.id, created);
      return { ...created };
    },

    async deleteComment(doubtId: string, commentId: string): Promise<void> {
      count('deleteComment');
      const existing = store.comments.get(commentId);
      if (!existing || existing.doubtId !== doubtId) throw notFound();
      store.comments.delete(commentId);
    },

    // --------------------------------------------------------------- Votes
    async listVotes(actorId: string): Promise<UserVotes> {
      count('listVotes');
      const votes: UserVotes = { doubts: {}, answers: {} };
      for (const vote of store.votes.values()) {
        if (vote.userId !== actorId) continue;
        if (vote.targetType === 'answer') votes.answers[vote.targetId] = vote.value;
        else votes.doubts[vote.targetId] = vote.value;
      }
      return votes;
    },

    async saveVote(actorId: string, write: VoteWrite): Promise<void> {
      count('saveVote');
      const key = `${write.targetType === 'doubt' ? 'd' : 'a'}_${write.targetId}_${actorId}`;
      const previous = store.votes.get(key)?.value ?? 0;
      const next = write.value;

      if (next === 0) store.votes.delete(key);
      else store.votes.set(key, { targetType: write.targetType, targetId: write.targetId, value: next, userId: actorId });

      const upBefore = previous === 1 ? 1 : 0;
      const upAfter = next === 1 ? 1 : 0;
      const downBefore = previous === -1 ? 1 : 0;
      const downAfter = next === -1 ? 1 : 0;

      if (write.targetType === 'doubt') {
        const doubt = requireDoubt(write.targetId);
        store.doubts.set(doubt.id, {
          ...doubt,
          upvotes: applyVoteDelta(doubt.upvotes, upBefore, upAfter),
          downvotes: applyVoteDelta(doubt.downvotes, downBefore, downAfter)
        });
      } else {
        const answer = store.answers.get(write.targetId);
        if (!answer) throw notFound();
        store.answers.set(answer.id, {
          ...answer,
          upvotes: applyVoteDelta(answer.upvotes, upBefore, upAfter),
          downvotes: applyVoteDelta(answer.downvotes, downBefore, downAfter)
        });
      }
    },

    // ---------------------------------------------------------- Bookmarks
    async listBookmarkIds(actorId: string): Promise<string[]> {
      count('listBookmarkIds');
      return adapter.bookmarkIds(actorId);
    },

    async setBookmark(actorId: string, doubtId: string, bookmarked: boolean): Promise<void> {
      count('setBookmark');
      const key = `${doubtId}_${actorId}`;
      if (bookmarked) store.bookmarks.set(key, { doubtId, userId: actorId });
      else store.bookmarks.delete(key);
    },

    async listFollowingUserIds(actorId: string): Promise<string[]> {
      count('listFollowingUserIds');
      return adapter.followIds(actorId);
    },

    async setFollowing(actorId: string, userId: string, following: boolean): Promise<void> {
      count('setFollowing');
      const key = `${userId}_${actorId}`;
      if (following) store.follows.set(key, { targetUserId: userId, userId: actorId });
      else store.follows.delete(key);
    },

    async listFollowingTagIds(actorId: string): Promise<string[]> {
      count('listFollowingTagIds');
      return adapter.tagFollowIds(actorId);
    },

    async setTagFollowing(actorId: string, tagId: string, following: boolean): Promise<void> {
      count('setTagFollowing');
      const key = `${tagId}_${actorId}`;
      if (following) store.tagFollows.set(key, { tagId, userId: actorId });
      else store.tagFollows.delete(key);
      const tag = store.tags.get(tagId);
      if (tag) {
        store.tags.set(tagId, {
          ...tag,
          followersCount: Math.max(0, tag.followersCount + (following ? 1 : -1))
        });
      }
    },

    // ------------------------------------------------------------- Catalog
    async listCategories(): Promise<Category[]> {
      count('listCategories');
      return adapter.categories().map(item => ({ ...item }));
    },

    async createCategory(category: Category): Promise<Category> {
      count('createCategory');
      const created = { ...category, questionsCount: 0 };
      store.categories.set(created.id, created);
      return { ...created };
    },

    async deleteCategory(id: string): Promise<void> {
      count('deleteCategory');
      store.categories.delete(id);
    },

    async adjustQuestionCount(categoryName: string, delta: number): Promise<void> {
      count('adjustQuestionCount');
      const target = Array.from(store.categories.values()).find(c => c.name === categoryName);
      if (!target) return;
      store.categories.set(target.id, {
        ...target,
        questionsCount: Math.max(0, target.questionsCount + delta)
      });
    },

    async listTags(): Promise<Tag[]> {
      count('listTags');
      return adapter.tags().map(item => ({ ...item }));
    },

    async createTag(tag: Tag): Promise<Tag> {
      count('createTag');
      store.tags.set(tag.id, { ...tag });
      return { ...tag };
    },

    // ------------------------------------------------------- Notifications
    async listNotifications(actorId: string): Promise<Notification[]> {
      count('listNotifications');
      return adapter.notificationsFor(actorId).map(item => ({ ...item }));
    },

    async createNotification(notification: Notification): Promise<Notification> {
      count('createNotification');
      const created: Notification = { ...notification, id: nextId('notif') };
      store.notifications.set(created.id, created);
      return { ...created };
    },

    async markNotificationRead(_actorId: string, id: string): Promise<void> {
      count('markNotificationRead');
      const existing = store.notifications.get(id);
      if (!existing) throw notFound();
      store.notifications.set(id, { ...existing, read: true });
    },

    async markAllNotificationsRead(_actorId: string, ids: string[]): Promise<void> {
      count('markAllNotificationsRead');
      for (const id of ids) {
        const existing = store.notifications.get(id);
        if (existing) store.notifications.set(id, { ...existing, read: true });
      }
    }
  };

  return adapter;
}
