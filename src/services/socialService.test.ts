import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setServiceActor } from './actor';
import { setContentAdapter } from './contentAdapter';
import { resetSocialStoreForTests, socialService } from './socialService';
import { createFakeContentAdapter } from './testing/fakeContentAdapter';
import type { FakeContentAdapter } from './testing/fakeContentAdapter';
import { makeUser } from './testing/contentFixtures';

/**
 * M4: bookmarks and follows are per-member documents
 * (`bookmarks/{doubtId}_{uid}`, `follows/{userId}_{uid}`), so a failure to
 * persist must never leave the UI believing a bookmark exists.
 */
const member = makeUser({ id: 'uid_member', role: 'student', status: 'approved' });

const PERMISSION_COPY = 'You do not have permission to do that. Contact your department administrator.';

let fake: FakeContentAdapter;

beforeEach(() => {
  fake = createFakeContentAdapter();
  setContentAdapter(fake);
  resetSocialStoreForTests();
  setServiceActor(member.id);
});

afterEach(() => {
  setContentAdapter(null);
  setServiceActor(null);
  resetSocialStoreForTests();
});

describe('socialService.loadAll', () => {
  it('reads this member\'s bookmarks and follows from the backend', async () => {
    await fake.setBookmark(member.id, 'doubt-1', true);
    await fake.setBookmark(member.id, 'doubt-2', true);
    await fake.setFollowing(member.id, 'uid_mentor', true);

    await socialService.loadAll(member.id);

    expect(socialService.store.get().status).toBe('ready');
    expect(socialService.store.get().bookmarkedDoubtIds.sort()).toEqual(['doubt-1', 'doubt-2']);
    expect(socialService.store.get().followingUserIds).toEqual(['uid_mentor']);
    expect(socialService.isBookmarked('doubt-1')).toBe(true);
    expect(socialService.isFollowing('uid_mentor')).toBe(true);
    expect(socialService.isFollowing('uid_stranger')).toBe(false);
  });

  it('never mixes one member\'s bookmarks with another\'s', async () => {
    await fake.setBookmark('uid_other', 'doubt-foreign', true);

    await socialService.loadAll(member.id);

    expect(socialService.store.get().bookmarkedDoubtIds).toEqual([]);
  });

  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await socialService.loadAll(member.id);

    expect(socialService.store.get()).toMatchObject({
      status: 'error',
      error: PERMISSION_COPY,
      bookmarkedDoubtIds: [],
      followingUserIds: []
    });
  });

  it('refuses to read on behalf of nobody', async () => {
    setServiceActor(null);

    await expect(socialService.loadAll()).rejects.toMatchObject({ code: 'auth/required' });
    expect(fake.calls.listBookmarkIds).toBe(0);
  });
});

describe('socialService.toggleBookmark', () => {
  it('persists the bookmark and reports the new state', async () => {
    expect(await socialService.toggleBookmark('doubt-1')).toBe(true);
    expect(socialService.isBookmarked('doubt-1')).toBe(true);
    expect(fake.bookmarkIds(member.id)).toEqual(['doubt-1']);

    expect(await socialService.toggleBookmark('doubt-1')).toBe(false);
    expect(socialService.isBookmarked('doubt-1')).toBe(false);
    expect(fake.bookmarkIds(member.id)).toEqual([]);
  });

  it('rolls the optimistic state back when the write is refused', async () => {
    fake.setDenied(true);

    await expect(socialService.toggleBookmark('doubt-1')).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(socialService.isBookmarked('doubt-1')).toBe(false);
    expect(socialService.store.get().bookmarkedDoubtIds).toEqual([]);
  });

  it('requires a signed-in member', async () => {
    setServiceActor(null);

    await expect(socialService.toggleBookmark('doubt-1')).rejects.toMatchObject({
      code: 'auth/required'
    });
    expect(fake.calls.setBookmark).toBe(0);
  });
});

describe('socialService.toggleFollow', () => {
  it('persists the follow and reports the new state', async () => {
    expect(await socialService.toggleFollow('uid_mentor')).toBe(true);
    expect(socialService.isFollowing('uid_mentor')).toBe(true);
    expect(fake.followIds(member.id)).toEqual(['uid_mentor']);

    expect(await socialService.toggleFollow('uid_mentor')).toBe(false);
    expect(socialService.isFollowing('uid_mentor')).toBe(false);
    expect(fake.followIds(member.id)).toEqual([]);
  });

  it('rolls the optimistic state back when the write is refused', async () => {
    fake.setDenied(true);

    await expect(socialService.toggleFollow('uid_mentor')).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(socialService.isFollowing('uid_mentor')).toBe(false);
  });

  it('keeps a follow that already existed in the backend untouched on failure', async () => {
    await fake.setFollowing(member.id, 'uid_mentor', true);
    await socialService.loadAll(member.id);
    fake.setDenied(true);

    await expect(socialService.toggleFollow('uid_mentor')).rejects.toMatchObject({
      code: 'firestore/permission-denied'
    });
    expect(socialService.isFollowing('uid_mentor')).toBe(true);
    expect(fake.followIds(member.id)).toEqual(['uid_mentor']);
  });
});
