import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setServiceActor } from './actor';
import { setContentAdapter } from './contentAdapter';
import { setUserAdapter } from './userAdapter';
import { resetUserDirectoryForTests, userService } from './userService';
import { createFakeContentAdapter } from './testing/fakeContentAdapter';
import type { FakeContentAdapter } from './testing/fakeContentAdapter';
import { createFakeUserAdapter } from './testing/fakeUserAdapter';
import type { FakeUserAdapter } from './testing/fakeUserAdapter';
import { makeDoubt, makeUser } from './testing/contentFixtures';
import {
  getProfileActivity,
  getProfileStats,
  invalidateProfile,
  listFollowers,
  listFollowing
} from './profileService';
import { history, record } from './reputationService';
import {
  DEFAULT_BADGES,
  claimEarnedThresholds,
  claimFirstDoubt,
  claimThresholdBadge,
  listBadgeDefinitions
} from './badgeService';

/**
 * Phase 6: follows, profiles, reputation and badges.
 *
 * The suites pin the property the whole feature exists for - every number a
 * profile shows is *derived* from `reputationEvents`, `follows` and
 * `userBadges`, never read back from a field a client could have written.
 * They also pin the two "claimed once" invariants: a milestone is booked a
 * single time, and a badge row can only be held once.
 */
const member = makeUser({
  id: 'uid_member',
  role: 'student',
  status: 'approved',
  reputation: 0,
  // Deliberately wrong declared values: nothing here may reach the profile.
  questionsCount: 99,
  answersCount: 99,
  acceptedCount: 99,
  followersCount: 99
});
const peer = makeUser({ id: 'uid_peer', role: 'student', status: 'approved', reputation: 0 });
const moderator = makeUser({ id: 'uid_mod', role: 'admin', status: 'approved', reputation: 0 });

let fake: FakeContentAdapter;
let fakeUsers: FakeUserAdapter;

beforeEach(async () => {
  fake = createFakeContentAdapter();
  setContentAdapter(fake);
  fakeUsers = createFakeUserAdapter();
  setUserAdapter(fakeUsers);
  resetUserDirectoryForTests();
  fakeUsers.seed([member, peer, moderator]);
  await userService.loadDirectory();
  invalidateProfile();
  setServiceActor(member.id);
});

afterEach(() => {
  setContentAdapter(null);
  setUserAdapter(null);
  setServiceActor(null);
  resetUserDirectoryForTests();
  invalidateProfile();
});

describe('profileService.getProfileStats', () => {
  it('derives every number from the ledger, not from declared fields', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    await record({ type: 'question', doubtId: doubt.id, userId: member.id });
    await fake.setFollowing(peer.id, member.id, true);
    await fake.createUserBadge({ badgeId: 'first_doubt', uid: member.id, sourceId: doubt.id });

    invalidateProfile(member.id);
    const stats = await getProfileStats(member.id);

    expect(stats.userId).toBe(member.id);
    expect(stats.questionsCount).toBe(1);
    expect(stats.answersCount).toBe(0);
    expect(stats.acceptedCount).toBe(0);
    expect(stats.followersCount).toBe(1);
    expect(stats.reputation).toBe(5);
    expect(stats.badges.map(badge => badge.id)).toEqual(['first_doubt']);
    expect(stats.badges[0].name).toBe(DEFAULT_BADGES[0].name);
  });

  it('never shows a member\'s own placeholder counts as proof', async () => {
    const stats = await getProfileStats(member.id);

    expect(stats.questionsCount).toBe(0);
    expect(stats.answersCount).toBe(0);
    expect(stats.followersCount).toBe(0);
    expect(stats.reputation).toBe(0);
  });

  it('memoises a profile and re-reads it once invalidated', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    await record({ type: 'question', doubtId: doubt.id, userId: member.id });
    invalidateProfile(member.id);

    await getProfileStats(member.id);
    await getProfileStats(member.id);
    expect(fake.calls.countDoubtsBy).toBe(1);

    invalidateProfile(member.id);
    await getProfileStats(member.id);
    expect(fake.calls.countDoubtsBy).toBe(2);
  });

  it('reports a failure as a typed campus-friendly error', async () => {
    fake.setDenied(true);

    await expect(getProfileStats(member.id)).rejects.toMatchObject({
      code: 'firestore/permission-denied'
    });
  });
});

describe('profileService follower lists', () => {
  it('reads the follow edges in both directions', async () => {
    await fake.setFollowing(peer.id, member.id, true);

    const followers = await listFollowers(member.id);
    const following = await listFollowing(peer.id);

    expect(followers.map(edge => edge.userId)).toEqual([peer.id]);
    expect(following.map(edge => edge.targetUserId)).toEqual([member.id]);
  });

  it('returns an empty list rather than throwing when nobody follows', async () => {
    await expect(listFollowers(member.id)).resolves.toEqual([]);
    await expect(listFollowing(member.id)).resolves.toEqual([]);
  });
});

