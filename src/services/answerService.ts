import { Answer, User, toUserSnapshot } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { getContentAdapter } from './contentAdapter';
import type { CommentRecord, VoteValue } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { requireServiceActor } from './actor';

interface AnswerState {
  answers: Answer[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<AnswerState>({ answers: [], status: 'loading', error: undefined });

export function canEditAnswer(answer: Answer, actor: User | null | undefined): boolean {
  if (!actor || !answer) return false;
  return actor.role === 'admin' || answer.authorId === actor.id;
}

function attach(answers: Answer[], comments: CommentRecord[], votes: Record<string, VoteValue>): Answer[] {
  return answers.map(answer => ({
    ...answer,
    comments: comments
      .filter(comment => comment.answerId === answer.id)
      .map(({ doubtId: _doubtId, answerId: _answerId, ...comment }) => comment),
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
    mentions?: string[]
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
    mentions?: string[]
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
        mentions
      })
    );

    const { doubtId: _doubtId, answerId: _answerId, ...comment } = created;
    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a =>
        a.id === answerId ? { ...a, comments: [...a.comments, comment] } : a
      )
    }));
    return created;
  },

  /** Clears local answers for a doubt that is about to be deleted. */
  removeForDoubt(doubtId: string): void {
    store.set(prev => ({ ...prev, answers: prev.answers.filter(a => a.doubtId !== doubtId) }));
  }
};

export function useAnswersStore(): AnswerState {
  return useStore(store);
}

/** Test seam: empties the answer cache without touching the adapter. */
export function resetAnswerStoreForTests(): void {
  store.set({ answers: [], status: 'loading', error: undefined });
}
