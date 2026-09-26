import { describe, expect, it } from 'vitest';
import { canEditDoubt, canViewDoubt, filterVisibleDoubts } from './doubtService';
import { allMockDoubts } from '../data/mockDoubts';
import { mockUsers } from '../data/mockUsers';
import { Doubt, User } from '../types';

const student = mockUsers[0];
const mentor = mockUsers[1];
const admin = mockUsers[2];

const publicDoubt: Doubt = allMockDoubts[0];
const privateDoubt: Doubt = {
  ...allMockDoubts[1],
  visibility: 'private',
  allowedUserIds: [mentor.id]
};

const stranger: User = {
  ...student,
  id: 'user-stranger',
  username: 'someone_else'
};

describe('canViewDoubt (deny-by-default privacy)', () => {
  it('shows public doubts to everyone, including anonymous visitors', () => {
    expect(canViewDoubt(publicDoubt, null)).toBe(true);
    expect(canViewDoubt(publicDoubt, stranger)).toBe(true);
  });

  it('hides private doubts from anonymous visitors', () => {
    expect(canViewDoubt(privateDoubt, null)).toBe(false);
    expect(canViewDoubt(privateDoubt, undefined)).toBe(false);
  });

  it('allows the author of a private doubt', () => {
    const author = mockUsers.find(u => u.id === privateDoubt.authorId);
    expect(author).toBeDefined();
    expect(canViewDoubt(privateDoubt, author!)).toBe(true);
  });

  it('allows explicitly allowed participants', () => {
    expect(canViewDoubt(privateDoubt, mentor)).toBe(true);
  });

  it('denies unrelated students', () => {
    expect(canViewDoubt(privateDoubt, stranger)).toBe(false);
  });

  it('lets admins review private doubts', () => {
    expect(canViewDoubt(privateDoubt, admin)).toBe(true);
  });
});

describe('filterVisibleDoubts (feed filtering)', () => {
  const feed = [publicDoubt, privateDoubt];

  it('strips private doubts from the feed of an unrelated user', () => {
    const visible = filterVisibleDoubts(feed, stranger);
    expect(visible).toEqual([publicDoubt]);
  });

  it('strips private doubts for anonymous viewers', () => {
    expect(filterVisibleDoubts(feed, null)).toEqual([publicDoubt]);
  });

  it('keeps private doubts for allowed participants and admins', () => {
    expect(filterVisibleDoubts(feed, mentor)).toEqual(feed);
    expect(filterVisibleDoubts(feed, admin)).toEqual(feed);
  });

  it('never invents or mutates entries', () => {
    const input = [publicDoubt, privateDoubt];
    filterVisibleDoubts(input, stranger);
    expect(input).toHaveLength(2);
  });
});

describe('canEditDoubt', () => {
  it('allows the author', () => {
    const author = mockUsers.find(u => u.id === privateDoubt.authorId);
    expect(canEditDoubt(privateDoubt, author!)).toBe(true);
  });

  it('allows admins to moderate', () => {
    expect(canEditDoubt(privateDoubt, admin)).toBe(true);
  });

  it('denies everyone else', () => {
    expect(canEditDoubt(privateDoubt, stranger)).toBe(false);
    expect(canEditDoubt(privateDoubt, null)).toBe(false);
    expect(canEditDoubt(privateDoubt, undefined)).toBe(false);
  });
});
