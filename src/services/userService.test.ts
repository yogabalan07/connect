import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/errors';
import type { User } from '../types';
import {
  resetUserDirectoryForTests,
  userService,
  useUsersStore
} from './userService';
import { setUserAdapter } from './userAdapter';
import type { EditableProfilePatch, NewUserProfile, UserRecord } from './userAdapter';
import { DEFAULT_AVATAR, defaultUsername, toUser } from './userRecord';
import { createFakeUserAdapter } from './testing/fakeUserAdapter';
import type { FakeUserAdapter } from './testing/fakeUserAdapter';

/**
 * M3: Firestore-backed user profiles + admin approval.
 *
 * The domain layer runs against an in-memory adapter so these tests exercise
 * the real service policy — uid identity, privileged fields, moderation
 * transitions, directory merging — without a Firebase project, without
 * network access and without `.env.local`.
 */
function makeProfile(overrides: Partial<User> = {}): User {
  return {
    id: 'uid_1',
    name: 'Directory User',
    username: 'directory_user',
    email: 'user@college.edu',
    avatar: DEFAULT_AVATAR,
    department: 'CSE',
    year: '2nd',
    section: 'A',
    bio: '',
    skills: [],
    role: 'student',
    status: 'approved',
    reputation: 0,
    questionsCount: 0,
    answersCount: 0,
    acceptedCount: 0,
    followersCount: 0,
    followingCount: 0,
    joinedDate: 'Just now',
    badges: [],
    ...overrides
  };
}

let uidSequence = 0;
const registration = (overrides: Partial<NewUserProfile> = {}): NewUserProfile => ({
  email: `m3_${(uidSequence += 1)}@college.edu`,
  name: 'Milestone Three',
  department: 'CSE',
  year: '1st',
  section: 'A',
  skills: ['React'],
  ...overrides
});

let fakeUsers: FakeUserAdapter;

beforeEach(() => {
  resetUserDirectoryForTests();
  fakeUsers = createFakeUserAdapter();
  setUserAdapter(fakeUsers);
});

afterEach(() => {
  setUserAdapter(null);
});

describe('userService.createUserProfile', () => {
  it('creates a pending student keyed by the Firebase uid', async () => {
    const created = await userService.createUserProfile({
      id: 'uid_new',
      ...registration({ email: 'New@College.edu' })
    });

    expect(created.id).toBe('uid_new');
    expect(created.role).toBe('student');
    expect(created.status).toBe('pending');
    expect(created.email).toBe('new@college.edu'); // normalized once, at write time
    expect(userService.getById('uid_new')).toBe(created);
  });

  it('ignores role, status and id smuggled in the payload', async () => {
    const hostile = {
      id: 'uid_hostile',
      ...registration(),
      role: 'admin',
      status: 'approved'
    } as unknown as { id: string } & NewUserProfile;

    const created = await userService.createUserProfile(hostile);

    expect(created.id).toBe('uid_hostile');
    expect(created.role).toBe('student');
    expect(created.status).toBe('pending');
  });

  it('rejects an email the directory already owns', async () => {
    const email = 'shared@college.edu';
    await userService.createUserProfile({ id: 'uid_a', ...registration({ email }) });

    await expect(
      userService.createUserProfile({ id: 'uid_b', ...registration({ email }) })
    ).rejects.toMatchObject({
      code: 'user/email-taken',
      message: 'An account with this college email already exists.'
    });
  });

  it('rejects a uid that already has a profile', async () => {
    await userService.createUserProfile({ id: 'uid_dup', ...registration() });

    await expect(
      userService.createUserProfile({ id: 'uid_dup', ...registration() })
    ).rejects.toMatchObject({ code: 'user/id-taken' });
  });

  it('refuses an empty identity', async () => {
    await expect(
      userService.createUserProfile({ id: '   ', ...registration() })
    ).rejects.toMatchObject({ code: 'user/invalid-id' });
  });
});

