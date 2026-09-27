import { Answer, Comment, User, toUserSnapshot } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';

interface AnswerState {
  answers: Answer[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<AnswerState>({ answers: [], status: 'loading' });

export function canEditAnswer(answer: Answer, actor: User | null | undefined): boolean {
  if (!actor || !answer) return false;
  return actor.role === 'admin' || answer.authorId === actor.id;
}

export const answerService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  getAll(): Answer[] {
    return store.get().answers;
  },

  getForDoubt(doubtId: string): Answer[] {
    return store
      .get()
      .answers.filter(a => a.doubtId === doubtId)
      .sort(
        (a, b) =>
          (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0) || b.upvotes - a.upvotes
      );
  },

  add(
    doubtId: string,
    author: User,
    content: string,
    codeSnippet?: Answer['codeSnippet'],
    mentions?: string[]
  ): Answer {
    const trimmed = content.trim();
    if (!trimmed) throw new ServiceError('answer/invalid', 'An answer cannot be empty.');

    const newAnswer: Answer = {
      id: `ans-${Date.now()}`,
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

    store.set(prev => ({ ...prev, answers: [...prev.answers, newAnswer] }));
    return newAnswer;
  },

  update(
    answerId: string,
    actor: User,
    patch: { content?: string; codeSnippet?: Answer['codeSnippet'] }
  ): Answer {
    const existing = store.get().answers.find(a => a.id === answerId);
    if (!existing) throw new ServiceError('answer/not-found', 'That answer no longer exists.');
    if (!canEditAnswer(existing, actor)) {
      throw new ServiceError('answer/forbidden', 'Only the author or an admin can edit this answer.');
    }
    if (patch.content !== undefined && !patch.content.trim()) {
      throw new ServiceError('answer/invalid', 'An answer cannot be empty.');
    }

    const updated: Answer = {
      ...existing,
      content: patch.content !== undefined ? patch.content.trim() : existing.content,
      codeSnippet: patch.codeSnippet !== undefined ? patch.codeSnippet : existing.codeSnippet,
      updatedAt: 'Just now'
    };

    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a => (a.id === answerId ? updated : a))
    }));
    return updated;
  },

  remove(answerId: string, actor: User): Answer {
    const existing = store.get().answers.find(a => a.id === answerId);
    if (!existing) throw new ServiceError('answer/not-found', 'That answer no longer exists.');
    if (!canEditAnswer(existing, actor)) {
      throw new ServiceError('answer/forbidden', 'Only the author or an admin can delete this answer.');
    }
    store.set(prev => ({ ...prev, answers: prev.answers.filter(a => a.id !== answerId) }));
    return existing;
  },

  vote(answerId: string, type: 'up' | 'down'): void {
    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a => {
        if (a.id !== answerId) return a;
        const currentVote = a.userVote;
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

        return {
          ...a,
          upvotes: Math.max(0, a.upvotes + upDelta),
          downvotes: Math.max(0, a.downvotes + downDelta),
          userVote: newVote
        };
      })
    }));
  },

  /** Single accepted answer per doubt. Returns true when the answer is now accepted. */
  setAccepted(doubtId: string, answerId: string): boolean {
    let nowAccepted = false;

    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a => {
        if (a.doubtId !== doubtId) return a;
        if (a.id === answerId) {
          nowAccepted = !a.isAccepted;
          return { ...a, isAccepted: nowAccepted };
        }
        return a.isAccepted ? { ...a, isAccepted: false } : a;
      })
    }));

    return nowAccepted;
  },

  addComment(
    answerId: string,
    author: User,
    content: string,
    parentCommentId?: string,
    mentions?: string[]
  ): Comment {
    const trimmed = content.trim();
    if (!trimmed) throw new ServiceError('comment/invalid', 'A comment cannot be empty.');

    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      authorId: author.id,
      authorName: author.name,
      authorAvatar: author.avatar,
      content: trimmed,
      createdAt: 'Just now',
      parentCommentId,
      mentions
    };

    store.set(prev => ({
      ...prev,
      answers: prev.answers.map(a =>
        a.id === answerId ? { ...a, comments: [...a.comments, newComment] } : a
      )
    }));
    return newComment;
  },

  removeForDoubt(doubtId: string): void {
    store.set(prev => ({
      ...prev,
      answers: prev.answers.filter(a => a.doubtId !== doubtId)
    }));
  }
};

export function useAnswersStore(): AnswerState {
  return useStore(store);
}
