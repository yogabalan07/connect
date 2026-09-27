import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setServiceActor } from './actor';
import { setContentAdapter } from './contentAdapter';
import { answerService, canDeleteComment, canEditAnswer, canEditComment, resetAnswerStoreForTests } from './answerService';
import { createFakeContentAdapter } from './testing/fakeContentAdapter';
import type { FakeContentAdapter } from './testing/fakeContentAdapter';
import { makeAnswer, makeDoubt, makeUser } from './testing/contentFixtures';

/**
 * M4: answers, acceptance and answer votes, driven through the adapter seam.
 * The suites pin down the two cross-document invariants the rules enforce —
 * `answersCount` moves only with a real answer document, and a doubt never
 * carries more than one accepted answer.
 */
const author = makeUser({ id: 'uid_author', role: 'student', status: 'approved' });
const stranger = makeUser({ id: 'uid_stranger', role: 'student', status: 'approved' });
const mentor = makeUser({ id: 'uid_mentor', role: 'mentor', status: 'approved' });
const admin = makeUser({ id: 'uid_admin', role: 'admin', status: 'approved' });

const PERMISSION_COPY = 'You do not have permission to do that. Contact your department administrator.';

let fake: FakeContentAdapter;
let doubtId: string;

beforeEach(async () => {
  fake = createFakeContentAdapter();
  setContentAdapter(fake);
  resetAnswerStoreForTests();
  setServiceActor(author.id);
  doubtId = (await fake.createDoubt(makeDoubt(author))).id;
});

afterEach(() => {
  setContentAdapter(null);
  setServiceActor(null);
  resetAnswerStoreForTests();
});

describe('answerService.add', () => {
  it('creates the answer and moves the doubt counter in the same write', async () => {
    const answer = await answerService.add(doubtId, mentor, 'Use an iterative merge instead.');

    expect(answer.id).toMatch(/^ans-/);
    expect(answer.doubtId).toBe(doubtId);
    expect(answer.authorId).toBe(mentor.id);
    expect(answer.isAccepted).toBe(false);
    expect(answerService.getAll()[0].userVote).toBeNull();

    const doubt = await fake.getDoubt(doubtId);
    expect(doubt?.answersCount).toBe(1);
    expect(doubt?.lastAnswerId).toBe(answer.id);
    expect(answerService.getAll()).toHaveLength(1);
  });

  it('keeps counting every answer, not just the most recent one', async () => {
    await answerService.add(doubtId, mentor, 'First');
    const second = await answerService.add(doubtId, stranger, 'Second');

    const doubt = await fake.getDoubt(doubtId);
    expect(doubt?.answersCount).toBe(2);
    expect(doubt?.lastAnswerId).toBe(second.id);
    expect(answerService.getForDoubt(doubtId)).toHaveLength(2);
  });

  it('refuses an empty answer before touching the backend', async () => {
    await expect(answerService.add(doubtId, mentor, '   ')).rejects.toMatchObject({
      code: 'answer/invalid',
      message: 'An answer cannot be empty.'
    });
    expect(fake.calls.createAnswer).toBe(0);
    expect(answerService.getAll()).toEqual([]);
  });

  it('refuses to answer a doubt that no longer exists', async () => {
    await expect(answerService.add('doubt-missing', mentor, 'Anything')).rejects.toMatchObject({
      code: 'content/not-found'
    });
    expect(answerService.getAll()).toEqual([]);
  });

  it('surfaces a refused write with the campus permission copy', async () => {
    const before = await fake.getDoubt(doubtId);
    fake.setDenied(true);

    await expect(answerService.add(doubtId, mentor, 'Anything')).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });
    expect(before?.answersCount).toBe(0);
    expect(answerService.getAll()).toEqual([]);
  });
});