describe('userService.registerProfile', () => {
  it('creates the profile when the identity has none', async () => {
    const created = await userService.registerProfile({ id: 'uid_reg', ...registration() });

    expect(created.status).toBe('pending');
    expect(created.role).toBe('student');
    expect(fakeUsers.calls.createUserProfile).toBe(1);
    expect(userService.getById('uid_reg')).toBe(created);
  });

  it('fills in the provisional profile instead of creating a second one', async () => {
    await userService.createUserProfile({ id: 'uid_provisional', ...registration() });

    const registered = await userService.registerProfile({
      id: 'uid_provisional',
      ...registration({ name: 'Filled In', department: 'ECE', year: '3rd', section: 'C' })
    });

    expect(fakeUsers.calls.createUserProfile).toBe(1); // upsert, never a duplicate
    expect(registered.name).toBe('Filled In');
    expect(registered.department).toBe('ECE');
    expect(registered.year).toBe('3rd');
    expect(registered.section).toBe('C');
    expect(registered.status).toBe('pending');
    expect(registered.role).toBe('student');
  });

  it('never resets moderation state that was already persisted', async () => {
    const approved = makeProfile({ id: 'uid_approved', email: 'approved@college.edu' });
    fakeUsers.seed([approved]);

    const registered = await userService.registerProfile({
      id: 'uid_approved',
      ...registration({ email: 'approved@college.edu', name: 'Re-registered' })
    });

    expect(registered.status).toBe('approved');
    expect(registered.role).toBe('student');
    expect(registered.name).toBe('Re-registered');
    expect(fakeUsers.calls.createUserProfile).toBe(0);
  });
});

describe('userService.ensureProfileForAuthUser', () => {
  it('returns the persisted profile untouched, keeping role and status', async () => {
    fakeUsers.seed([
      makeProfile({ id: 'uid_admin', email: 'admin@college.edu', role: 'admin', status: 'approved' }),
      makeProfile({ id: 'uid_blocked', email: 'blocked@college.edu', status: 'blocked' })
    ]);

    const admin = await userService.ensureProfileForAuthUser({
      uid: 'uid_admin',
      email: 'admin@college.edu',
      displayName: 'Administrator'
    });
    const blocked = await userService.ensureProfileForAuthUser({
      uid: 'uid_blocked',
      email: 'blocked@college.edu',
      displayName: 'Blocked Student'
    });

    expect(admin?.role).toBe('admin');
    expect(admin?.status).toBe('approved');
    expect(blocked?.status).toBe('blocked');
    expect(fakeUsers.calls.createUserProfile).toBe(0);
    expect(userService.getById('uid_admin')?.status).toBe('approved');
  });

  it('provisions a pending student profile for a brand-new identity', async () => {
    const profile = await userService.ensureProfileForAuthUser({
      uid: 'uid_fresh',
      email: 'fresh@college.edu',
      displayName: 'Fresh Student'
    });

    expect(profile?.id).toBe('uid_fresh');
    expect(profile?.role).toBe('student');
    expect(profile?.status).toBe('pending');
    expect(profile?.name).toBe('Fresh Student');
  });

  it('returns null for an identity without an email', async () => {
    const profile = await userService.ensureProfileForAuthUser({
      uid: 'uid_no_email',
      email: null,
      displayName: null
    });

    expect(profile).toBeNull();
    expect(fakeUsers.calls.createUserProfile).toBe(0);
  });

  it('creates exactly one profile when restores race each other', async () => {
    const identity = { uid: 'uid_race', email: 'race@college.edu', displayName: 'Racer' };

    const results = await Promise.all([
      userService.ensureProfileForAuthUser(identity),
      userService.ensureProfileForAuthUser(identity)
    ]);

    expect(results[0]?.id).toBe('uid_race');
    expect(results[1]?.id).toBe('uid_race');
    expect(fakeUsers.calls.createUserProfile).toBe(1);
  });
});

