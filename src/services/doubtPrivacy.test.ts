import { describe, expect, it } from 'vitest';
import { canEditDoubt, canViewDoubt, filterVisibleDoubts } from './doubtService';
import { Doubt, User, UserSnapshot } from '../types';

function makeUser(overrides: Partial<User> & Pick<User, 'id' | 'role' | 'status'>): User {
  return {
    name: overrides.name ?? 'Test Student',
    username: overrides.username ?? `user_${overrides.id}`,
    email: `${overrides.id}@campus.edu`,
    avatar: '',
    department: 'Computer Science and Engineering',
    year: '3rd Year',
    bio: '',
    skills: [],
    reputation: 100,
    questionsCount: 0,
    answersCount: 0,
    acceptedCount: 0,
    followersCount: 0,
    followingCount: 0,
    joinedDate: '2026',
    badges: [],
    ...overrides
  } as User;
}

function snapshot(user: User): UserSnapshot {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    department: user.department,
    year: user.year,
    role: user.role,
    reputation: user.reputation
  };
}

const student = makeUser({ id: 'student-1', role: 'student', status: 'approved' });
const mentor = makeUser({ id: 'mentor-1', role: 'mentor', status: 'approved' });
const admin = makeUser({ id: 'admin-1', role: 'admin', status: 'approved' });

function makeDoubt(author: User, overrides: Partial<Doubt> = {}): Doubt {
  return {
    id: `doubt-${author.id}-1`,
    title: 'How does a B+ tree stay balanced on delete?',
    description: 'I understand inserts but the rebalancing rules on delete confuse me.',
    authorId: author.id,
    authorSnapshot: snapshot(author),
    createdAt: 'Just now',
    category: 'Data Structures & Algorithms',
    subject: 'DSA',
    tags: ['DSA'],
    visibility: 'public',
    upvotes: 0,
    downvotes: 0,
    views: 1,
    answersCount: 0,
    hasAcceptedAnswer: false,
    ...overrides
  };
}

const publicDoubt = makeDoubt(student);
const privateDoubt = makeDoubt(student, {
  id: 'doubt-private-1',
  visibility: 'private',
  allowedUserIds: [mentor.id]
});

const stranger: User = makeUser({ id: 'stranger-1', role: 'student', status: 'approved' });

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
    expect(canViewDoubt(privateDoubt, student)).toBe(true);
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
    expect(canEditDoubt(privateDoubt, student)).toBe(true);
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
