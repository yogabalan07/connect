import { User } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';
import { EDITABLE_PROFILE_KEYS, getUserAdapter } from './userAdapter';
import type {
  AuthProfileIdentity,
  EditableProfileKey,
  EditableProfilePatch,
  NewUserProfile,
  UserSearch
} from './userAdapter';
import { mapFirestoreError } from './firestoreErrors';

export type { EditableProfileKey, EditableProfilePatch };

/**
 * User directory: registration, profile, moderation status.
 *
 * Layering: UI -> context/hooks -> THIS file -> user adapter -> Firebase SDK.
 *
 * State lives in a plain store so React subscribes exactly as before; every
 * read is served from the store and every write goes through the adapter and
 * is mirrored back into it, which is what keeps pages, guards and the admin
 * queue in sync after each operation.
 *
 * Guarantees:
 * - The Firebase Auth UID is the canonical id (`users/{uid}`); callers must
 *   take it from an authenticated identity, never from form input.
 * - `role`, `status`, `id` and the timestamps are never accepted from a
 *   profile patch: `updateUserProfile` rejects them, and the adapter only
 *   serializes allow-listed fields.
 * - No password (or any credential) is ever accepted, stored or read here.
 * - Errors leave as typed `ServiceError`s with campus-friendly copy.
 */
interface UserDirectory {
  users: User[];
  status: LoadStatus;
  error?: string;
}

const store = createStore<UserDirectory>({ users: [], status: 'loading' });

/** Identity acting on the directory (set by the auth service on every change). */
let actor: User | null = null;

/**
 * Serializes profile work per UID.
 *
 * `onAuthStateChanged`, a sign-in and a registration can all race for the
 * same brand-new profile; chaining them guarantees the create happens once
 * instead of twice.
 */
const uidLocks = new Map<string, Promise<unknown>>();

