import { Doubt, DoubtPriority, User, toUserSnapshot } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { getContentAdapter } from './contentAdapter';
import type { UserVotes, VoteValue } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { requireServiceActor } from './actor';

interface DoubtState {
  doubts: Doubt[];
  /** The signed-in member's own votes, keyed by doubt id. */
  votes: Record<string, VoteValue>;
  status: LoadStatus;
  error?: string;
}

const store = createStore<DoubtState>({
  doubts: [],
  votes: {},
  status: 'loading',
  error: undefined
});

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
 * Private doubt access rule (frontend mirror of the Firestore rules).
 * A private doubt is visible only to: its author, explicitly allowed
 * participants and admins. Everyone else must not see any content of it.
 * `firestore.rules` enforces the same predicate server-side — this copy only
 * decides what the UI may render from data it already holds.
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

/** Pure vote transition used by both the optimistic update and the tests. */
export function nextVoteState(
  current: 'up' | 'down' | null | undefined,
  type: 'up' | 'down'
): { vote: 'up' | 'down' | null; upDelta: number; downDelta: number } {
  if (current === type) return { vote: null, upDelta: type === 'up' ? -1 : 0, downDelta: type === 'down' ? -1 : 0 };
  if (current === null || current === undefined) {
    return { vote: type, upDelta: type === 'up' ? 1 : 0, downDelta: type === 'down' ? 1 : 0 };
  }
  if (type === 'up') return { vote: 'up', upDelta: 1, downDelta: -1 };
  return { vote: 'down', upDelta: -1, downDelta: 1 };
}

function hydrate(doubt: Doubt, vote: VoteValue | undefined): Doubt {
  return {
    ...doubt,
    userVote: vote === undefined || vote === 0 ? null : vote === 1 ? 'up' : 'down'
  };
}