describe('userService directory', () => {
  it('merges fetched profiles with the ones this client already knows', async () => {
    await userService.createUserProfile({ id: 'uid_local', ...registration() });
    fakeUsers.seed([makeProfile({ id: 'uid_remote', email: 'remote@college.edu' })]);

    await userService.loadDirectory();

    expect(userService.store.get().status).toBe('ready');
    expect(userService.getUsers().map(u => u.id).sort()).toEqual(['uid_local', 'uid_remote']);
  });

  it('captures a failed directory read as a typed store status', async () => {
    fakeUsers.listUsers = () => Promise.reject(new Error('the network is down'));

    await userService.loadDirectory();

    expect(userService.store.get().status).toBe('error');
    expect(userService.store.get().error).toBe('Something went wrong. Please try again.');
    expect(userService.getUsers()).toEqual([]);
  });

  it('exposes the directory to React through a store hook', async () => {
    expect(typeof useUsersStore).toBe('function');
    await userService.createUserProfile({ id: 'uid_hook', ...registration() });
    expect(userService.getUsers()).toHaveLength(1);
  });
});

describe('userService.updateUserProfile', () => {
  it('persists an allow-listed patch and keeps the immutable fields', async () => {
    const owner = makeProfile({ id: 'uid_owner', email: 'owner@college.edu' });
    fakeUsers.seed([owner]);
    userService.setActor(owner);

    const updated = await userService.updateUserProfile('uid_owner', {
      name: 'Renamed Student',
      bio: 'New bio',
      section: 'C',
      skills: ['DSA']
    });

    expect(updated.name).toBe('Renamed Student');
    expect(updated.section).toBe('C');
    expect(updated.bio).toBe('New bio');
    expect(updated.id).toBe('uid_owner');
    expect(updated.email).toBe('owner@college.edu');
    expect(updated.role).toBe('student');
    expect(updated.status).toBe('approved');
    expect(userService.getById('uid_owner')?.name).toBe('Renamed Student');
    expect(userService.getById('uid_owner')?.status).toBe('approved');
  });

  it('rejects a payload that tries to escalate role or status', async () => {
    const escalation = {
      role: 'admin',
      status: 'approved',
      id: 'someone-else'
    } as unknown as EditableProfilePatch;

    await expect(userService.updateUserProfile('uid_owner', escalation)).rejects.toMatchObject({
      code: 'user/immutable-field',
      message: 'That profile field cannot be changed.'
    });
  });

  it('refuses to edit another account, or any account while signed out', async () => {
    const other = makeProfile({ id: 'uid_other', email: 'other@college.edu' });
    fakeUsers.seed([other]);
    userService.setActor(other);

    await expect(
      userService.updateUserProfile('uid_target', { name: 'Hijacked' })
    ).rejects.toMatchObject({ code: 'user/forbidden' });

    userService.setActor(null);

    await expect(
      userService.updateUserProfile('uid_other', { name: 'Hijacked' })
    ).rejects.toMatchObject({ code: 'user/forbidden', message: 'Sign in to edit your profile.' });
  });

  it('propagates adapter failures as typed service errors', async () => {
    const owner = makeProfile({ id: 'uid_gone' });
    userService.setActor(owner);
    // The document no longer exists in the backend.
    await expect(userService.updateUserProfile('uid_gone', { name: 'Ghost' })).rejects.toMatchObject(
      { code: 'user/not-found' }
    );
  });
});

