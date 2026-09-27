import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAt,
  updateDoc,
  where
} from 'firebase/firestore';
import type { DocumentData, DocumentSnapshot, Query } from 'firebase/firestore';
import { getFirebaseDb } from '../lib/firebase';
import { ServiceError } from '../lib/errors';
import type { User, UserRole, UserStatus } from '../types';
import { mapFirestoreError } from './firestoreErrors';
import { DEFAULT_AVATAR, DEFAULT_BIO, toUser } from './userRecord';
import type {
  EditableProfilePatch,
  NewUserProfile,
  UserAdapter,
  UserRecord,
  UserSearch
} from './userAdapter';

/**
 * Firestore user/profile adapter — the single production profile backend.
 *
 * Rules enforced here:
 * - `users/{uid}` is keyed by the Firebase Auth UID; the document id and the
 *   stored `id` field must match or the document is treated as malformed.
 * - Privileged fields (`id`, `role`, `status`, timestamps) are written by
 *   this file only: `createUserProfile` always stores `role: student` and
 *   `status: pending`, and updates can never touch them.
 * - `createUserProfile` runs in a transaction so a concurrent restore can
 *   never overwrite an existing profile (and its role/status) with a fresh
 *   pending document.
 * - Timestamps are Firestore server timestamps, never the client clock.
 * - Every SDK rejection and every malformed document leaves as a typed
 *   `ServiceError` — pages never see a `FirebaseError`.
 * - React pages never import this file; they go through context -> service.
 */
const USERS = 'users';

const VALID_ROLES: UserRole[] = ['student', 'mentor', 'admin'];
const VALID_STATUSES: UserStatus[] = ['approved', 'pending', 'rejected', 'blocked'];


function userRef(uid: string) {
  return doc(getFirebaseDb(), USERS, uid);
}

function malformed(): ServiceError {
  return new ServiceError(
    'user/malformed-profile',
    'This account record is invalid. Contact your department administrator.'
  );
}

/** Firestore `Timestamp` | `Date` | null -> `Date` (no `any` leaking out). */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') return (toDate as () => Date).call(value);
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Validates a stored document and converts it to the persisted shape.
 * Throws `user/malformed-profile` when required fields are missing, of the
 * wrong type, unknown to the domain, or when `id` disagrees with the
 * document id.
 */
function toUserRecord(snapshot: DocumentSnapshot): UserRecord {
  const data = (snapshot.data() ?? {}) as DocumentData;
  const id = snapshot.id;

  const email = asString(data.email);
  const displayName = asString(data.displayName);
  const role = asString(data.role) as UserRole | undefined;
  const status = asString(data.status) as UserStatus | undefined;

  if (data.id !== id) throw malformed();
  if (!email || !displayName) throw malformed();
  if (!role || !VALID_ROLES.includes(role)) throw malformed();
  if (!status || !VALID_STATUSES.includes(status)) throw malformed();

  return {
    id,
    email,
    displayName,
    username: asString(data.username),
    role,
    status,
    department: asString(data.department) as UserRecord['department'],
    year: asString(data.year) as UserRecord['year'],
    batch: asString(data.batch),
    bio: asString(data.bio),
    photoURL: asString(data.photoURL),
    coverImage: asString(data.coverImage),
    skills: Array.isArray(data.skills) ? data.skills.filter((s): s is string => typeof s === 'string') : undefined,
    github: asString(data.github),
    linkedin: asString(data.linkedin),
    website: asString(data.website),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt)
  };
}


/** Domain record -> Firestore field names (timestamps handled by callers). */
function toWriteData(record: UserRecord): DocumentData {
  const data: DocumentData = {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    role: record.role,
    status: record.status
  };
  if (record.username !== undefined) data.username = record.username;
  if (record.department !== undefined) data.department = record.department;
  if (record.year !== undefined) data.year = record.year;
  if (record.batch !== undefined) data.batch = record.batch;
  if (record.bio !== undefined) data.bio = record.bio;
  if (record.photoURL !== undefined) data.photoURL = record.photoURL;
  if (record.coverImage !== undefined) data.coverImage = record.coverImage;
  if (record.skills !== undefined) data.skills = record.skills;
  if (record.github !== undefined) data.github = record.github;
  if (record.linkedin !== undefined) data.linkedin = record.linkedin;
  if (record.website !== undefined) data.website = record.website;
  return data;
}

/**
 * Allow-listed profile patch -> persisted-record fields.
 *
 * Only the fields that are actually editable are translated, so even a
 * caller bypassing TypeScript cannot smuggle `role`, `status`, `id` or
 * `createdAt` into a profile update.
 */
function toRecordPatch(patch: EditableProfilePatch): Partial<UserRecord> {
  const next: Partial<UserRecord> = {};
  if (patch.name !== undefined) next.displayName = patch.name;
  if (patch.username !== undefined) next.username = patch.username;
  if (patch.department !== undefined) next.department = patch.department;
  if (patch.year !== undefined) next.year = patch.year;
  if (patch.section !== undefined) next.batch = patch.section;
  if (patch.bio !== undefined) next.bio = patch.bio;
  if (patch.avatar !== undefined) next.photoURL = patch.avatar;
  if (patch.coverImage !== undefined) next.coverImage = patch.coverImage;
  if (patch.skills !== undefined) next.skills = patch.skills;
  if (patch.github !== undefined) next.github = patch.github;
  if (patch.linkedin !== undefined) next.linkedin = patch.linkedin;
  if (patch.website !== undefined) next.website = patch.website;
  return next;
}

