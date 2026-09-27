import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setServiceActor } from './actor';
import { setContentAdapter } from './contentAdapter';
import { doubtService, filterVisibleDoubts, nextVoteState, resetDoubtStoreForTests } from './doubtService';
import type { CreateDoubtInput } from './doubtService';
import { createFakeContentAdapter } from './testing/fakeContentAdapter';
import type { FakeContentAdapter } from './testing/fakeContentAdapter';
import { makeAnswer, makeDoubt, makeUser } from './testing/contentFixtures';

/**
 * M4: the doubt feed runs entirely against the adapter seam, so these suites
 * exercise the real service policy — creation invariants, deny-by-default
 * privacy, counter coupling and write rollback — without a Firebase project,
 * network access or `.env.local`.
 */
const author = makeUser({ id: 'uid_author', role: 'student', status: 'approved' });
const stranger = makeUser({ id: 'uid_stranger', role: 'student', status: 'approved' });
const mentor = makeUser({ id: 'uid_mentor', role: 'mentor', status: 'approved' });
const admin = makeUser({ id: 'uid_admin', role: 'admin', status: 'approved' });

const PERMISSION_COPY = 'You do not have permission to do that. Contact your department administrator.';

let fake: FakeContentAdapter;

function sampleInput(overrides: Partial<CreateDoubtInput> = {}): CreateDoubtInput {
  return {
    title: 'Why does my merge sort blow the stack?',
    description: 'Recursive merge sort overflows on 10k elements and I cannot see why.',
    category: 'Data Structures & Algorithms',
    subject: 'DSA',
    tags: ['DSA'],
    visibility: 'public',
    ...overrides
  };
}

beforeEach(() => {
  fake = createFakeContentAdapter();
  setContentAdapter(fake);
  resetDoubtStoreForTests();
  setServiceActor(author.id);
});

afterEach(() => {
  setContentAdapter(null);
  setServiceActor(null);
  resetDoubtStoreForTests();
});

describe('doubtService.create', () => {
  it('stores a public doubt with counters at zero and the adapter-assigned id', async () => {
    const created = await doubtService.create(author, sampleInput());

    expect(created.id).toMatch(/^doubt-/);
    expect(created.authorId).toBe(author.id);
    expect(created.authorSnapshot.id).toBe(author.id);
    expect(created.visibility).toBe('public');
    expect(created.upvotes).toBe(0);
    expect(created.downvotes).toBe(0);
    expect(created.views).toBe(0);
    expect(created.answersCount).toBe(0);
    expect(created.hasAcceptedAnswer).toBe(false);
    expect(created.lastAnswerId).toBeNull();
    expect(created.acceptedAnswerId).toBeNull();
    expect(doubtService.getAll()).toHaveLength(1);
    expect(doubtService.getById(created.id)?.title).toBe(created.title);
  });

  it('always keeps the author inside a private doubt allow-list', async () => {
    const created = await doubtService.create(
      author,
      sampleInput({ visibility: 'private', allowedUserIds: [mentor.id] })
    );

    expect(created.visibility).toBe('private');
    expect(created.allowedUserIds).toEqual([author.id, mentor.id]);
  });

  it('drops the allow-list entirely when the doubt is public', async () => {
    const created = await doubtService.create(author, sampleInput({ allowedUserIds: [mentor.id] }));

    expect(created.allowedUserIds).toEqual([]);
  });

  it('trims the title and the description once', async () => {
    const created = await doubtService.create(
      author,
      sampleInput({ title: '  Padded title  ', description: '  Padded body  ' })
    );

    expect(created.title).toBe('Padded title');
    expect(created.description).toBe('Padded body');
  });

  it('refuses a doubt without a title or a description before touching the backend', async () => {
    await expect(doubtService.create(author, sampleInput({ title: '   ' }))).rejects.toMatchObject({
      code: 'doubt/invalid',
      message: 'A doubt needs both a title and a description.'
    });
    await expect(doubtService.create(author, sampleInput({ description: '' }))).rejects.toMatchObject({
      code: 'doubt/invalid'
    });

    expect(fake.calls.createDoubt).toBe(0);
    expect(doubtService.getAll()).toEqual([]);
  });

  it('surfaces a refused write with the campus permission copy', async () => {
    fake.setDenied(true);

    await expect(doubtService.create(author, sampleInput())).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(doubtService.getAll()).toEqual([]);
  });
});

