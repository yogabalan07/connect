import type { User } from '../types';
import type { UserRecord } from './userAdapter';

/**
 * Persisted `users/{uid}` record <-> domain `User` mapping.
 *
 * Shared by every user adapter so the app vocabulary (`name`, `avatar`,
 * `section`, `joinedDate`) and the platform schema (`displayName`,
 * `photoURL`, `batch`, server timestamps) stay in exactly one place. Only
 * the Firebase adapter talks to the SDK; this module is pure data.
 */
export const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

export const DEFAULT_BIO = 'Aspiring engineering student exploring academics and tech doubts.';

/** Deterministic handle derived from the UID (never from user input). */
export function defaultUsername(uid: string): string {
  return `student_${uid.slice(-6).toLowerCase()}`;
}

function formatJoinedDate(value: Date | null): string {
  if (!value) return 'Just now';
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Converts a persisted record into the `User` shape the domain expects.
 * Derived counters start at zero: content milestones (doubts, answers) own
 * them and have not been migrated to Firestore yet.
 */
export function toUser(record: UserRecord): User {
  return {
    id: record.id,
    name: record.displayName,
    username: record.username ?? defaultUsername(record.id),
    email: record.email,
    avatar: record.photoURL ?? DEFAULT_AVATAR,
    coverImage: record.coverImage,
    department: record.department ?? 'CSE',
    year: record.year ?? '1st',
    section: record.batch,
    bio: record.bio ?? DEFAULT_BIO,
    skills: record.skills ?? [],
    role: record.role,
    status: record.status,
    reputation: 0,
    questionsCount: 0,
    answersCount: 0,
    acceptedCount: 0,
    followersCount: 0,
    followingCount: 0,
    joinedDate: formatJoinedDate(record.createdAt),
    badges: []
  };
}
