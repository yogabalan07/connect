import { createStore, LoadStatus, useStore } from '../lib/store';

interface SocialState {
  bookmarkedDoubtIds: string[];
  followingUserIds: string[];
  status: LoadStatus;
}

const store = createStore<SocialState>({
  bookmarkedDoubtIds: ['doubt-1', 'doubt-5', 'doubt-10'],
  followingUserIds: ['user-2', 'user-6', 'user-15'],
  status: 'loading'
});

export const socialService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  isBookmarked(doubtId: string): boolean {
    return store.get().bookmarkedDoubtIds.includes(doubtId);
  },

  /** Returns true when the bookmark now exists. */
  toggleBookmark(doubtId: string): boolean {
    let bookmarked = false;
    store.set(prev => {
      const exists = prev.bookmarkedDoubtIds.includes(doubtId);
      bookmarked = !exists;
      return {
        ...prev,
        bookmarkedDoubtIds: exists
          ? prev.bookmarkedDoubtIds.filter(id => id !== doubtId)
          : [...prev.bookmarkedDoubtIds, doubtId]
      };
    });
    return bookmarked;
  },

  isFollowing(userId: string): boolean {
    return store.get().followingUserIds.includes(userId);
  },

  /** Returns true when the user is now followed. */
  toggleFollow(userId: string): boolean {
    let following = false;
    store.set(prev => {
      const exists = prev.followingUserIds.includes(userId);
      following = !exists;
      return {
        ...prev,
        followingUserIds: exists
          ? prev.followingUserIds.filter(id => id !== userId)
          : [...prev.followingUserIds, userId]
      };
    });
    return following;
  }
};

export function useSocialStore(): SocialState {
  return useStore(store);
}