describe('answerService.loadForDoubt', () => {
  it('loads answers with their comments and this member\'s own votes', async () => {
    const first = await answerService.add(doubtId, mentor, 'First take');
    await answerService.add(doubtId, stranger, 'Second take');
    await answerService.addComment(first.id, author, 'That fixed it, thanks!');
    await fake.saveVote(author.id, {
      targetType: 'answer',
      doubtId,
      targetId: first.id,
      value: 1,
      upvotes: 1,
      downvotes: 0
    });

    answerService.removeForDoubt(doubtId);
    await answerService.loadForDoubt(doubtId);

    expect(answerService.store.get().status).toBe('ready');
    const answers = answerService.getForDoubt(doubtId);
    expect(answers).toHaveLength(2);
    expect(answers[0].id).toBe(first.id);
    expect(answers[0].userVote).toBe('up');
    expect(answers[0].comments).toHaveLength(1);
    expect(answers[0].comments[0]).toMatchObject({ content: 'That fixed it, thanks!', authorId: author.id });
    expect(answers[1].comments).toEqual([]);
    expect(answers[1].userVote).toBeNull();
  });

  it('orders the accepted answer first, then the highest voted', async () => {
    const accepted = await answerService.add(doubtId, mentor, 'Accepted');
    const popular = await answerService.add(doubtId, stranger, 'Popular');
    await answerService.add(doubtId, admin, 'Quiet');
    await answerService.setAccepted(doubtId, accepted.id);
    await fake.saveVote(author.id, {
      targetType: 'answer',
      doubtId,
      targetId: popular.id,
      value: 1,
      upvotes: 3,
      downvotes: 0
    });
    answerService.removeForDoubt(doubtId);
    await answerService.loadForDoubt(doubtId);

    expect(answerService.getForDoubt(doubtId).map(a => a.content)).toEqual([
      'Accepted',
      'Popular',
      'Quiet'
    ]);
  });

  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await answerService.loadForDoubt(doubtId);

    expect(answerService.store.get()).toMatchObject({
      status: 'error',
      error: PERMISSION_COPY,
      answers: []
    });
  });

  it('requires a signed-in member before touching the backend', async () => {
    setServiceActor(null);

    await expect(answerService.loadForDoubt(doubtId)).rejects.toMatchObject({ code: 'auth/required' });
    expect(fake.calls.listAnswers).toBe(0);
  });

  it('ignores an empty doubt id instead of issuing a read', async () => {
    await expect(answerService.loadForDoubt('')).resolves.toBeUndefined();
    expect(fake.calls.listAnswers).toBe(0);
  });
});

describe('answerService acceptance', () => {
  it('accepts exactly one answer per doubt and mirrors it on the doubt', async () => {
    const first = await answerService.add(doubtId, mentor, 'First take');
    const second = await answerService.add(doubtId, stranger, 'Second take');

    expect(await answerService.setAccepted(doubtId, first.id)).toBe(true);

    let doubt = await fake.getDoubt(doubtId);
    expect(doubt?.hasAcceptedAnswer).toBe(true);
    expect(doubt?.acceptedAnswerId).toBe(first.id);

    await answerService.setAccepted(doubtId, second.id);

    doubt = await fake.getDoubt(doubtId);
    expect(doubt?.hasAcceptedAnswer).toBe(true);
    expect(doubt?.acceptedAnswerId).toBe(second.id);
    expect(
      answerService
        .getForDoubt(doubtId)
        .filter(a => a.isAccepted)
        .map(a => a.id)
    ).toEqual([second.id]);
  });

  it('clears the accepted answer when the same answer is toggled off', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');
    await answerService.setAccepted(doubtId, answer.id);

    expect(await answerService.setAccepted(doubtId, answer.id)).toBe(false);

    const doubt = await fake.getDoubt(doubtId);
    expect(doubt?.hasAcceptedAnswer).toBe(false);
    expect(doubt?.acceptedAnswerId).toBeNull();
    expect(answerService.getForDoubt(doubtId)[0].isAccepted).toBe(false);
  });

  it('refuses to accept an answer that does not exist', async () => {
    await expect(answerService.setAccepted(doubtId, 'ans-missing')).rejects.toMatchObject({
      code: 'answer/not-found'
    });
  });
});

