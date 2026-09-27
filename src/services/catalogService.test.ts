import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setContentAdapter } from './contentAdapter';
import { catalogService, resetCatalogStoreForTests } from './catalogService';
import { createFakeContentAdapter } from './testing/fakeContentAdapter';
import type { FakeContentAdapter } from './testing/fakeContentAdapter';
import { makeCategory, makeUser } from './testing/contentFixtures';

/**
 * M4: the catalogue is reference data, not content — an empty read means the
 * `categories` / `tags` collections have not been populated yet. Nothing is
 * ever seeded from a mock array, and no demo categories appear behind an
 * empty Firestore.
 */
const admin = makeUser({ id: 'uid_admin', role: 'admin', status: 'approved' });

const PERMISSION_COPY = 'You do not have permission to do that. Contact your department administrator.';

let fake: FakeContentAdapter;

const operatingSystems = {
  name: 'Operating Systems',
  slug: 'operating-systems',
  description: 'Kernels, schedulers and memory management.',
  icon: 'Cpu',
  domain: 'Programming' as const,
  status: 'active' as const
};

beforeEach(() => {
  fake = createFakeContentAdapter();
  setContentAdapter(fake);
  resetCatalogStoreForTests();
});

afterEach(() => {
  setContentAdapter(null);
  resetCatalogStoreForTests();
});

describe('catalogService.loadAll', () => {
  it('starts from an empty catalogue instead of falling back to mock data', async () => {
    await catalogService.loadAll();

    expect(catalogService.store.get().status).toBe('ready');
    expect(catalogService.store.get().categories).toEqual([]);
    expect(catalogService.store.get().tags).toEqual([]);
  });

  it('sorts categories by name and tags by popularity', async () => {
    await fake.createCategory(makeCategory({ id: 'cat-z', name: 'Zoology' }));
    await fake.createCategory(makeCategory({ id: 'cat-a', name: 'Algorithms' }));
    await fake.createTag({ id: 'tag-rare', name: 'rare', description: '', count: 2, followersCount: 0 });
    await fake.createTag({ id: 'tag-hot', name: 'hot', description: '', count: 40, followersCount: 0 });

    await catalogService.loadAll();

    expect(catalogService.store.get().categories.map(c => c.name)).toEqual(['Algorithms', 'Zoology']);
    expect(catalogService.store.get().tags.map(t => t.name)).toEqual(['hot', 'rare']);
  });

  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await catalogService.loadAll();

    expect(catalogService.store.get()).toMatchObject({
      status: 'error',
      error: PERMISSION_COPY,
      categories: [],
      tags: []
    });
  });
});

describe('catalogService.createCategory', () => {
  it('creates an empty category that administrators can populate later', async () => {
    const created = await catalogService.createCategory(operatingSystems);

    expect(created.questionsCount).toBe(0);
    expect(created.name).toBe('Operating Systems');
    expect(fake.categories().map(c => c.name)).toEqual(['Operating Systems']);
    expect(catalogService.store.get().categories).toHaveLength(1);
  });

  it('refuses an empty name before touching the backend', async () => {
    await expect(
      catalogService.createCategory({ ...operatingSystems, name: '   ' })
    ).rejects.toMatchObject({ code: 'category/invalid', message: 'Category name is required.' });
    expect(fake.calls.createCategory).toBe(0);
  });

  it('refuses a category the catalogue already owns, whatever the casing', async () => {
    await catalogService.createCategory(operatingSystems);

    await expect(
      catalogService.createCategory({ ...operatingSystems, name: 'OPERATING systems' })
    ).rejects.toMatchObject({ code: 'category/duplicate', message: 'That category already exists.' });
    expect(fake.calls.createCategory).toBe(1);
  });

  it('surfaces a refused write with the campus permission copy', async () => {
    fake.setDenied(true);

    await expect(catalogService.createCategory(operatingSystems)).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(catalogService.store.get().categories).toEqual([]);
  });
});