describe('doubtService.loadAll', () => {
  it('reads the feed, hydrates this member\'s votes and keeps pinned doubts on top', async () => {
    const pinned = await fake.createDoubt(makeDoubt(author, { title: 'Pinned question', isPinned: true }));
    const plain = await fake.createDoubt(makeDoubt(author, { title: 'Plain question' }));
    await fake.saveVote(author.id, {
      targetType: 'doubt',
      doubtId: plain.id,
      targetId: plain.id,
      value: -1,
      upvotes: 0,
      downvotes: 1
    });

    await doubtService.loadAll(author.id);

    const feed = doubtService.getAll();
    expect(doubtService.store.get().status).toBe('ready');
    expect(feed.map(d => d.id)).toEqual([pinned.id, plain.id]);
    expect(feed.find(d => d.id === plain.id)?.userVote).toBe('down');
    expect(feed.find(d => d.id === plain.id)?.downvotes).toBe(1);
    expect(doubtService.store.get().votes).toEqual({ [plain.id]: -1 });
  });

  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await doubtService.loadAll(author.id);

    expect(doubtService.store.get()).toMatchObject({
      status: 'error',
      error: PERMISSION_COPY,
      doubts: []
    });
  });

  it('refuses to read on behalf of nobody', async () => {
    setServiceActor(null);

    await expect(doubtService.loadAll()).rejects.toMatchObject({
      code: 'auth/required',
      message: 'You must be signed in to do that.'
    });
    expect(fake.calls.listDoubts).toBe(0);
  });

  it('still strips a private doubt from what an unrelated member renders', async () => {
    const secret = await fake.createDoubt(
      makeDoubt(author, { visibility: 'private', allowedUserIds: [author.id, mentor.id] })
    );
    const open = await fake.createDoubt(makeDoubt(author, { title: 'Public question' }));

    await doubtService.loadAll(stranger.id);
    const rendered = filterVisibleDoubts(doubtService.getAll(), stranger);

    expect(rendered.map(d => d.id)).toEqual([open.id]);
    expect(rendered.some(d => d.id === secret.id)).toBe(false);
  });
});

describe('doubtService.vote', () => {
  let doubtId: string;

  beforeEach(async () => {
    doubtId = (await doubtService.create(author, sampleInput())).id;
  });

  it('adds one upvote, records the member\'s own vote and persists the counters', async () => {
    await doubtService.vote(doubtId, 'up');

    const doubt = doubtService.getById(doubtId);
    expect(doubt?.upvotes).toBe(1);
    expect(doubt?.userVote).toBe('up');
    expect(doubtService.store.get().votes[doubtId]).toBe(1);
    expect((await fake.getDoubt(doubtId))?.upvotes).toBe(1);
  });

  it('removes the vote when the very same button is pressed again', async () => {
    await doubtService.vote(doubtId, 'up');
    await doubtService.vote(doubtId, 'up');

    const doubt = doubtService.getById(doubtId);
    expect(doubt?.upvotes).toBe(0);
    expect(doubt?.userVote).toBeNull();
    expect(doubtService.store.get().votes[doubtId]).toBeUndefined();
    expect((await fake.getDoubt(doubtId))?.upvotes).toBe(0);
  });

  it('moves an upvote to a downvote in one step without double counting', async () => {
    await doubtService.vote(doubtId, 'up');
    await doubtService.vote(doubtId, 'down');

    const doubt = doubtService.getById(doubtId);
    expect(doubt?.upvotes).toBe(0);
    expect(doubt?.downvotes).toBe(1);
    expect(doubt?.userVote).toBe('down');

    const persisted = await fake.getDoubt(doubtId);
    expect(persisted?.upvotes).toBe(0);
    expect(persisted?.downvotes).toBe(1);
  });

  it('rolls the optimistic counters back when the backend refuses the write', async () => {
    const before = doubtService.getById(doubtId);
    fake.setDenied(true);

    await expect(doubtService.vote(doubtId, 'up')).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });

    expect(doubtService.getById(doubtId)).toEqual(before);
    expect(doubtService.store.get().votes).toEqual({});
  });

  it('rejects a vote on a doubt that no longer exists', async () => {
    await expect(doubtService.vote('doubt-missing', 'up')).rejects.toMatchObject({
      code: 'doubt/not-found'
    });
  });

  it('requires a signed-in member', async () => {
    setServiceActor(null);

    await expect(doubtService.vote(doubtId, 'up')).rejects.toMatchObject({ code: 'auth/required' });
  });
});