describe('answerService edit and delete policy', () => {
  it('lets the author and administrators edit, and nobody else', async () => {
    const answer = await answerService.add(doubtId, mentor, 'Original');

    await expect(
      answerService.update(answer.id, stranger, { content: 'Hijacked' })
    ).rejects.toMatchObject({ code: 'answer/forbidden' });

    const byAuthor = await answerService.update(answer.id, mentor, { content: 'Edited' });
    expect(byAuthor.content).toBe('Edited');

    const byAdmin = await answerService.update(answer.id, admin, { content: 'Moderated' });
    expect(byAdmin.content).toBe('Moderated');
    expect(fake.answers(doubtId)[0].content).toBe('Moderated');
  });

  it('refuses a blank edit', async () => {
    const answer = await answerService.add(doubtId, mentor, 'Original');

    await expect(answerService.update(answer.id, mentor, { content: '  ' })).rejects.toMatchObject({
      code: 'answer/invalid'
    });
    expect(fake.answers(doubtId)[0].content).toBe('Original');
  });

  it('removes the answer and pulls the doubt counter back down', async () => {
    const first = await answerService.add(doubtId, mentor, 'First take');
    await answerService.add(doubtId, stranger, 'Second take');

    const removed = await answerService.remove(first.id, mentor);

    expect(removed.id).toBe(first.id);
    expect(answerService.getAll()).toHaveLength(1);
    const doubt = await fake.getDoubt(doubtId);
    expect(doubt?.answersCount).toBe(1);
    expect(doubt?.lastAnswerId).toBe(first.id);
  });

  it('refuses a delete from someone who is not the author', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');

    await expect(answerService.remove(answer.id, stranger)).rejects.toMatchObject({
      code: 'answer/forbidden'
    });
    expect((await fake.getDoubt(doubtId))?.answersCount).toBe(1);
  });

  it('fails on an answer that was never loaded', async () => {
    await expect(answerService.update('ans-ghost', author, { content: 'Ghost' })).rejects.toMatchObject({
      code: 'answer/not-found'
    });
    await expect(answerService.remove('ans-ghost', author)).rejects.toMatchObject({
      code: 'answer/not-found'
    });
  });

  it('exposes the same author/admin rule as a pure decision', () => {
    const answer = makeAnswer(doubtId, mentor);

    expect(canEditAnswer(answer, mentor)).toBe(true);
    expect(canEditAnswer(answer, admin)).toBe(true);
    expect(canEditAnswer(answer, stranger)).toBe(false);
    expect(canEditAnswer(answer, null)).toBe(false);
  });
});

describe('answerService.vote', () => {
  let answerId: string;

  beforeEach(async () => {
    answerId = (await answerService.add(doubtId, mentor, 'First take')).id;
  });

  it('adds one upvote and persists the answer counters', async () => {
    await answerService.vote(answerId, 'up');

    const answer = answerService.getForDoubt(doubtId)[0];
    expect(answer.upvotes).toBe(1);
    expect(answer.userVote).toBe('up');
    expect(fake.answers(doubtId)[0].upvotes).toBe(1);
  });

  it('clears the vote when the same button is pressed again', async () => {
    await answerService.vote(answerId, 'up');
    await answerService.vote(answerId, 'up');

    const answer = answerService.getForDoubt(doubtId)[0];
    expect(answer.upvotes).toBe(0);
    expect(answer.userVote).toBeNull();
    expect(fake.answers(doubtId)[0].upvotes).toBe(0);
  });

  it('flips an upvote into a downvote in one step', async () => {
    await answerService.vote(answerId, 'up');
    await answerService.vote(answerId, 'down');

    const answer = answerService.getForDoubt(doubtId)[0];
    expect(answer.upvotes).toBe(0);
    expect(answer.downvotes).toBe(1);
    expect(answer.userVote).toBe('down');
  });

  it('rolls the optimistic counters back when the backend refuses the write', async () => {
    const before = answerService.getForDoubt(doubtId)[0];
    fake.setDenied(true);

    await expect(answerService.vote(answerId, 'up')).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: PERMISSION_COPY
    });

    expect(answerService.getForDoubt(doubtId)[0]).toEqual(before);
  });

  it('requires a signed-in member', async () => {
    setServiceActor(null);

    await expect(answerService.vote(answerId, 'up')).rejects.toMatchObject({ code: 'auth/required' });
  });
});

