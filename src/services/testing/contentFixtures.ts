import type { Answer, Category, Doubt, Tag, User } from '../../types';
import { toUserSnapshot } from '../../types';

/**
 * Deterministic fixtures for the doubt-domain test suites.
 *
 * Every shape mirrors what `firebaseContentAdapter` writes and what
 * `firestore.rules` accepts on create: counters start at zero, the author is
 * denormalized into an `authorSnapshot`, and a doubt carries both bookkeeping
 * ids (`lastAnswerId`, `acceptedAnswerId`) from the very first write.
 */
export function makeUser(
  overrides: Partial<User> & Pick<User, 'id' | 'role' | 'status'>
): User {
  const id = overrides.id;
  const user: User = {
    id,
    role: overrides.role,
    status: overrides.status,
    name: 'Test Student',
    username: `user_${id}`,
    email: `${id}@campus.edu`,
    avatar: '',
    department: 'CSE',
    year: '3rd',
    bio: '',
    skills: [],
    reputation: 100,
    questionsCount: 0,
    answersCount: 0,
    acceptedCount: 0,
    followersCount: 0,
    followingCount: 0,
    joinedDate: '2026',
    badges: []
  };
  return { ...user, ...overrides };
}

export function makeDoubt(author: User, overrides: Partial<Doubt> = {}): Doubt {
  const doubt: Doubt = {
    id: `doubt-${author.id}-1`,
    title: 'How does a B+ tree stay balanced on delete?',
    description: 'Inserts are clear, but the rebalancing rules on delete confuse me.',
    authorId: author.id,
    authorSnapshot: toUserSnapshot(author),
    createdAt: 'Just now',
    category: 'Data Structures & Algorithms',
    subject: 'DSA',
    tags: ['DSA'],
    visibility: 'public',
    allowedUserIds: [],
    priority: 'normal',
    upvotes: 0,
    downvotes: 0,
    views: 0,
    answersCount: 0,
    hasAcceptedAnswer: false,
    lastAnswerId: null,
    acceptedAnswerId: null
  };
  return { ...doubt, ...overrides };
}

export function makeAnswer(doubtId: string, author: User, overrides: Partial<Answer> = {}): Answer {
  const answer: Answer = {
    id: `ans-${author.id}-1`,
    doubtId,
    authorId: author.id,
    authorSnapshot: toUserSnapshot(author),
    content: 'Merge the underflowing node with a sibling, then recurse upwards.',
    createdAt: 'Just now',
    upvotes: 0,
    downvotes: 0,
    isAccepted: false,
    comments: []
  };
  return { ...answer, ...overrides };
}

export function makeCategory(
  overrides: Partial<Category> & Pick<Category, 'id' | 'name'>
): Category {
  const category: Category = {
    id: overrides.id,
    name: overrides.name,
    slug: 'fixture-category',
    description: 'Fixture category',
    icon: 'BookOpen',
    domain: 'Academics',
    questionsCount: 0,
    status: 'active'
  };
  return { ...category, ...overrides };
}

export function makeTag(overrides: Partial<Tag> & Pick<Tag, 'id' | 'name'>): Tag {
  const tag: Tag = {
    id: overrides.id,
    name: overrides.name,
    description: 'Fixture tag',
    count: 0,
    followersCount: 0
  };
  return { ...tag, ...overrides };
}