describe('profileService.getProfileActivity', () => {
  it('mixes ledger rows, follow edges and badges into one timeline', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    await record({ type: 'question', doubtId: doubt.id, userId: member.id });
    await fake.setFollowing(peer.id, member.id, true);
    await fake.createUserBadge({ badgeId: 'first_doubt', uid: member.id, sourceId: doubt.id });

    const activity = await getProfileActivity(member.id, 30);
    const kinds = new Set(activity.map(item => item.kind));

    expect(kinds).toContain('question');
    expect(kinds).toContain('follow');
    expect(kinds).toContain('badge');
    for (let index = 1; index < activity.length; index += 1) {
      expect(activity[index - 1].createdAtMs).toBeGreaterThanOrEqual(activity[index].createdAtMs);
    }
  });

  it('only asks for vote rows on the member\'s own profile', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    await record({ type: 'question', doubtId: doubt.id, userId: member.id });
    await fake.saveVote(peer.id, {
      targetType: 'doubt',
      doubtId: doubt.id,
      targetId: doubt.id,
      value: 1,
      upvotes: 1,
      downvotes: 0
    });

    setServiceActor(member.id);
    const own = await getProfileActivity(member.id, 30);

    setServiceActor(peer.id);
    const others = await getProfileActivity(member.id, 30);

    expect(own.some(item => item.title.includes('upvote'))).toBe(true);
    expect(others.some(item => item.title.includes('upvote'))).toBe(false);
    expect(others.some(item => item.kind === 'question')).toBe(true);
  });
});

describe('reputationService.record', () => {
  it('books a milestone once and mirrors the score onto the directory copy', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));

    const event = await record({ type: 'question', doubtId: doubt.id, userId: member.id });

    expect(event).toMatchObject({
      id: `question_${doubt.id}_${member.id}`,
      type: 'question',
      delta: 5
    });
    expect(userService.getById(member.id)?.reputation).toBe(5);
    expect(fake.reputationEvents(member.id)).toHaveLength(1);
  });

  it('treats a second identical claim as a quiet no-op, not an error', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    await record({ type: 'question', doubtId: doubt.id, userId: member.id });

    await expect(
      record({ type: 'question', doubtId: doubt.id, userId: member.id })
    ).resolves.toBeNull();

    expect(userService.getById(member.id)?.reputation).toBe(5);
    expect(fake.reputationEvents(member.id)).toHaveLength(1);
  });

  it('credits the answer author when a mentor accepts, and books it once', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    const draft = {
      type: 'accepted' as const,
      doubtId: doubt.id,
      answerId: 'ans-1',
      userId: member.id,
      actorId: moderator.id
    };

    expect(await record(draft)).toMatchObject({ delta: 15, userId: member.id });
    expect(await record(draft)).toBeNull();
    expect(userService.getById(member.id)?.reputation).toBe(15);
  });

  it('surfaces a refused write instead of pretending the credit happened', async () => {
    fake.setDenied(true);

    await expect(
      record({ type: 'question', doubtId: 'doubt-x', userId: member.id })
    ).rejects.toMatchObject({ code: 'firestore/permission-denied' });
    expect(userService.getById(member.id)?.reputation).toBe(0);
  });
});

describe('reputationService.history', () => {
  it('drops vote rows unless the caller explicitly asks for their own', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));
    await record({ type: 'question', doubtId: doubt.id, userId: member.id });
    await fake.saveVote(peer.id, {
      targetType: 'doubt',
      doubtId: doubt.id,
      targetId: doubt.id,
      value: 1,
      upvotes: 1,
      downvotes: 0
    });

    const publicRows = await history(member.id, { limit: 50 });
    const ownRows = await history(member.id, { limit: 50, includeVotes: true });

    expect(publicRows.map(row => row.type)).toEqual(['question']);
    expect(ownRows.map(row => row.type).sort()).toEqual(['question', 'vote']);
  });
});

describe('badgeService', () => {
  it('falls back to the source catalogue when none has been seeded', async () => {
    const definitions = await listBadgeDefinitions();

    expect(definitions.map(badge => badge.id).sort()).toEqual(
      DEFAULT_BADGES.map(badge => badge.id).sort()
    );
    expect(definitions.every(badge => badge.kind === 'self' || badge.kind === 'threshold')).toBe(
      true
    );
  });

  it('awards a self badge exactly once', async () => {
    const doubt = await fake.createDoubt(makeDoubt(member));

    const first = await claimFirstDoubt(doubt.id, member.id);
    const second = await claimFirstDoubt(doubt.id, member.id);

    expect(first).toMatchObject({ badgeId: 'first_doubt', uid: member.id, sourceId: doubt.id });
    expect(second).toBeNull();
    expect(fake.userBadges(member.id)).toHaveLength(1);
  });

  it('refuses a threshold badge to anyone who is not a moderator', async () => {
    await expect(claimThresholdBadge('helpful_contributor')).rejects.toMatchObject({
      code: 'badge/forbidden'
    });
    expect(fake.userBadges(member.id)).toHaveLength(0);
  });

  it('refuses an id the catalogue does not know', async () => {
    setServiceActor(moderator.id);

    await expect(claimThresholdBadge('made_up_badge')).rejects.toMatchObject({
      code: 'badge/unknown'
    });
  });

  it('grants a moderator the threshold badges their own score crosses', async () => {
    setServiceActor(moderator.id);
    userService.adjustStats(moderator.id, { reputation: 300 });

    const earned = await claimEarnedThresholds();

    expect(earned.map(badge => badge.badgeId)).toEqual(['helpful_contributor']);
    expect(fake.userBadges(moderator.id).map(badge => badge.badgeId)).toEqual([
      'helpful_contributor'
    ]);
  });

  it('grants nothing to a student whose score crosses no threshold', async () => {
    userService.adjustStats(member.id, { reputation: 100 });

    await expect(claimEarnedThresholds()).resolves.toEqual([]);
    expect(fake.userBadges(member.id)).toHaveLength(0);
  });
});