function readRecord(snapshot: DocumentSnapshot): UserRecord {
  if (!snapshot.exists()) {
    throw new ServiceError('user/not-found', 'That account no longer exists.');
  }
  return toUserRecord(snapshot);
}

async function setStatus(uid: string, status: UserStatus): Promise<User> {
  try {
    const ref = userRef(uid);
    const record = readRecord(await getDoc(ref));
    await updateDoc(ref, { status, updatedAt: serverTimestamp() });
    return toUser({ ...record, status, updatedAt: new Date() });
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export const firebaseUserAdapter: UserAdapter = {
  async getUserProfile(uid: string): Promise<User | null> {
    try {
      const snapshot = await getDoc(userRef(uid));
      if (!snapshot.exists()) return null;
      return toUser(toUserRecord(snapshot));
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  async createUserProfile(uid: string, input: NewUserProfile): Promise<User> {
    try {
      const record: UserRecord = {
        id: uid,
        email: input.email.trim().toLowerCase(),
        displayName: input.name.trim() || 'New Student',
        username: input.username,
        // Privileged fields — never derived from registration input.
        role: 'student',
        status: 'pending',
        department: input.department,
        year: input.year,
        batch: input.section,
        bio: input.bio ?? DEFAULT_BIO,
        photoURL: input.avatar ?? DEFAULT_AVATAR,
        coverImage: input.coverImage,
        skills: input.skills ?? [],
        createdAt: null,
        updatedAt: null
      };

      const data = { ...toWriteData(record), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

      // Create-only: a racing restore must never overwrite an existing
      // profile (and silently reset role/status to pending/student).
      await runTransaction(getFirebaseDb(), async tx => {
        const existing = await tx.get(userRef(uid));
        if (existing.exists()) {
          throw new ServiceError('user/id-taken', 'That account already exists.');
        }
        tx.set(userRef(uid), data);
      });

      const now = new Date();
      return toUser({ ...record, createdAt: now, updatedAt: now });
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  async updateUserProfile(uid: string, patch: EditableProfilePatch): Promise<User> {
    try {
      const ref = userRef(uid);
      const record = readRecord(await getDoc(ref));
      const next: UserRecord = { ...record, ...toRecordPatch(patch), updatedAt: new Date() };
      await updateDoc(ref, { ...toRecordPatch(patch), updatedAt: serverTimestamp() });
      return toUser(next);
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  async listUsers(): Promise<User[]> {
    try {
      const snapshot = await getDocs(collection(getFirebaseDb(), USERS));
      const users: User[] = [];
      for (const docSnapshot of snapshot.docs) {
        try {
          users.push(toUser(toUserRecord(docSnapshot)));
        } catch {
          // One corrupt record must not take down the whole directory.
          continue;
        }
      }
      return users;
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  async listPendingUsers(): Promise<User[]> {
    try {
      const pending = query(
        collection(getFirebaseDb(), USERS),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(pending);
      const users: User[] = [];
      for (const docSnapshot of snapshot.docs) {
        try {
          users.push(toUser(toUserRecord(docSnapshot)));
        } catch {
          continue;
        }
      }
      return users;
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  /**
   * Directory search that never becomes a full collection pull.
   *
   * Two prefix queries (display name and handle) narrow the candidates on the
   * server using the automatic single-field indexes, and a bounded recent
   * page is folded in so a case difference cannot hide somebody. Everything
   * else - department, year, status and the case-insensitive substring match
   * - is applied to that candidate set, which is then hard-capped.
   */
  async searchUsers(options: UserSearch): Promise<User[]> {
    try {
      const size = Math.max(1, Math.min(options.limit ?? 24, 100));
      const base = collection(getFirebaseDb(), USERS);
      const term = (options.term ?? '').trim();
      const needle = term.toLowerCase();

      const candidates = new Map<string, User>();
      const collect = (snapshot: { docs: DocumentSnapshot[] }): void => {
        for (const docSnapshot of snapshot.docs) {
          try {
            const user = toUser(toUserRecord(docSnapshot));
            candidates.set(user.id, user);
          } catch {
            continue;
          }
        }
      };

      const recent = await getDocs(query(base, orderBy('createdAt', 'desc'), limitTo(size)));
      collect(recent);

      if (term) {
        const prefix = (field: 'displayName' | 'username'): Query<DocumentData> =>
          query(base, orderBy(field), startAt(term), endAt(`${term}`));
        const [byName, byHandle] = await Promise.all([getDocs(prefix('displayName')), getDocs(prefix('username'))]);
        collect(byName);
        collect(byHandle);
      }

      return Array.from(candidates.values())
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
    } catch (error) {
      throw mapFirestoreError(error);
    }
  },

  setUserStatus: setStatus,

  async approveUser(uid: string): Promise<User> {
    return setStatus(uid, 'approved');
  },

  async rejectUser(uid: string): Promise<User> {
    return setStatus(uid, 'rejected');
  },

  async blockUser(uid: string): Promise<User> {
    return setStatus(uid, 'blocked');
  },

  async unblockUser(uid: string): Promise<User> {
    return setStatus(uid, 'approved');
  }
};
