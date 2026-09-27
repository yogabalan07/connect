import { Answer, Comment, User, toUserSnapshot } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { getContentAdapter } from './contentAdapter';
import type { CommentRecord, VoteValue } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { requireServiceActor } from './actor';

interface AnswerState {
  answers: Answer[];
  /**
   * Doubt-level clarifications for the doubt currently on screen
   * (`answerId === ''` in storage). Answer-attached comments live on the
   * answer itself, because one read of `doubts/{id}/comments` hydrates both.
   */
  doubtComments: CommentRecord[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<AnswerState>({
  answers: [],
  doubtComments: [],
  status: 'loading',
  error: undefined
});

export function canEditAnswer(answer: Answer, actor: User | null | undefined): boolean {
  if (!actor || !answer) return false;
  return actor.role === 'admin' || answer.authorId === actor.id;
}

/** Who may rewrite a comment body: its author, or a moderator. */
export function canEditComment(comment: Comment, actor: User | null | undefined): boolean {
  if (!actor || !comment) return false;
  return actor.role === 'admin' || comment.authorId === actor.id;
}

/**
 * Who may remove a comment: the same pair. The rules additionally let the
 * author of the doubt and the author of the answer a comment hangs off clear
 * their own thread; the client keeps that narrower because those owners are
 * not exposed at the point where a delete button is rendered.
 */
export function canDeleteComment(
  comment: Comment,
  actor: User | null | undefined
): boolean {
  return canEditComment(comment, actor);
}

/** Strips the storage-only fields so callers see a plain `Comment`. */
function toComment(record: CommentRecord): Comment {
  const { doubtId: _doubtId, answerId: _answerId, ...comment } = record;
  return comment;
}

function attach(answers: Answer[], comments: CommentRecord[], votes: Record<string, VoteValue>): Answer[] {
  return answers.map(answer => ({
    ...answer,
    comments: comments
      .filter(comment => comment.answerId === answer.id)
      .map(toComment),
    userVote: votes[answer.id] === undefined ? null : votes[answer.id] === 1 ? 'up' : 'down'
  }));
}

async function viaAdapter<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

function findAnswer(answerId: string): Answer {
  const answer = store.get().answers.find(a => a.id === answerId);
  if (!answer) throw new ServiceError('answer/not-found', 'That answer no longer exists.');
  return answer;
}

/**
 * Locates a comment across both homes it can live in - the doubt's own
 * thread and every answer's thread - and rebuilds the storage-only fields
 * answer-level comments lose when they are attached to their answer.
 */
function findComment(commentId: string): CommentRecord {
  const doubtLevel = store.get().doubtComments.find(c => c.id === commentId);
  if (doubtLevel) return doubtLevel;
  for (const answer of store.get().answers) {
    const found = answer.comments.find(c => c.id === commentId);
    if (found) return { ...found, doubtId: answer.doubtId, answerId: answer.id };
  }
  throw new ServiceError('comment/not-found', 'That comment no longer exists.');
}

function replaceComment(previous: CommentRecord, next: CommentRecord): void {
  store.set(prev => ({
    ...prev,
    doubtComments: prev.doubtComments.map(c => (c.id === previous.id ? next : c)),
    answers: prev.answers.map(answer =>
      answer.comments.some(c => c.id === previous.id)
        ? {
            ...answer,
            comments: answer.comments.map(c => (c.id === previous.id ? toComment(next) : c))
          }
        : answer
    )
  }));
}

export const answerService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'loading', error: undefined }));
  },

  /**
   * Loads one doubt's answers and its clarification comments in two reads.
   * Answers are never listed globally: `firestore.rules` scopes them under
   * the doubt, so a detail page is the only place they exist.
   */
  async loadForDoubt(doubtId: string): Promise<void> {
    if (!doubtId) return;
    const actorId = requireServiceActor();
    try {
      const [answers, comments, votes] = await Promise.all([
        viaAdapter(() => getContentAdapter().listAnswers(doubtId)),
        viaAdapter(() => getContentAdapter().listComments(doubtId)),
        viaAdapter(() => getContentAdapter().listVotes(actorId))
      ]);
      store.set(prev => ({
        ...prev,
        answers: attach(answers, comments, votes.answers),
        doubtComments: comments.filter(comment => !comment.answerId),
        status: 'ready',
        error: undefined
      }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
  },

  getAll(): Answer[] {
    return store.get().answers;
  },

  getForDoubt(doubtId: string): Answer[] {
    return store
      .get()
      .answers.filter(a => a.doubtId === doubtId)
      .sort(
        (a, b) => (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0) || b.upvotes - a.upvotes
      );
  },

  async add(
    doubtId: string,
    author: User,
    content: string,
    codeSnippet?: Answer['codeSnippet'],
    mentions?: string[],
    mentionIds?: string[]
  ): Promise<Answer> {
    const trimmed = content.trim();
    if (!trimmed) throw new ServiceError('answer/invalid', 'An answer cannot be empty.');

    const draft: Answer = {
      id: '',
      doubtId,
      authorId: author.id,
      authorSnapshot: toUserSnapshot(author),
      content: trimmed,
      createdAt: 'Just now',
      upvotes: 0,
      downvotes: 0,
      isAccepted: false,
      codeSnippet,
      mentions,
      mentionIds,
      comments: []
    };

    const created = await viaAdapter(() => getContentAdapter().createAnswer(draft));
    store.set(prev => ({ ...prev, answers: [...prev.answers, { ...created, comments: [], userVote: null }] }));
    return created;
  },

  async update(
    answerId: string,
    actor: User,
    patch: { content?: string; codeSnippet?: Answer['codeSnippet'] }
  ): Promise<Answer> {
    const existing = findAnswer(answerId);
    if (!canEditAnswer(existing, actor)) {
      throw new ServiceError('answer/forbidden', 'Only the author or an admin can edit this answer.');
    }
    if (patch.content !== undefined && !patch.content.trim()) {
      throw new ServiceError('answer/invalid', 'An answer cannot be empty.');
    }

    const updated = await viaAdapter(() => getContentAdapter().updateAnswer(existing.doubtId, answerId, patch));
    const merged = { ...existing, ...updated };
    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a => (a.id === answerId ? { ...merged, comments: a.comments } : a))
    }));
    return merged;
  },

  async remove(answerId: string, actor: User): Promise<Answer> {
    const existing = findAnswer(answerId);
    if (!canEditAnswer(existing, actor)) {
      throw new ServiceError('answer/forbidden', 'Only the author or an admin can delete this answer.');
    }
    await viaAdapter(() => getContentAdapter().deleteAnswer(existing.doubtId, answerId));
    store.set(prev => ({ ...prev, answers: prev.answers.filter(a => a.id !== answerId) }));
    return existing;
  },

  /** Applies the voter's own transition and persists it with the counters. */
  async vote(answerId: string, type: 'up' | 'down'): Promise<void> {
    const actorId = requireServiceActor();
    const answer = findAnswer(answerId);
    const previous = store.get();

    const currentVote = answer.userVote;
    let newVote: 'up' | 'down' | null = type;
    let upDelta = 0;
    let downDelta = 0;
    if (currentVote === type) {
      newVote = null;
      if (type === 'up') upDelta = -1;
      else downDelta = -1;
    } else if (currentVote === null || currentVote === undefined) {
      if (type === 'up') upDelta = 1;
      else downDelta = 1;
    } else if (type === 'up') {
      upDelta = 1;
      downDelta = -1;
    } else {
      upDelta = -1;
      downDelta = 1;
    }

    const optimistic: Answer = {
      ...answer,
      upvotes: Math.max(0, answer.upvotes + upDelta),
      downvotes: Math.max(0, answer.downvotes + downDelta),
      userVote: newVote
    };
    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a => (a.id === answerId ? optimistic : a))
    }));

    try {
      await viaAdapter(() =>
        getContentAdapter().saveVote(actorId, {
          targetType: 'answer',
          doubtId: answer.doubtId,
          targetId: answerId,
          value: newVote === 'up' ? 1 : newVote === 'down' ? -1 : 0,
          upvotes: optimistic.upvotes,
          downvotes: optimistic.downvotes
        })
      );
    } catch (error) {
      store.set(prev => ({ ...prev, ...previous }));
      throw error;
    }
  },

  /**
   * Single accepted answer per doubt. Returns true when the answer is now
   * accepted; the adapter clears every other accepted answer in the same
   * atomic batch as the doubt's `acceptedAnswerId`.
   */
  async setAccepted(doubtId: string, answerId: string): Promise<boolean> {
    const target = store.get().answers.find(a => a.id === answerId);
    if (!target) throw new ServiceError('answer/not-found', 'That answer no longer exists.');
    const nowAccepted = !target.isAccepted;

    await viaAdapter(() => getContentAdapter().setAcceptedAnswer(doubtId, answerId, nowAccepted));
    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a =>
        a.doubtId === doubtId ? { ...a, isAccepted: a.id === answerId ? nowAccepted : false } : a
      )
    }));
    return nowAccepted;
  },

  async addComment(
    answerId: string,
    author: User,
    content: string,
    parentCommentId?: string,
    mentions?: string[],
    mentionIds?: string[]
  ): Promise<CommentRecord> {
    const trimmed = content.trim();
    if (!trimmed) throw new ServiceError('comment/invalid', 'A comment cannot be empty.');
    const answer = findAnswer(answerId);

    const created = await viaAdapter(() =>
      getContentAdapter().createComment(answer.doubtId, answerId, {
        id: '',
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        content: trimmed,
        createdAt: 'Just now',
        parentCommentId,
        mentions,
        mentionIds
      })
    );

    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a =>
        a.id === answerId ? { ...a, comments: [...a.comments, toComment(created)] } : a
      )
    }));
    return created;
  },

  /** Doubt-level clarifications: the same collection, `answerId` empty. */
  getDoubtComments(doubtId: string): Comment[] {
    return store
      .get()
      .doubtComments.filter(comment => comment.doubtId === doubtId)
      .map(toComment);
  },

  async addDoubtComment(
    doubtId: string,
    author: User,
    content: string,
    parentCommentId?: string,
    mentions?: string[],
    mentionIds?: string[]
  ): Promise<CommentRecord> {
    const trimmed = content.trim();
    if (!trimmed) throw new ServiceError('comment/invalid', 'A comment cannot be empty.');

    const created = await viaAdapter(() =>
      getContentAdapter().createComment(doubtId, null, {
        id: '',
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        content: trimmed,
        createdAt: 'Just now',
        parentCommentId,
        mentions,
        mentionIds
      })
    );

    store.set(prev => ({ ...prev, doubtComments: [...prev.doubtComments, created] }));
    return created;
  },

  /**
   * Edits a comment body. The rules are the boundary - they allow the author
   * and a moderator - but the guard runs first so the UI can explain the
   * refusal instead of surfacing a raw permission error.
   */
  async updateComment(commentId: string, actor: User, content: string): Promise<void> {
    const target = findComment(commentId);
    if (!canEditComment(target, actor)) {
      throw new ServiceError('comment/forbidden', 'Only the author or an admin can edit this comment.');
    }
    const trimmed = content.trim();
    if (!trimmed) throw new ServiceError('comment/invalid', 'A comment cannot be empty.');
    if (trimmed === target.content) return;

    const updated = await viaAdapter(() =>
      getContentAdapter().updateComment(target.doubtId, commentId, { content: trimmed })
    );
    replaceComment(target, updated);
  },

  /** Deletes a comment: the author, or an admin moderating the thread. */
  async removeComment(commentId: string, actor: User): Promise<void> {
    const target = findComment(commentId);
    if (!canDeleteComment(target, actor)) {
      throw new ServiceError('comment/forbidden', 'Only the author or an admin can delete this comment.');
    }
    await viaAdapter(() => getContentAdapter().deleteComment(target.doubtId, commentId));
    store.set(prev => ({
      ...prev,
      doubtComments: prev.doubtComments.filter(comment => comment.id !== commentId),
      answers: prev.answers.map(answer =>
        answer.comments.some(comment => comment.id === commentId)
          ? { ...answer, comments: answer.comments.filter(comment => comment.id !== commentId) }
          : answer
      )
    }));
  },

  /** Clears local answers for a doubt that is about to be deleted. */
  removeForDoubt(doubtId: string): void {
    store.set(prev => ({
      ...prev,
      answers: prev.answers.filter(a => a.doubtId !== doubtId),
      doubtComments: prev.doubtComments.filter(comment => comment.doubtId !== doubtId)
    }));
  }
};

export function useAnswersStore(): AnswerState {
  return useStore(store);
}

/** Test seam: empties the answer cache without touching the adapter. */
export function resetAnswerStoreForTests(): void {
  store.set({ answers: [], doubtComments: [], status: 'loading', error: undefined });
}
