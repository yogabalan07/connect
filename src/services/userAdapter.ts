import type { AcademicYear, Department, User, UserRole, UserStatus } from '../types';
import { firebaseUserAdapter } from './firebaseUserAdapter';

/**
 * User/profile persistence contract.
 *
 * Layering: pages -> context/hooks -> domain services (userService) ->
 * THIS interface -> `firebaseUserAdapter` -> Firebase SDK.
 *
 * Nothing above this line ever imports the Firebase SDK, and nothing here
 * knows about React. Tests substitute an in-memory double through
 * `setUserAdapter`, so the whole domain layer runs without a project,
 * without network access and without `.env.local`.
 *
 * Document identity: the Firebase Auth UID is the id of the profile. It is
 * supplied by the caller (which always derives it from an authenticated
 * Firebase user) — never by registration form input.
 */
/**
 * Bounded directory search. `term` is matched as a prefix against the
 * display name and the handle; the rest are equality filters that narrow the
 * candidate set so the query stays inside one automatic index.
 */
export interface UserSearch {
  term?: string;
  department?: Department;
  year?: AcademicYear;
  status?: UserStatus;
  limit?: number;
}

export interface UserAdapter {
  /** Reads `users/{uid}`; `null` when the document does not exist. */
  getUserProfile(uid: string): Promise<User | null>;
  /**
   * Creates `users/{uid}`.
   *
   * The adapter owns the privileged fields: `id` is the uid, `role` is
   * always `student`, `status` is always `pending` and the timestamps are
   * server-generated. Callers cannot supply them, so no client-side input
   * can ever register an administrator.
   */
  createUserProfile(uid: string, input: NewUserProfile): Promise<User>;
  /** Applies an allow-listed profile patch to `users/{uid}`. */
  updateUserProfile(uid: string, patch: EditableProfilePatch): Promise<User>;
  /** Every profile in the directory (used to feed the user store). */
  listUsers(): Promise<User[]>;
  /** Admin queue: profiles with `status: pending`. */
  listPendingUsers(): Promise<User[]>;
  /** Single choke point for moderation status transitions. */
  setUserStatus(uid: string, status: UserStatus): Promise<User>;
  /**
   * Bounded directory search for the members picker.
   *
   * Prefix queries on `username` / `displayName` plus optional equality
   * filters - never a full collection pull, so the cost is one page instead
   * of the whole campus. An empty term falls back to a capped browse.
   */
  searchUsers(options: UserSearch): Promise<User[]>;
  /** pending -> approved */
  approveUser(uid: string): Promise<User>;
  /** pending -> rejected (the record is kept for audit history). */
  rejectUser(uid: string): Promise<User>;
  /** approved -> blocked */
  blockUser(uid: string): Promise<User>;
  /** blocked -> approved */
  unblockUser(uid: string): Promise<User>;
}

/**
 * Profile fields a signed-in user may edit on their own record.
 *
 * Identity (`id`, `email`), authorization (`role`, `status`), ownership,
 * timestamps and the derived counters are deliberately excluded: a client
 * profile update can never grant privileges, change moderation state or
 * rewrite who owns a row.
 */
export const EDITABLE_PROFILE_KEYS = [
  'name',
  'username',
  'avatar',
  'coverImage',
  'department',
  'year',
  'section',
  'bio',
  'skills',
  'github',
  'linkedin',
  'website'
] as const;

export type EditableProfileKey = (typeof EDITABLE_PROFILE_KEYS)[number];

/** Narrow patch accepted by profile updates everywhere above the adapter. */
export type EditableProfilePatch = Partial<Pick<User, EditableProfileKey>>;

/**
 * Everything a registration or provisioning call may supply.
 *
 * There is intentionally no `id`, `role`, `status`, `createdAt` or
 * `updatedAt` here: those belong to the adapter and the server-side policy.
 */
export interface NewUserProfile {
  email: string;
  name: string;
  department: Department;
  year: AcademicYear;
  username?: string;
  section?: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  skills?: string[];
}

/** The identity every profile lookup is derived from (Firebase Auth). */
export interface AuthProfileIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * The persisted `users/{uid}` document shape (Firestore schema).
 *
 * Field names follow the platform schema (`displayName`, `photoURL`,
 * `batch`, server timestamps); domain code keeps the app vocabulary
 * (`name`, `avatar`, `section`). The conversion lives in the Firebase
 * adapter, so no page or service ever sees a Firestore field name.
 */
export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  username?: string;
  role: UserRole;
  status: UserStatus;
  department?: Department;
  year?: AcademicYear;
  /** Persisted as `batch` — the project's "section" of a department. */
  batch?: string;
  bio?: string;
  photoURL?: string;
  coverImage?: string;
  skills?: string[];
  github?: string;
  linkedin?: string;
  website?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

let overrideAdapter: UserAdapter | null = null;

/** The profile backend the app runs against (Firebase unless overridden). */
export function getUserAdapter(): UserAdapter {
  return overrideAdapter ?? firebaseUserAdapter;
}

/**
 * Injection seam for tests and local tooling. Production code paths always
 * resolve to the Firebase adapter (`setUserAdapter(null)` restores it).
 */
export function setUserAdapter(adapter: UserAdapter | null): void {
  overrideAdapter = adapter;
}