describe('userService approval workflow', () => {
  const admin = () => makeProfile({ id: 'uid_admin', role: 'admin', status: 'approved' });

  it('rejects moderation from anyone who is not an administrator', async () => {
    const student = makeProfile({ id: 'uid_student', role: 'student', status: 'pending' });
    fakeUsers.seed([student]);
    userService.setActor(student);

    await expect(userService.approveUser('uid_student')).rejects.toMatchObject({
      code: 'user/forbidden',
      message: 'Only administrators can manage accounts.'
    });
    expect(fakeUsers.calls.approveUser).toBe(0);
    expect(fakeUsers.records().find(u => u.id === 'uid_student')?.status).toBe('pending');
  });

  it('rejects moderation while signed out', async () => {
    userService.setActor(null);

    await expect(userService.rejectUser('uid_anyone')).rejects.toMatchObject({
      code: 'user/forbidden'
    });
  });

  it('drives the full approve -> block -> unblock lifecycle', async () => {
    const pending = makeProfile({ id: 'uid_pending', email: 'pending@college.edu', status: 'pending' });
    fakeUsers.seed([pending]);
    userService.setActor(admin());

    const approved = await userService.approveUser('uid_pending');
    expect(approved.status).toBe('approved');
    expect(userService.getById('uid_pending')?.status).toBe('approved'); // store mirrors the write

    const blocked = await userService.blockUser('uid_pending');
    expect(blocked.status).toBe('blocked');

    const unblocked = await userService.unblockUser('uid_pending');
    expect(unblocked.status).toBe('approved');
    expect(userService.getById('uid_pending')?.status).toBe('approved');
  });

  it('keeps a rejected registration instead of deleting it', async () => {
    const pending = makeProfile({ id: 'uid_reject', email: 'reject@college.edu', status: 'pending' });
    fakeUsers.seed([pending]);
    userService.setActor(admin());

    const rejected = await userService.rejectUser('uid_reject');

    expect(rejected.status).toBe('rejected');
    expect(userService.getById('uid_reject')).toBeDefined();
    expect(userService.getUsers().map(u => u.id)).toContain('uid_reject');
  });

  it('serves the admin queue from the pending query and merges it in', async () => {
    fakeUsers.seed([
      makeProfile({ id: 'uid_p1', email: 'p1@college.edu', status: 'pending' }),
      makeProfile({ id: 'uid_a1', email: 'a1@college.edu', status: 'approved' })
    ]);

    const queue = await userService.listPendingUsers();

    expect(queue.map(u => u.id)).toEqual(['uid_p1']);
    expect(userService.getById('uid_p1')?.status).toBe('pending');
    expect(fakeUsers.calls.listPendingUsers).toBe(1);
  });
});

describe('userService has no demo personas', () => {
  it('exposes no persona-switching API', () => {
    expect(('ensure' + 'DevPersona') in userService).toBe(false);
    expect(('switch' + 'DevPersona') in userService).toBe(false);
  });

  it('starts with an empty directory instead of seeded demo profiles', () => {
    expect(userService.getUsers()).toEqual([]);
  });

  it('never reintroduces the legacy mock identities (user-1 … user-30)', () => {
    expect(userService.getUsers().filter(u => /^user-\d+$/.test(u.id))).toEqual([]);
  });
});

describe('persisted record mapping', () => {
  const record: UserRecord = {
    id: 'uid_map',
    email: 'map@college.edu',
    displayName: 'Ada Lovelace',
    username: undefined,
    role: 'student',
    status: 'approved',
    department: 'CSE',
    year: '2nd',
    batch: 'B',
    bio: undefined,
    photoURL: undefined,
    coverImage: undefined,
    skills: undefined,
    createdAt: null,
    updatedAt: null
  };

  it('converts platform field names into the vocabulary the app uses', () => {
    const user = toUser(record);

    expect(user.name).toBe('Ada Lovelace'); // displayName -> name
    expect(user.section).toBe('B'); // batch -> section
    expect(user.avatar).toBe(DEFAULT_AVATAR);
    expect(user.username).toBe(defaultUsername('uid_map')); // derived, never free text
    expect(user.skills).toEqual([]);
    expect(user.joinedDate).toBe('Just now');
  });

  it('starts every derived counter at zero', () => {
    const user = toUser(record);

    expect(user.reputation).toBe(0);
    expect(user.questionsCount).toBe(0);
    expect(user.answersCount).toBe(0);
    expect(user.acceptedCount).toBe(0);
    expect(user.followersCount).toBe(0);
    expect(user.followingCount).toBe(0);
  });

  it('formats a persisted timestamp for display', () => {
    const user = toUser({ ...record, createdAt: new Date('2024-01-15T10:00:00Z') });

    expect(user.joinedDate).toBe('15 Jan 2024');
  });
});
