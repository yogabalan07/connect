import { AcademicYear, Department, User, UserStatus } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { mockUsers } from '../data/mockUsers';

interface UserDirectory {
  users: User[];
  status: LoadStatus;
  error?: string;
}

/**
 * Profile fields a signed-in user may edit on their own record.
 *
 * Identity (`id`, `email`), authorization (`role`, `status`), ownership and
 * the derived counters are deliberately excluded: a client profile update can
 * never grant privileges, change moderation state or rewrite who owns a row.
 */
const EDITABLE_PROFILE_KEYS = [
  'name',
  'username',
  'avatar',
  'coverImage',
  'department',
  'year',
  'section',
  'bio',
  'skills'
] as const;

export type EditableProfileKey = (typeof EDITABLE_PROFILE_KEYS)[number];

/** Narrow patch accepted by `userService.updateProfile`. */
export type EditableProfilePatch = Partial<Pick<User, EditableProfileKey>>;

function assertEditableProfilePatch(patch: EditableProfilePatch): void {
  for (const key of Object.keys(patch)) {
    if (!EDITABLE_PROFILE_KEYS.some(allowed => allowed === key)) {
      throw new ServiceError('user/immutable-field', 'That profile field cannot be changed.');
    }
  }
}

const store = createStore<UserDirectory>({ users: mockUsers, status: 'loading' });

function requireUser(userId: string): User {
  const user = store.get().users.find(u => u.id === userId);
  if (!user) throw new ServiceError('user/not-found', 'That account no longer exists.');
  return user;
}

/**
 * User directory: registration, profile, moderation status.
 * Mock implementation — swap the store feed for Firestore `users` snapshots.
 */
export const userService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  getUsers(): User[] {
    return store.get().users;
  },

  getById(userId: string | null | undefined): User | undefined {
    if (!userId) return undefined;
    return store.get().users.find(u => u.id === userId);
  },

  getByEmail(email: string): User | undefined {
    const normalized = email.trim().toLowerCase();
    return store.get().users.find(u => u.email.toLowerCase() === normalized);
  },

  emailExists(email: string): boolean {
    return Boolean(userService.getByEmail(email));
  },

  /**
   * Creates a pending account. Passwords never reach this layer.
   * `id` is the Firebase Auth UID when the profile is created for an
   * authenticated identity — it is the canonical user id everywhere else in
   * the app. Role and status are fixed by the server-side policy: a client
   * registration can never choose them (never admin).
   */
  createPendingUser(input: {
    id?: string;
    name: string;
    email: string;
    department: Department;
    year: AcademicYear;
    section?: string;
    skills: string[];
  }): User {
    if (userService.emailExists(input.email)) {
      throw new ServiceError('user/email-taken', 'An account with this college email already exists.');
    }

    const id = input.id?.trim() || `user-${Date.now()}`;
    if (store.get().users.some(u => u.id === id)) {
      throw new ServiceError('user/id-taken', 'That account already exists.');
    }

    const newUser: User = {
      id,
      name: input.name.trim() || 'New Student',
      username: `student_${Date.now().toString().slice(-6)}`,
      email: input.email.trim().toLowerCase(),
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      department: input.department,
      year: input.year,
      section: input.section || 'A',
      bio: 'Aspiring engineering student exploring academics and tech doubts.',
      skills: input.skills,
      role: 'student',
      status: 'pending',
      reputation: 0,
      questionsCount: 0,
      answersCount: 0,
      acceptedCount: 0,
      followersCount: 0,
      followingCount: 0,
      joinedDate: 'Just now',
      badges: []
    };

    store.set(prev => ({ ...prev, users: [newUser, ...prev.users] }));
    return newUser;
  },

  /**
   * Resolves the application profile for a Firebase Auth identity.
   *
   * The Firebase UID is the canonical id: if the directory has no profile for
   * it (profile created before the users milestone, imported account, data
   * loss), a minimal `pending` profile is provisioned on the spot so the UI
   * never renders a half-signed-in state. Returns null when the identity
   * carries no email — callers must then handle "authenticated but no profile"
   * without crashing.
   */
  ensureProfileForAuthUser(authUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
  }): User | null {
    const existing = store.get().users.find(u => u.id === authUser.uid);
    if (existing) return existing;
    if (!authUser.email) return null;

    try {
      return userService.createPendingUser({
        id: authUser.uid,
        name: (authUser.displayName || authUser.email.split('@')[0] || 'New Student').trim(),
        email: authUser.email,
        department: 'CSE',
        year: '1st',
        section: 'A',
        skills: []
      });
    } catch {
      // Email already bound to a different profile: leave the directory alone.
      return null;
    }
  },

  /**
   * Applies a profile edit to the user's own record.
   *
   * Accepts only `EditableProfilePatch` — enforced again at runtime so a
   * JavaScript caller passing `id`, `email`, `role` or `status` is rejected
   * instead of silently mutating identity or authorization fields.
   */
  updateProfile(userId: string, patch: EditableProfilePatch): User {
    requireUser(userId);
    assertEditableProfilePatch(patch);

    const updated: User = { ...requireUser(userId), ...patch, id: userId };
    store.set(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === userId ? updated : u))
    }));
    return updated;
  },

  /** Single choke point for status transitions (approve/reject/block/unblock). */
  setStatus(userId: string, status: UserStatus): User {
    requireUser(userId);
    store.set(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === userId ? { ...u, status } : u))
    }));
    return { ...requireUser(userId), status };
  },

  adjustStats(userId: string, patch: Partial<Pick<User, 'reputation' | 'questionsCount' | 'answersCount' | 'acceptedCount' | 'followersCount'>>): void {
    store.set(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u;
        const next = { ...u };
        if (patch.reputation !== undefined) next.reputation = Math.max(0, u.reputation + patch.reputation);
        if (patch.questionsCount !== undefined) next.questionsCount = Math.max(0, u.questionsCount + patch.questionsCount);
        if (patch.answersCount !== undefined) next.answersCount = Math.max(0, u.answersCount + patch.answersCount);
        if (patch.acceptedCount !== undefined) next.acceptedCount = Math.max(0, u.acceptedCount + patch.acceptedCount);
        if (patch.followersCount !== undefined) next.followersCount = Math.max(0, u.followersCount + patch.followersCount);
        return next;
      })
    }));
  }
};

/** React subscription to the user directory. */
export function useUsersStore(): UserDirectory {
  return useStore(store);
}
