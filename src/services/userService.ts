import { AcademicYear, Department, User, UserStatus } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { mockUsers } from '../data/mockUsers';

interface UserDirectory {
  users: User[];
  status: LoadStatus;
  error?: string;
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

  /** Creates a pending account. Passwords never reach this layer. */
  createPendingUser(input: {
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

    const newUser: User = {
      id: `user-${Date.now()}`,
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

  updateProfile(userId: string, patch: Partial<User>): User {
    const updated = { ...requireUser(userId), ...patch, id: userId };
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