describe('catalogService.deleteCategory', () => {
  it('removes it from the backend and from the store', async () => {
    const created = await catalogService.createCategory(operatingSystems);

    await catalogService.deleteCategory(created.id);

    expect(fake.categories()).toEqual([]);
    expect(catalogService.store.get().categories).toEqual([]);
  });
});

describe('catalogService.adjustQuestionCount', () => {
  beforeEach(async () => {
    await catalogService.createCategory(operatingSystems);
  });

  it('bumps the counter optimistically and persists the delta', async () => {
    await catalogService.adjustQuestionCount('Operating Systems', 1);
    await catalogService.adjustQuestionCount('Operating Systems', 1);

    expect(catalogService.store.get().categories[0].questionsCount).toBe(2);
    expect(fake.categories()[0].questionsCount).toBe(2);
  });

  it('rolls the counter back when the write is refused', async () => {
    fake.setDenied(true);

    await expect(catalogService.adjustQuestionCount('Operating Systems', 1)).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(catalogService.store.get().categories[0].questionsCount).toBe(0);
  });

  it('never issues a write for an unknown category, an empty name or a zero delta', async () => {
    expect(await catalogService.adjustQuestionCount('Nothing Here', 1)).toBeUndefined();
    expect(await catalogService.adjustQuestionCount('', 1)).toBeUndefined();
    expect(await catalogService.adjustQuestionCount('Operating Systems', 0)).toBeUndefined();

    expect(fake.calls.adjustQuestionCount).toBe(0);
    expect(fake.categories()[0].questionsCount).toBe(0);
  });
});

describe('catalogService.createTag', () => {
  it('normalises the tag name and starts both counters at zero', async () => {
    const created = await catalogService.createTag({
      name: '#React',
      description: 'Frontend library',
      isTrending: true
    });

    expect(created.id).toBe('tag-react');
    expect(created.name).toBe('React');
    expect(created.count).toBe(0);
    expect(created.followersCount).toBe(0);
    expect(fake.tags()).toHaveLength(1);
  });

  it('refuses an empty tag name', async () => {
    await expect(catalogService.createTag({ name: '  ', description: '' })).rejects.toMatchObject({
      code: 'tag/invalid',
      message: 'Tag name is required.'
    });
    expect(fake.calls.createTag).toBe(0);
  });
});

describe('catalogService.toggleFollowTag', () => {
  let tagId: string;

  beforeEach(async () => {
    tagId = (await catalogService.createTag({ name: 'React', description: 'Frontend library' })).id;
  });

  it('follows and unfollows while keeping followersCount in step on both sides', async () => {
    const followed = await catalogService.toggleFollowTag(admin.id, tagId);

    expect(followed.following).toBe(true);
    expect(followed.tag?.followersCount).toBe(1);
    expect(fake.tagFollowIds(admin.id)).toEqual([tagId]);
    expect(fake.tags()[0].followersCount).toBe(1);

    const unfollowed = await catalogService.toggleFollowTag(admin.id, tagId);

    expect(unfollowed.following).toBe(false);
    expect(unfollowed.tag?.followersCount).toBe(0);
    expect(fake.tagFollowIds(admin.id)).toEqual([]);
    expect(fake.tags()[0].followersCount).toBe(0);
  });

  it('keeps the local count intact when the write is refused', async () => {
    fake.setDenied(true);

    await expect(catalogService.toggleFollowTag(admin.id, tagId)).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });

    const tag = catalogService.store.get().tags.find(t => t.id === tagId);
    expect(tag?.isFollowing).toBeUndefined();
    expect(tag?.followersCount).toBe(0);
  });

  it('returns nothing for a tag that is not in the catalogue', async () => {
    await expect(catalogService.toggleFollowTag(admin.id, 'tag-missing')).resolves.toEqual({
      following: false,
      tag: undefined
    });
    expect(fake.calls.setTagFollowing).toBe(0);
  });
});
