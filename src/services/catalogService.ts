import { Category, Tag } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { mockCategories } from '../data/mockCategories';
import { mockTags } from '../data/mockTags';

interface CatalogState {
  categories: Category[];
  tags: Tag[];
  status: LoadStatus;
}

const store = createStore<CatalogState>({
  categories: mockCategories,
  tags: mockTags,
  status: 'loading'
});

export const catalogService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  createCategory(input: Omit<Category, 'id' | 'questionsCount'>): Category {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ServiceError('category/invalid', 'Category name is required.');

    const created: Category = {
      ...input,
      name: trimmed,
      id: `cat-${Date.now()}`,
      questionsCount: 0
    };
    store.set(prev => ({ ...prev, categories: [...prev.categories, created] }));
    return created;
  },

  deleteCategory(categoryId: string): void {
    store.set(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== categoryId)
    }));
  },

  /** Keeps `questionsCount` in sync when doubts are created/removed. */
  adjustQuestionCount(categoryName: string, delta: number): void {
    store.set(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.name === categoryName
          ? { ...c, questionsCount: Math.max(0, c.questionsCount + delta) }
          : c
      )
    }));
  },

  toggleFollowTag(tagId: string): { following: boolean; tag: Tag | undefined } {
    let following = false;
    let tag: Tag | undefined;

    store.set(prev => ({
      ...prev,
      tags: prev.tags.map(t => {
        if (t.id !== tagId) return t;
        const willFollow = !t.isFollowing;
        following = willFollow;
        tag = { ...t, isFollowing: willFollow };
        return {
          ...t,
          isFollowing: willFollow,
          followersCount: willFollow
            ? t.followersCount + 1
            : Math.max(0, t.followersCount - 1)
        };
      })
    }));

    return { following, tag };
  }
};

export function useCatalogStore(): CatalogState {
  return useStore(store);
}