function withUidLock<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const previous = uidLocks.get(uid) ?? Promise.resolve();
  const next = previous.then(task, task);
  uidLocks.set(
    uid,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

/** Runs an adapter call and guarantees a typed, campus-friendly failure. */
async function viaAdapter<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

function assertEditableProfilePatch(patch: EditableProfilePatch): void {
  for (const key of Object.keys(patch)) {
    if (!EDITABLE_PROFILE_KEYS.some(allowed => allowed === key)) {
      throw new ServiceError('user/immutable-field', 'That profile field cannot be changed.');
    }
  }
}

/** The acting identity, re-read from the directory so role changes apply at once. */
function currentActor(): User | null {
  const current = actor;
  if (!current) return null;
  return store.get().users.find(u => u.id === current.id) ?? current;
}

function requireOwner(userId: string): User {
  const current = currentActor();
  if (!current) throw new ServiceError('user/forbidden', 'Sign in to edit your profile.');
  if (current.id !== userId) {
    throw new ServiceError('user/forbidden', 'You can only edit your own profile.');
  }
  return current;
}

function requireAdmin(): User {
  const current = currentActor();
  if (!current || current.role !== 'admin') {
    throw new ServiceError('user/forbidden', 'Only administrators can manage accounts.');
  }
  return current;
}

function upsert(user: User): void {
  store.set(prev => {
    const exists = prev.users.some(u => u.id === user.id);
    return {
      ...prev,
      users: exists ? prev.users.map(u => (u.id === user.id ? user : u)) : [user, ...prev.users]
    };
  });
}

/**
 * Fetched directory first, then everything this client already knows.
 *
 * A list query issued before a just-created profile would otherwise drop the
 * signed-in user out of the directory and bounce the UI back to /login.
 */
function mergeDirectory(fetched: User[], existing: User[]): User[] {
  const byId = new Map<string, User>();
  for (const user of existing) byId.set(user.id, user);
  for (const user of fetched) byId.set(user.id, user);
  return Array.from(byId.values());
}

/** Creates `users/{uid}` through the adapter (role/status are fixed there). */
async function createLocked(uid: string, profile: NewUserProfile): Promise<User> {
  if (userService.emailExists(profile.email)) {
    throw new ServiceError('user/email-taken', 'An account with this college email already exists.');
  }
  if (store.get().users.some(u => u.id === uid)) {
    throw new ServiceError('user/id-taken', 'That account already exists.');
  }
  const created = await viaAdapter(() => getUserAdapter().createUserProfile(uid, profile));
  upsert(created);
  return created;
}

function transition(
  operation: 'approveUser' | 'rejectUser' | 'blockUser' | 'unblockUser'
): (uid: string) => Promise<User> {
  return async (uid: string): Promise<User> => {
    // Client-side guard for UX only — Firestore rules are the real boundary.
    requireAdmin();
    return withUidLock(uid, async () => {
      const updated = await viaAdapter(() => getUserAdapter()[operation](uid));
      upsert(updated);
      return updated;
    });
  };
}

export const userService = {
  store,

  /**
   * Prepares the directory for this boot.
   *
   * The first read starts once a session exists: Firestore rules only let
   * signed-in members list `users`, so an anonymous boot must not issue a
   * request that is guaranteed to come back `permission-denied`.
   */
  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'loading', error: undefined }));
  },

  /** Replaces the directory contents with the persisted ones. */
  async loadDirectory(): Promise<void> {
    try {
      const fetched = await viaAdapter(() => getUserAdapter().listUsers());
      store.set(prev => ({
        ...prev,
        users: mergeDirectory(fetched, prev.users),
        status: 'ready',
        error: undefined
      }));
    } catch (error) {
      const mapped = mapFirestoreError(error);
      store.set(prev => ({ ...prev, status: 'error', error: mapped.message }));
    }
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
   * Bounded directory search.
   *
   * Deliberately a separate call from `loadDirectory`: the full directory
   * read stays exactly as it was, and a picker that needs a page of matches
   * asks for a page of matches instead of re-pulling everybody.
   */
  async searchUsers(options: UserSearch): Promise<User[]> {
    return viaAdapter(() => getUserAdapter().searchUsers(options));
  },

  /**
   * Publishes the identity acting on the directory (called by the auth
   * service on sign-in, restore and sign-out).
   */
  setActor(user: User | null): void {
    actor = user;
  },

  /** Reads `users/{uid}` from the adapter and keeps it in the directory. */
  async getUserProfile(uid: string): Promise<User | null> {
    const profile = await viaAdapter(() => getUserAdapter().getUserProfile(uid));
    if (profile) upsert(profile);
    return profile;
  },

  /**
   * Creates a pending profile for an authenticated identity.
   *
   * `id` is the Firebase Auth UID supplied by the auth layer. It is never
   * taken from registration form input, and the adapter always writes
   * `role: student` / `status: pending`, so no client-side payload can
   * register an administrator or an approved account.
   */
  async createUserProfile(input: { id: string } & NewUserProfile): Promise<User> {
    const uid = input.id.trim();
    if (!uid) throw new ServiceError('user/invalid-id', 'That account identity is not valid.');
    const { id: _identity, ...profile } = input;
    return withUidLock(uid, () => createLocked(uid, profile));
  },

  /**
   * Registration upsert: creates `users/{uid}` when the identity has no
   * profile, otherwise applies the registration details to the provisional
   * profile created by `onAuthStateChanged` — keeping its role and status.
   */
  async registerProfile(input: { id: string } & NewUserProfile): Promise<User> {
    const uid = input.id.trim();
    if (!uid) throw new ServiceError('user/invalid-id', 'That account identity is not valid.');
    const { id: _identity, ...profile } = input;

    return withUidLock(uid, async () => {
      const existing = await viaAdapter(() => getUserAdapter().getUserProfile(uid));
      if (!existing) return createLocked(uid, profile);

      const patch: EditableProfilePatch = { name: profile.name };
      if (profile.department !== undefined) patch.department = profile.department;
      if (profile.year !== undefined) patch.year = profile.year;
      if (profile.section !== undefined) patch.section = profile.section;
      if (profile.skills !== undefined) patch.skills = profile.skills;
      if (profile.username !== undefined) patch.username = profile.username;
      if (profile.bio !== undefined) patch.bio = profile.bio;
      if (profile.avatar !== undefined) patch.avatar = profile.avatar;

      const updated = await viaAdapter(() => getUserAdapter().updateUserProfile(uid, patch));
      upsert(updated);
      return updated;
    });
  },

  /**
   * Resolves the application profile for a Firebase Auth identity.
   *
   * Firebase UID -> `users/{uid}` -> profile. An existing document is
   * returned untouched (a reload keeps approved/admin/pending/rejected/
   * blocked exactly as persisted); a minimal `pending` profile is only
   * provisioned when the document does not exist yet. Returns `null` when
   * the identity carries no email — callers then render "authenticated but
   * no profile" without crashing.
   */
  async ensureProfileForAuthUser(authUser: AuthProfileIdentity): Promise<User | null> {
    const uid = authUser.uid.trim();
    if (!uid) return null;

    return withUidLock(uid, async () => {
      const existing = await viaAdapter(() => getUserAdapter().getUserProfile(uid));
      if (existing) {
        upsert(existing);
        return existing;
      }
      if (!authUser.email) return null;

      try {
        return await createLocked(uid, {
          name: (authUser.displayName || authUser.email.split('@')[0] || 'New Student').trim(),
          email: authUser.email,
          department: 'CSE' as const,
          year: '1st' as const,
          section: 'A',
          skills: []
        });
      } catch (error) {
        // Email/id already bound elsewhere: leave the directory alone rather
        // than shadowing another account's record.
        if (error instanceof ServiceError) {
          if (error.code === 'user/email-taken' || error.code === 'user/id-taken') return null;
        }
        throw error;
      }
    });
  },

  /**
   * Applies an allow-listed edit to the user's own profile and persists it.
   *
   * Immutable fields (`id`, `email`, `role`, `status`, timestamps) are
   * rejected twice: by the TypeScript patch type and at runtime, so a
   * JavaScript caller passing `role`/`status` still cannot escalate itself.
   */
  async updateUserProfile(userId: string, patch: EditableProfilePatch): Promise<User> {
    assertEditableProfilePatch(patch);
    requireOwner(userId);

    return withUidLock(userId, async () => {
      const updated = await viaAdapter(() => getUserAdapter().updateUserProfile(userId, patch));
      upsert(updated);
      const current = actor;
      if (current && current.id === userId) actor = updated;
      return updated;
    });
  },

  /** Admin queue straight from Firestore (also merged into the directory). */
  async listPendingUsers(): Promise<User[]> {
    const pending = await viaAdapter(() => getUserAdapter().listPendingUsers());
    store.set(prev => ({ ...prev, users: mergeDirectory(pending, prev.users) }));
    return pending;
  },

  /** pending -> approved */
  approveUser: transition('approveUser'),
  /** pending -> rejected (record kept for audit history). */
  rejectUser: transition('rejectUser'),
  /** approved -> blocked */
  blockUser: transition('blockUser'),
  /** blocked -> approved */
  unblockUser: transition('unblockUser'),

  /**
   * In-memory preview of the derived counters.
   *
   * This store is never a source of truth: `reputation` is persisted only by
   * `reputationCreditEdit()` in `firestore.rules` (same commit as the ledger
   * row), and every count a profile shows is re-derived from
   * `reputationEvents` / `follows` / `userBadges` by `profileService`. What
   * this method buys is an immediately-correct-looking directory while the
   * next read is still in flight.
   */
  adjustStats(
    userId: string,
    patch: Partial<
      Pick<
        User,
        'reputation' | 'questionsCount' | 'answersCount' | 'acceptedCount' | 'followersCount'
      >
    >
  ): void {
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

/** Test seam: empties the directory and forgets the acting identity. */
export function resetUserDirectoryForTests(): void {
  actor = null;
  uidLocks.clear();
  store.set({ users: [], status: 'loading', error: undefined });
}
