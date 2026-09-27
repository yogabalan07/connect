import { createStore, LoadStatus, useStore } from '../lib/store';
import { getContentAdapter } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { requireServiceActor } from './actor';

interface SocialState {
  bookmarkedDoubtIds: string[];
  followingUserIds: string[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<SocialState>({
  bookmarkedDoubtIds: [],
  followingUserIds: [],
  status: 'loading',
  error: undefined
});

async function viaAdapter<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

function toggle(list: string[], id: string): { next: string[]; on: boolean } {
  const on = !list.includes(id);
  return { next: on ? [...list, id] : list.filter(item => item !== id), on };
}

export const socialService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'loading', error: undefined }));
  },

  /** Reads the signed-in member's bookmarks and follows from Firestore. */
  async loadAll(actorId?: string): Promise<void> {
    const uid = actorId ?? requireServiceActor();
    try {
      const [bookmarks, following] = await Promise.all([
        viaAdapter(() => getContentAdapter().listBookmarkIds(uid)),
        viaAdapter(() => getContentAdapter().listFollowingUserIds(uid))
      ]);
      store.set(prev => ({
        ...prev,
        bookmarkedDoubtIds: bookmarks,
        followingUserIds: following,
        status: 'ready',
        error: undefined
      }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
  },

  isBookmarked(doubtId: string): boolean {
    return store.get().bookmarkedDoubtIds.includes(doubtId);
  },

  /** Returns true when the bookmark now exists (persisted, not local). */
  async toggleBookmark(doubtId: string): Promise<boolean> {
    const actorId = requireServiceActor();
    const previous = store.get().bookmarkedDoubtIds;
    const { next, on } = toggle(previous, doubtId);
    store.set(prev => ({ ...prev, bookmarkedDoubtIds: next }));
    try {
      await viaAdapter(() => getContentAdapter().setBookmark(actorId, doubtId, on));
      return on;
    } catch (error) {
      store.set(prev => ({ ...prev, bookmarkedDoubtIds: previous }));
      throw error;
    }
  },

  isFollowing(userId: string): boolean {
    return store.get().followingUserIds.includes(userId);
  },

  /** Returns true when the user is now followed (persisted, not local). */
  async toggleFollow(userId: string): Promise<boolean> {
    const actorId = requireServiceActor();
    const previous = store.get().followingUserIds;
    const { next, on } = toggle(previous, userId);
    store.set(prev => ({ ...prev, followingUserIds: next }));
    try {
      await viaAdapter(() => getContentAdapter().setFollowing(actorId, userId, on));
      return on;
    } catch (error) {
      store.set(prev => ({ ...prev, followingUserIds: previous }));
      throw error;
    }
  }
};

export function useSocialStore(): SocialState {
  return useStore(store);
}

/** Test seam: empties the social state without touching the adapter. */
export function resetSocialStoreForTests(): void {
  store.set({ bookmarkedDoubtIds: [], followingUserIds: [], status: 'loading', error: undefined });
}
