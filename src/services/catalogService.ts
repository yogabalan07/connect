import { Category, Tag } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { getContentAdapter } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';

interface CatalogState {
  categories: Category[];
  tags: Tag[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<CatalogState>({
  categories: [],
  tags: [],
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

/**
 * Academic categories and topic tags.
 *
 * These are reference data, not user content: they live in the
 * `categories` / `tags` collections, are readable by every approved member
 * and are created or deleted by an administrator. Nothing is seeded from a
 * mock array any more — an empty catalogue means the collections have not
 * been populated yet (`scripts/seed-catalog.mjs`).
 */
export const catalogService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'loading', error: undefined }));
  },

  async loadAll(): Promise<void> {
    try {
      const [categories, tags] = await Promise.all([
        viaAdapter(() => getContentAdapter().listCategories()),
        viaAdapter(() => getContentAdapter().listTags())
      ]);
      store.set(prev => ({
        ...prev,
        categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
        tags: tags.sort((a, b) => b.count - a.count),
        status: 'ready',
        error: undefined
      }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
  },

  async createCategory(input: Omit<Category, 'id' | 'questionsCount'>): Promise<Category> {
    const trimmed = input.name.trim();
    if (!trimmed) throw new ServiceError('category/invalid', 'Category name is required.');
    if (store.get().categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new ServiceError('category/duplicate', 'That category already exists.');
    }

    const created = await viaAdapter(() =>
      getContentAdapter().createCategory({
        ...input,
        name: trimmed,
        id: `cat-${Date.now()}`,
        questionsCount: 0
      })
    );
    store.set(prev => ({ ...prev, categories: [...prev.categories, created] }));
    return created;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await viaAdapter(() => getContentAdapter().deleteCategory(categoryId));
    store.set(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== categoryId)
    }));
  },

  /**
   * Keeps `questionsCount` in sync when doubts are created/removed.
   * Optimistic locally, then persisted — the rules cap the change at ±1 per
   * write so a client can never rebase the whole counter in one call.
   */
  async adjustQuestionCount(categoryName: string, delta: number): Promise<void> {
    if (!categoryName || delta === 0) return;
    const previous = store.get().categories;
    const target = previous.find(c => c.name === categoryName);
    if (!target) return;

    const nextValue = Math.max(0, target.questionsCount + delta);
    store.set(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.id === target.id ? { ...c, questionsCount: nextValue } : c
      )
    }));

    try {
      await viaAdapter(() => getContentAdapter().adjustQuestionCount(categoryName, delta));
    } catch (error) {
      store.set(prev => ({ ...prev, categories: previous }));
      throw error;
    }
  },

  /** Subscribes (or unsubscribes) the signed-in member to a topic tag. */
  async toggleFollowTag(actorId: string, tagId: string): Promise<{ following: boolean; tag: Tag | undefined }> {
    const previous = store.get().tags;
    const target = previous.find(t => t.id === tagId);
    if (!target) return { following: false, tag: undefined };
    const willFollow = !target.isFollowing;

    store.set(prev => ({
      ...prev,
      tags: prev.tags.map(t =>
        t.id === tagId
          ? {
              ...t,
              isFollowing: willFollow,
              followersCount: Math.max(0, t.followersCount + (willFollow ? 1 : -1))
            }
          : t
      )
    }));

    try {
      await viaAdapter(() => getContentAdapter().setTagFollowing(actorId, tagId, willFollow));
      return { following: willFollow, tag: store.get().tags.find(t => t.id === tagId) };
    } catch (error) {
      store.set(prev => ({ ...prev, tags: previous }));
      throw error;
    }
  },

  async createTag(input: Omit<Tag, 'id' | 'count' | 'followersCount'>): Promise<Tag> {
    const trimmed = input.name.trim().replace(/^#/, '').trim();
    if (!trimmed) throw new ServiceError('tag/invalid', 'Tag name is required.');
    const created = await viaAdapter(() =>
      getContentAdapter().createTag({
        ...input,
        name: trimmed,
        id: `tag-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        count: 0,
        followersCount: 0
      })
    );
    store.set(prev => ({ ...prev, tags: [...prev.tags, created] }));
    return created;
  }
};

export function useCatalogStore(): CatalogState {
  return useStore(store);
}

/** Test seam: empties the catalogue without touching the adapter. */
export function resetCatalogStoreForTests(): void {
  store.set({ categories: [], tags: [], status: 'loading', error: undefined });
}
