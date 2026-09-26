import { Doubt, DoubtPriority, User, toUserSnapshot } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { allMockDoubts } from '../data/mockDoubts';

interface DoubtState {
  doubts: Doubt[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<DoubtState>({ doubts: allMockDoubts, status: 'loading' });

export interface CreateDoubtInput {
  title: string;
  description: string;
  category: string;
  subject: string;
  tags: string[];
  visibility: 'public' | 'private';
  allowedUserIds?: string[];
  priority?: DoubtPriority;
  codeSnippet?: Doubt['codeSnippet'];
  attachments?: Doubt['attachments'];
  mentions?: string[];
}

export interface UpdateDoubtInput {
  title?: string;
  description?: string;
  category?: string;
  subject?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  allowedUserIds?: string[];
  priority?: DoubtPriority;
  codeSnippet?: Doubt['codeSnippet'];
  attachments?: Doubt['attachments'];
}

/**
 * Private doubt access rule (frontend mirror of future Firestore rules).
 * A private doubt is visible only to: its author, explicitly allowed
 * participants and admins. Everyone else must not see any content of it.
 */
export function canViewDoubt(doubt: Doubt, viewer: User | null | undefined): boolean {
  if (!doubt) return false;
  if (doubt.visibility === 'public') return true;
  if (!viewer) return false;
  if (viewer.role === 'admin') return true;
  if (doubt.authorId === viewer.id) return true;
  return Boolean(doubt.allowedUserIds && doubt.allowedUserIds.includes(viewer.id));
}

/** Deny-by-default filter for every feed/search surface. */
export function filterVisibleDoubts(doubts: Doubt[], viewer: User | null | undefined): Doubt[] {
  return doubts.filter(doubt => canViewDoubt(doubt, viewer));
}

export function canEditDoubt(doubt: Doubt, actor: User | null | undefined): boolean {
  if (!actor || !doubt) return false;
  return actor.role === 'admin' || doubt.authorId === actor.id;
}

export const doubtService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  getAll(): Doubt[] {
    return store.get().doubts;
  },

  getById(id: string): Doubt | undefined {
    return store.get().doubts.find(d => d.id === id);
  },

  create(author: User, input: CreateDoubtInput): Doubt {
    if (!input.title.trim() || !input.description.trim()) {
      throw new ServiceError('doubt/invalid', 'A doubt needs both a title and a description.');
    }

    const now = new Date();
    const newDoubt: Doubt = {
      id: `doubt-${now.getTime()}`,
      title: input.title.trim(),
      description: input.description.trim(),
      authorId: author.id,
      authorSnapshot: toUserSnapshot(author),
      createdAt: 'Just now',
      category: input.category,
      subject: input.subject,
      tags: input.tags,
      visibility: input.visibility,
      allowedUserIds:
        input.visibility === 'private'
          ? Array.from(new Set([author.id, ...(input.allowedUserIds || [])]))
          : undefined,
      priority: input.priority || 'normal',
      upvotes: 1,
      downvotes: 0,
      views: 1,
      answersCount: 0,
      hasAcceptedAnswer: false,
      codeSnippet: input.codeSnippet,
      attachments: input.attachments,
      mentions: input.mentions,
      userVote: 'up'
    };

    store.set(prev => ({ ...prev, doubts: [newDoubt, ...prev.doubts] }));
    return newDoubt;
  },

  update(doubtId: string, actor: User, patch: UpdateDoubtInput): Doubt {
    const existing = doubtService.getById(doubtId);
    if (!existing) throw new ServiceError('doubt/not-found', 'That doubt no longer exists.');
    if (!canEditDoubt(existing, actor)) {
      throw new ServiceError('doubt/forbidden', 'Only the author or an admin can edit this doubt.');
    }

    const visibility = patch.visibility ?? existing.visibility;
    const updated: Doubt = {
      ...existing,
      ...patch,
      visibility,
      allowedUserIds:
        visibility === 'private'
          ? Array.from(new Set([existing.authorId, ...(patch.allowedUserIds ?? existing.allowedUserIds ?? [])]))
          : undefined,
      updatedAt: 'Just now'
    };

    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.map(d => (d.id === doubtId ? updated : d))
    }));
    return updated;
  },

  remove(doubtId: string): void {
    store.set(prev => ({ ...prev, doubts: prev.doubts.filter(d => d.id !== doubtId) }));
  },

  vote(doubtId: string, type: 'up' | 'down'): void {
    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.map(d => {
        if (d.id !== doubtId) return d;
        const currentVote = d.userVote;
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
          ...d,
          upvotes: Math.max(0, d.upvotes + upDelta),
          downvotes: Math.max(0, d.downvotes + downDelta),
          userVote: newVote
        };
      })
    }));
  },

  setAnswersCount(doubtId: string, delta: number): void {
    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.map(d =>
        d.id === doubtId
          ? { ...d, answersCount: Math.max(0, d.answersCount + delta) }
          : d
      )
    }));
  },

  setAccepted(doubtId: string, hasAcceptedAnswer: boolean): void {
    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.map(d => (d.id === doubtId ? { ...d, hasAcceptedAnswer } : d))
    }));
  }
};

export function useDoubtsStore(): DoubtState {
  return useStore(store);
}