describe('answerService.addComment', () => {
  it('hangs the comment off its answer without leaking doubt bookkeeping', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');

    const comment = await answerService.addComment(answer.id, author, 'Can you elaborate?');

    expect(comment.doubtId).toBe(doubtId);
    expect(comment.answerId).toBe(answer.id);
    const stored = answerService.getForDoubt(doubtId)[0].comments[0];
    expect(stored).toMatchObject({ content: 'Can you elaborate?', authorId: author.id });
    expect('doubtId' in stored).toBe(false);
    expect('answerId' in stored).toBe(false);
    expect(fake.comments(doubtId)).toHaveLength(1);
  });

  it('refuses an empty comment', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');

    await expect(answerService.addComment(answer.id, author, '  ')).rejects.toMatchObject({
      code: 'comment/invalid'
    });
    expect(fake.comments(doubtId)).toEqual([]);
  });
});

describe('answerService doubt-level comments', () => {
  it('keeps question clarifications out of every answer thread', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');

    const comment = await answerService.addDoubtComment(doubtId, author, 'What have you tried?');

    expect(comment.answerId).toBe('');
    expect(comment.doubtId).toBe(doubtId);

    const thread = answerService.getDoubtComments(doubtId);
    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({ content: 'What have you tried?', authorId: author.id });
    expect('doubtId' in thread[0]).toBe(false);
    expect('answerId' in thread[0]).toBe(false);
    expect(answerService.getForDoubt(doubtId)[0].comments).toEqual([]);
    expect(fake.comments(doubtId)).toHaveLength(1);
  });

  it('hydrates both threads from a single read', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');
    await answerService.addComment(answer.id, author, 'On the answer');
    await answerService.addDoubtComment(doubtId, stranger, 'On the question');

    answerService.removeForDoubt(doubtId);
    await answerService.loadForDoubt(doubtId);

    expect(answerService.getDoubtComments(doubtId).map(c => c.content)).toEqual([
      'On the question'
    ]);
    expect(answerService.getForDoubt(doubtId)[0].comments.map(c => c.content)).toEqual([
      'On the answer'
    ]);
  });

  it('refuses an empty clarification', async () => {
    await expect(answerService.addDoubtComment(doubtId, author, '   ')).rejects.toMatchObject({
      code: 'comment/invalid'
    });
    expect(fake.comments(doubtId)).toEqual([]);
  });

  it('forgets both threads when the doubt is deleted', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');
    await answerService.addComment(answer.id, author, 'On the answer');
    await answerService.addDoubtComment(doubtId, author, 'On the question');

    answerService.removeForDoubt(doubtId);

    expect(answerService.getForDoubt(doubtId)).toEqual([]);
    expect(answerService.getDoubtComments(doubtId)).toEqual([]);
  });

  it('ignores clarifications that belong to a different question', async () => {
    await answerService.addDoubtComment(doubtId, author, 'On this question');

    expect(answerService.getDoubtComments('doubt-other')).toEqual([]);
  });
});

