import { ServiceError } from '../../lib/errors';
import type { User, UserStatus } from '../../types';
import { DEFAULT_AVATAR, DEFAULT_BIO, defaultUsername } from '../userRecord';
import type {
  EditableProfilePatch,
  NewUserProfile,
  UserAdapter,
  UserSearch
} from '../userAdapter';

/**
 * In-memory `UserAdapter` double.
 *
 * Mirrors the Firestore adapter's contract (create-only id, privileged
 * fields, `user/not-found` on missing documents) without a project, network
 * access or `.env.local`, so `userService` and `authService` run hermetically
 * in tests. Inject with `setUserAdapter(createFakeUserAdapter())` and restore
 * with `setUserAdapter(null)`.
 */
export interface FakeUserAdapter extends UserAdapter {
  /** Preloads documents (newest last) as if they were read from a collection. */
  seed(users: User[]): void;
  /** Current documents, newest first. */
  records(): User[];
  /** How many times each adapter method ran (used to assert call counts). */
  readonly calls: Record<keyof UserAdapter | string, number>;
}

function notFound(): ServiceError {
  return new ServiceError('user/not-found', 'That account no longer exists.');
}

const METHODS: (keyof UserAdapter)[] = [
  'getUserProfile',
  'createUserProfile',
  'updateUserProfile',
  'listUsers',
  'listPendingUsers',
  'searchUsers',
  'setUserStatus',
  'approveUser',
  'rejectUser',
  'blockUser',
  'unblockUser'
];

export function createFakeUserAdapter(): FakeUserAdapter {
  const documents = new Map<string, User>();
  const calls: Record<string, number> = {};
  for (const method of METHODS) calls[method] = 0;
  const count = (name: string): void => {
    calls[name] = (calls[name] ?? 0) + 1;
  };

  function require(uid: string): User {
    const user = documents.get(uid);
    if (!user) throw notFound();
    return user;
  }

  function write(uid: string, user: User): User {
    const next = { ...user, id: uid };
    documents.set(uid, next);
    return next;
  }

  function bump(uid: string, patch: Partial<User>): User {
    return write(uid, { ...require(uid), ...patch });
  }

  const adapter: FakeUserAdapter = {
    calls,

    seed(users: User[]): void {
      for (const user of users) documents.set(user.id, { ...user });
    },

    records(): User[] {
      return Array.from(documents.values()).reverse();
    },

    async getUserProfile(uid: string): Promise<User | null> {
      count('getUserProfile');
      const user = documents.get(uid);
      return user ? { ...user } : null;
    },

    async createUserProfile(uid: string, input: NewUserProfile): Promise<User> {
      count('createUserProfile');
      if (documents.has(uid)) {
        throw new ServiceError('user/id-taken', 'That account already exists.');
      }
      // Privileged fields are fixed here, exactly as the adapter does.
      return write(uid, {
        id: uid,
        name: input.name.trim() || 'New Student',
        username: input.username ?? defaultUsername(uid),
        email: input.email.trim().toLowerCase(),
        avatar: input.avatar ?? DEFAULT_AVATAR,
        coverImage: input.coverImage,
        department: input.department,
        year: input.year,
        section: input.section,
        bio: input.bio ?? DEFAULT_BIO,
        skills: input.skills ?? [],
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
      });
    },

    async updateUserProfile(uid: string, patch: EditableProfilePatch): Promise<User> {
      count('updateUserProfile');
      const updated = { ...require(uid), ...patch, id: uid };
      return write(uid, updated);
    },

    async listUsers(): Promise<User[]> {
      count('listUsers');
      return adapter.records().map(user => ({ ...user }));
    },

    async listPendingUsers(): Promise<User[]> {
      count('listPendingUsers');
      return adapter
        .records()
        .filter(user => user.status === 'pending')
        .map(user => ({ ...user }));
    },

    async setUserStatus(uid: string, status: UserStatus): Promise<User> {
      count('setUserStatus');
      return bump(uid, { status });
    },

    async searchUsers(options: UserSearch): Promise<User[]> {
      count('searchUsers');
      const size = Math.max(1, Math.min(options.limit ?? 24, 100));
      const needle = (options.term ?? '').trim().toLowerCase();
      return adapter
        .records()
        .filter(user => user.status === (options.status ?? 'approved'))
        .filter(user => !options.department || user.department === options.department)
        .filter(user => !options.year || user.year === options.year)
        .filter(
          user =>
            !needle ||
            user.name.toLowerCase().includes(needle) ||
            user.username.toLowerCase().includes(needle)
        )
        .slice(0, size);
    },

    async approveUser(uid: string): Promise<User> {
      count('approveUser');
      return bump(uid, { status: 'approved' });
    },

    async rejectUser(uid: string): Promise<User> {
      count('rejectUser');
      return bump(uid, { status: 'rejected' });
    },

    async blockUser(uid: string): Promise<User> {
      count('blockUser');
      return bump(uid, { status: 'blocked' });
    },

    async unblockUser(uid: string): Promise<User> {
      count('unblockUser');
      return bump(uid, { status: 'approved' });
    }
  };

  return adapter;
}