describe('doubtService.incrementViews', () => {
  it('records the visit locally and persists it once', async () => {
    const created = await doubtService.create(author, sampleInput());

    await doubtService.incrementViews(created.id);

    expect(doubtService.getById(created.id)?.views).toBe(1);
    expect((await fake.getDoubt(created.id))?.views).toBe(1);
    expect(fake.calls.setDoubtState).toBe(1);
  });

  it('keeps the detail page alive when the counter write is refused', async () => {
    const created = await doubtService.create(author, sampleInput());
    fake.setDenied(true);

    await expect(doubtService.incrementViews(created.id)).resolves.toBeUndefined();

    expect(doubtService.getById(created.id)?.views).toBe(0);
    expect(fake.calls.setDoubtState).toBe(1);
  });

  it('ignores a doubt that is not in the feed', async () => {
    await expect(doubtService.incrementViews('doubt-missing')).resolves.toBeUndefined();
    expect(fake.calls.setDoubtState).toBe(0);
  });
});

describe('doubtService.update', () => {
  it('lets the author retitle the doubt and persists the patch', async () => {
    const created = await doubtService.create(author, sampleInput());

    const updated = await doubtService.update(created.id, author, { title: 'Retitled question' });

    expect(updated.title).toBe('Retitled question');
    expect((await fake.getDoubt(created.id))?.title).toBe('Retitled question');
    expect(doubtService.getById(created.id)?.title).toBe('Retitled question');
  });

  it('refuses an edit from anyone who is not the author', async () => {
    const created = await doubtService.create(author, sampleInput());

    await expect(doubtService.update(created.id, stranger, { title: 'Hijacked' })).rejects.toMatchObject({
      code: 'doubt/forbidden',
      message: 'Only the author or an admin can edit this doubt.'
    });
    expect((await fake.getDoubt(created.id))?.title).not.toBe('Hijacked');
  });

  it('lets an administrator moderate the doubt', async () => {
    const created = await doubtService.create(author, sampleInput());

    const updated = await doubtService.update(created.id, admin, { title: 'Moderated' });

    expect(updated.title).toBe('Moderated');
  });

  it('moves the author into the allow-list when the doubt turns private', async () => {
    const created = await doubtService.create(author, sampleInput());

    const updated = await doubtService.update(created.id, author, {
      visibility: 'private',
      allowedUserIds: [mentor.id]
    });

    expect(updated.visibility).toBe('private');
    expect(updated.allowedUserIds).toEqual([author.id, mentor.id]);
    expect(doubtService.getById(created.id)?.allowedUserIds).toEqual([author.id, mentor.id]);
    expect((await fake.getDoubt(created.id))?.allowedUserIds).toEqual([author.id, mentor.id]);
  });

  it('clears the allow-list when the doubt is published again', async () => {
    const created = await doubtService.create(author, sampleInput({ visibility: 'private' }));
    await doubtService.update(created.id, author, { visibility: 'private', allowedUserIds: [mentor.id] });

    const published = await doubtService.update(created.id, author, { visibility: 'public' });

    expect(published.visibility).toBe('public');
    expect(published.allowedUserIds).toEqual([]);
  });

  it('fails on a doubt that is not in the feed', async () => {
    await expect(doubtService.update('doubt-missing', author, { title: 'Ghost' })).rejects.toMatchObject({
      code: 'doubt/not-found'
    });
  });
});

describe('doubtService.remove', () => {
  it('drops the doubt from the feed and takes its answers with it', async () => {
    const created = await doubtService.create(author, sampleInput());
    await fake.createAnswer(makeAnswer(created.id, stranger));

    await doubtService.remove(created.id);

    expect(doubtService.getAll()).toEqual([]);
    expect(await fake.getDoubt(created.id)).toBeNull();
    expect(fake.answers(created.id)).toEqual([]);
  });

  it('maps a refused delete to the campus permission copy and keeps the feed intact', async () => {
    const created = await doubtService.create(author, sampleInput());
    fake.setDenied(true);

    await expect(doubtService.remove(created.id)).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(doubtService.getById(created.id)).toBeDefined();
  });
});

describe('nextVoteState (pure vote transition)', () => {
  it('counts a vote that was not there before', () => {
    expect(nextVoteState(null, 'up')).toEqual({ vote: 'up', upDelta: 1, downDelta: 0 });
    expect(nextVoteState(undefined, 'down')).toEqual({ vote: 'down', upDelta: 0, downDelta: 1 });
  });

  it('clears a repeated vote', () => {
    expect(nextVoteState('up', 'up')).toEqual({ vote: null, upDelta: -1, downDelta: 0 });
    expect(nextVoteState('down', 'down')).toEqual({ vote: null, upDelta: 0, downDelta: -1 });
  });

  it('moves between the two poles in a single step', () => {
    expect(nextVoteState('up', 'down')).toEqual({ vote: 'down', upDelta: -1, downDelta: 1 });
    expect(nextVoteState('down', 'up')).toEqual({ vote: 'up', upDelta: 1, downDelta: -1 });
  });
});