describe('answerService.updateComment', () => {
  it('lets the author rewrite their own comment and stamps the edit', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');
    const comment = await answerService.addComment(answer.id, author, 'Can you elaborate?');

    await answerService.updateComment(comment.id, author, 'Could you elaborate on step 3?');

    const stored = answerService.getForDoubt(doubtId)[0].comments[0];
    expect(stored.content).toBe('Could you elaborate on step 3?');
    expect(stored.updatedAt).toBeTruthy();
    expect(fake.comments(doubtId)[0].content).toBe('Could you elaborate on step 3?');
    expect(fake.comments(doubtId)[0].mentions).toEqual(comment.mentions);
  });

  it('refuses an edit from anyone but the author, including the answerer', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');
    const comment = await answerService.addComment(answer.id, author, 'Can you elaborate?');

    await expect(
      answerService.updateComment(comment.id, stranger, 'Hijacked')
    ).rejects.toMatchObject({ code: 'comment/forbidden' });
    await expect(
      answerService.updateComment(comment.id, mentor, 'Also hijacked')
    ).rejects.toMatchObject({ code: 'comment/forbidden' });

    expect(fake.comments(doubtId)[0].content).toBe('Can you elaborate?');
  });

  it('lets a moderator edit a comment they did not write', async () => {
    const comment = await answerService.addDoubtComment(doubtId, author, 'Original');

    await answerService.updateComment(comment.id, admin, 'Moderated');

    expect(answerService.getDoubtComments(doubtId)[0].content).toBe('Moderated');
    expect(fake.comments(doubtId)[0].content).toBe('Moderated');
  });

  it('refuses a blank edit and skips one that changes nothing', async () => {
    const comment = await answerService.addDoubtComment(doubtId, author, 'Original');

    await expect(answerService.updateComment(comment.id, author, '  ')).rejects.toMatchObject({
      code: 'comment/invalid'
    });
    await answerService.updateComment(comment.id, author, 'Original');

    expect(fake.calls.updateComment).toBe(0);
    expect(fake.comments(doubtId)[0].content).toBe('Original');
  });

  it('fails on a comment that was never loaded', async () => {
    await expect(
      answerService.updateComment('comm-ghost', author, 'Ghost')
    ).rejects.toMatchObject({ code: 'comment/not-found' });
  });
});

describe('answerService.removeComment', () => {
  it('lets the author and an administrator delete, and nobody else', async () => {
    const comment = await answerService.addDoubtComment(doubtId, author, 'Original');

    await expect(answerService.removeComment(comment.id, stranger)).rejects.toMatchObject({
      code: 'comment/forbidden'
    });
    expect(fake.comments(doubtId)).toHaveLength(1);

    await answerService.removeComment(comment.id, admin);
    expect(fake.comments(doubtId)).toEqual([]);
    expect(answerService.getDoubtComments(doubtId)).toEqual([]);
  });

  it('clears an answer comment from the thread it hangs off', async () => {
    const answer = await answerService.add(doubtId, mentor, 'First take');
    const comment = await answerService.addComment(answer.id, author, 'On the answer');

    await answerService.removeComment(comment.id, author);

    expect(answerService.getForDoubt(doubtId)[0].comments).toEqual([]);
    expect(fake.comments(doubtId)).toEqual([]);
  });

  it('fails on a comment that was never loaded', async () => {
    await expect(answerService.removeComment('comm-ghost', author)).rejects.toMatchObject({
      code: 'comment/not-found'
    });
  });
});

describe('comment moderation policy', () => {
  it('separates editing (author only) from deleting (author or admin)', async () => {
    const comment = await answerService.addDoubtComment(doubtId, author, 'Original');
    const stored = answerService.getDoubtComments(doubtId)[0];

    expect(canEditComment(stored, author)).toBe(true);
    expect(canEditComment(stored, admin)).toBe(true);
    expect(canEditComment(stored, stranger)).toBe(false);
    expect(canEditComment(stored, null)).toBe(false);

    expect(canDeleteComment(stored, author)).toBe(true);
    expect(canDeleteComment(stored, admin)).toBe(true);
    expect(canDeleteComment(stored, stranger)).toBe(false);
    expect(canDeleteComment(stored, null)).toBe(false);

    expect(comment.answerId).toBe('');
  });
});