async function viaAdapter<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export const doubtService = {
  store,

  /**
   * Prepares the feed for this boot. The first read only happens once a
   * session exists (`firestore.rules` rejects anonymous content reads), so
   * `loadAll` is called from the session bootstrap, not from here.
   */
  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'loading', error: undefined }));
  },

  /** Reads every visible doubt plus the caller's own votes. */
  async loadAll(actorId?: string): Promise<void> {
    const uid = actorId ?? requireServiceActor();
    try {
      const [doubts, votes] = await Promise.all([
        viaAdapter(() => getContentAdapter().listDoubts(uid)),
        viaAdapter(() => getContentAdapter().listVotes(uid))
      ]);
      store.set(prev => ({
        ...prev,
        doubts: doubts
          .map(doubt => hydrate(doubt, votes.doubts[doubt.id]))
          .sort((a, b) => Number(b.isPinned ? 1 : 0) - Number(a.isPinned ? 1 : 0)),
        votes: votes.doubts,
        status: 'ready',
        error: undefined
      }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
  },

  getAll(): Doubt[] {
    return store.get().doubts;
  },

  getById(id: string): Doubt | undefined {
    return store.get().doubts.find(d => d.id === id);
  },

  async create(author: User, input: CreateDoubtInput): Promise<Doubt> {
    if (!input.title.trim() || !input.description.trim()) {
      throw new ServiceError('doubt/invalid', 'A doubt needs both a title and a description.');
    }

    const draft: Doubt = {
      // The adapter assigns the document id; this placeholder never reaches
      // Firestore because `createDoubt` overwrites it with `ref.id`.
      id: '',
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
          : [],
      priority: input.priority || 'normal',
      // Counters start at zero: a vote is a separate, rule-checked document.
      upvotes: 0,
      downvotes: 0,
      views: 0,
      answersCount: 0,
      hasAcceptedAnswer: false,
      codeSnippet: input.codeSnippet,
      attachments: input.attachments,
      mentions: input.mentions
    };

    const created = await viaAdapter(() => getContentAdapter().createDoubt(draft));
    store.set(prev => ({ ...prev, doubts: [hydrate(created, 0), ...prev.doubts] }));
    return created;
  },

  async update(doubtId: string, actor: User, patch: UpdateDoubtInput): Promise<Doubt> {
    const existing = doubtService.getById(doubtId);
    if (!existing) throw new ServiceError('doubt/not-found', 'That doubt no longer exists.');
    if (!canEditDoubt(existing, actor)) {
      throw new ServiceError('doubt/forbidden', 'Only the author or an admin can edit this doubt.');
    }

    const visibility = patch.visibility ?? existing.visibility;
    const allowedUserIds =
      visibility === 'private'
        ? Array.from(
            new Set([existing.authorId, ...(patch.allowedUserIds ?? existing.allowedUserIds ?? [])])
          )
        : [];

    const updated = await viaAdapter(() =>
      getContentAdapter().updateDoubt(doubtId, { ...patch, visibility, allowedUserIds })
    );
    const merged: Doubt = { ...existing, ...updated, allowedUserIds };
    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.map(d => (d.id === doubtId ? merged : d))
    }));
    return merged;
  },

  async remove(doubtId: string): Promise<void> {
    await viaAdapter(() => getContentAdapter().deleteDoubt(doubtId));
    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.filter(d => d.id !== doubtId),
      votes: omit(store.get().votes, doubtId)
    }));
  },

  /**
   * Applies the voter's own transition optimistically, persists the vote
   * document and the counters together, and rolls the snapshot back if
   * Firestore rejects the write.
   */
  async vote(doubtId: string, type: 'up' | 'down'): Promise<void> {
    const actorId = requireServiceActor();
    const doubt = doubtService.getById(doubtId);
    if (!doubt) throw new ServiceError('doubt/not-found', 'That doubt no longer exists.');

    const previous = store.get();
    const previousVote = previous.votes[doubtId] ?? 0;
    const transition = nextVoteState(
      previousVote === 1 ? 'up' : previousVote === -1 ? 'down' : null,
      type
    );
    const value: VoteValue = transition.vote === 'up' ? 1 : transition.vote === 'down' ? -1 : 0;
    const nextVotes = { ...previous.votes };
    if (value === 0) delete nextVotes[doubtId];
    else nextVotes[doubtId] = value;

    const optimistic: Doubt = {
      ...doubt,
      upvotes: Math.max(0, doubt.upvotes + transition.upDelta),
      downvotes: Math.max(0, doubt.downvotes + transition.downDelta),
      userVote: transition.vote
    };
    store.set(prev => ({
      ...prev,
      votes: nextVotes,
      doubts: prev.doubts.map(d => (d.id === doubtId ? optimistic : d))
    }));

    try {
      await viaAdapter(() =>
        getContentAdapter().saveVote(actorId, {
          targetType: 'doubt',
          doubtId,
          targetId: doubtId,
          value,
          upvotes: optimistic.upvotes,
          downvotes: optimistic.downvotes
        })
      );
    } catch (error) {
      store.set(prev => ({ ...prev, ...previous }));
      throw error;
    }
  },

  /** Records the viewer's visit (rules allow at most +1 per write). */
  async incrementViews(doubtId: string): Promise<void> {
    const doubt = doubtService.getById(doubtId);
    if (!doubt) return;
    const next = doubt.views + 1;
    store.set(prev => ({
      ...prev,
      doubts: prev.doubts.map(d => (d.id === doubtId ? { ...d, views: next } : d))
    }));
    try {
      await viaAdapter(() => getContentAdapter().setDoubtState(doubtId, { views: next }));
    } catch (error) {
      // A lost view counter must never break the detail page.
      store.set(prev => ({
        ...prev,
        doubts: prev.doubts.map(d => (d.id === doubtId ? { ...d, views: doubt.views } : d))
      }));
      void mapFirestoreError(error);
    }
  }
};

function omit(source: Record<string, VoteValue>, key: string): Record<string, VoteValue> {
  if (!(key in source)) return source;
  const next = { ...source };
  delete next[key];
  return next;
}

export function useDoubtsStore(): DoubtState {
  return useStore(store);
}

/** Test seam: empties the feed without touching the adapter. */
export function resetDoubtStoreForTests(): void {
  store.set({ doubts: [], votes: {}, status: 'loading', error: undefined });
}
