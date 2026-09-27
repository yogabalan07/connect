import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { authService } from './authService';
import type { RegisterInput } from './authService';
import { userService, resetUserDirectoryForTests } from './userService';
import type { AuthAdapter, AuthStateListener, AuthUser } from './authAdapter';
import { setUserAdapter } from './userAdapter';
import { createFakeUserAdapter } from './testing/fakeUserAdapter';
import type { FakeUserAdapter } from './testing/fakeUserAdapter';
import type { User } from '../types';
import { ServiceError } from '../lib/errors';

/**
 * Drains the promise queue so fire-and-forget profile restores finish.
 * Profile reads resolve from the in-memory adapter, so one macrotask is
 * enough to run every pending microtask.
 */
const flush = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

/**
 * Assembles the names of the artifacts this milestone removed (the persona
 * switcher, demo identity helpers, the placeholder API key, …).
 *
 * The parts are joined at run time on purpose: a plain-text search of the
 * application source and of the built `dist/` for those artifacts must return
 * zero hits, because the only place they may still appear is this assertion
 * that they are gone.
 */
const removed = (...parts: string[]): string => parts.join('');

/**
 * Deterministic Firebase Auth double.
 *
 * It reproduces the Firebase contract the service layer relies on:
 * - `subscribe` behaves like `onAuthStateChanged` (current state first),
 * - failures are rejected with `{ code: 'auth/...' }` exactly like the SDK,
 * - the password is only ever compared, never returned or persisted.
 */
let uidSequence = 0;

interface FakeAccount {
  password: string;
  user: AuthUser;
}

class FakeAuthAdapter implements AuthAdapter {
  accounts = new Map<string, FakeAccount>();
  current: AuthUser | null = null;
  resetEmails: string[] = [];
  verificationEmails = 0;

  private listeners = new Set<AuthStateListener>();
  private readonly emitOnSubscribe: boolean;

  constructor(options: { emitOnSubscribe?: boolean } = {}) {
    this.emitOnSubscribe = options.emitOnSubscribe ?? true;
  }

  seed(email: string, password: string): AuthUser {
    uidSequence += 1;
    const user: AuthUser = {
      uid: `uid_${uidSequence}`,
      email,
      displayName: null,
      emailVerified: false
    };
    this.accounts.set(email, { password, user });
    return user;
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    if (this.emitOnSubscribe) listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Fires `onAuthStateChanged` for every subscriber. */
  setUser(user: AuthUser | null): void {
    this.current = user;
    this.listeners.forEach(listener => listener(user));
  }

  /** Simulates the user opening the verification link in their inbox. */
  markEmailVerified(): void {
    if (!this.current) return;
    for (const account of this.accounts.values()) {
      if (account.user.uid === this.current.uid) {
        account.user = { ...account.user, emailVerified: true };
        this.setUser({ ...account.user });
        return;
      }
    }
    this.setUser({ ...this.current, emailVerified: true });
  }

  getCurrentUser(): AuthUser | null {
    return this.current;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const account = this.accounts.get(email);
    if (!account) throw { code: 'auth/user-not-found' };
    if (account.password !== password) throw { code: 'auth/wrong-password' };
    const user = { ...account.user };
    this.setUser(user);
    return user;
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    if (!email.includes('@')) throw { code: 'auth/invalid-email' };
    if (password.length < 6) throw { code: 'auth/weak-password' };
    if (this.accounts.has(email)) throw { code: 'auth/email-already-in-use' };
    const user = this.seed(email, password);
    this.setUser({ ...user });
    return { ...user };
  }

  async signOut(): Promise<void> {
    this.setUser(null);
  }

  async sendPasswordReset(email: string): Promise<void> {
    if (!this.accounts.has(email)) throw { code: 'auth/user-not-found' };
    this.resetEmails.push(email);
  }

  async sendEmailVerification(): Promise<void> {
    if (!this.current) throw { code: 'auth/no-current-user' };
    this.verificationEmails += 1;
  }

  async reloadUser(): Promise<AuthUser> {
    if (!this.current) throw { code: 'auth/no-current-user' };
    return { ...this.current };
  }
}

const randomEmail = () => `m2_${Math.random().toString(36).slice(2, 10)}@college.edu`;

const baseRegistration = {
  name: 'Milestone Two Tester',
  password: 'correct horse battery',
  department: 'CSE' as const,
  year: '2nd' as const,
  skills: ['React', 'Data Structures']
};

const makeRegistration = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ...baseRegistration,
  email: randomEmail(),
  ...overrides
});

/** A stored `users/{uid}` document exactly as Firestore holds it. */
const storedProfile = (uid: string, overrides: Partial<User> = {}): User => ({
  id: uid,
  name: 'Department Administrator',
  username: 'department_admin',
  email: 'admin@college.edu',
  avatar: '',
  department: 'CSE',
  year: '2nd',
  section: 'A',
  bio: '',
  skills: [],
  role: 'admin',
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
});

let fake: FakeAuthAdapter;
let fakeUsers: FakeUserAdapter;

beforeEach(() => {
  // Fresh profile backend + directory per test: the domain layer must run
  // hermetically, without a Firebase project and without `.env.local`.
  resetUserDirectoryForTests();
  fakeUsers = createFakeUserAdapter();
  setUserAdapter(fakeUsers);

  fake = new FakeAuthAdapter();
  authService.setAuthAdapter(fake);
});

afterEach(() => {
  setUserAdapter(null);
});

describe('authService.register', () => {
  it('creates a pending account and signs the user in', async () => {
    const input = makeRegistration();
    const result = await authService.register(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.email).toBe(input.email);
    expect(result.data.status).toBe('pending');
    expect(result.data.role).toBe('student');
    expect(result.data.id).toBe(authService.getSessionUid());
    expect(authService.getCurrentUser()?.id).toBe(result.data.id);
    expect(authService.isLoading()).toBe(false);
  });

  it('uses the Firebase UID as the canonical identity', async () => {
    const result = await authService.register(makeRegistration());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.id).toBe(fake.current?.uid);
    expect(fake.current?.uid).toBe(authService.getSessionUid());
  });

  it('never lets the client register itself as admin or active', async () => {
    // A hostile client can put anything in the payload: role/status must still
    // come from the server-side policy, and the id must be the Firebase UID.
    const malicious = {
      ...makeRegistration(),
      role: 'admin',
      status: 'approved',
      id: 'i-am-admin'
    } as unknown as RegisterInput;

    const result = await authService.register(malicious);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.role).toBe('student');
    expect(result.data.status).toBe('pending');
    expect(result.data.id).toBe(fake.current?.uid);
    expect(result.data.id).not.toBe('i-am-admin');
  });

  it('sends the Firebase verification email', async () => {
    const result = await authService.register(makeRegistration());
    expect(result.ok).toBe(true);
    expect(fake.verificationEmails).toBe(1);
    expect(authService.sessionStore.get().emailVerified).toBe(false);
  });

  it('rejects weak passwords', async () => {
    const result = await authService.register(makeRegistration({ password: 'abc' }));
    expect(result.ok).toBe(false);
    expect(fake.accounts.size).toBe(0);
  });

  it('rejects duplicate emails without touching the session', async () => {
    const input = makeRegistration();
    const first = await authService.register(input);
    expect(first.ok).toBe(true);

    authService.signOut();
    const second = await authService.register(input);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).toBe('An account with this college email already exists.');
    expect(authService.getSessionUid()).toBeNull();
  });

  it('surfaces the mapped Firebase duplicate-email error', async () => {
    // Email exists in Firebase Auth but not in the local directory, so the
    // rejection has to come from `auth/email-already-in-use`.
    fake.seed('already@college.edu', 'password123');

    const result = await authService.register(makeRegistration({ email: 'already@college.edu' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('An account with this college email already exists.');
    expect(authService.getSessionUid()).toBeNull();
  });

  it('requires a name and a valid email', async () => {
    expect((await authService.register(makeRegistration({ name: '   ' }))).ok).toBe(false);
    expect((await authService.register(makeRegistration({ email: 'not-an-email' }))).ok).toBe(false);
  });
});

describe('authService.signIn', () => {
  it('accepts the registered credentials', async () => {
    const input = makeRegistration();
    const registered = await authService.register(input);
    expect(registered.ok).toBe(true);
    authService.signOut();

    const result = await authService.signIn(input.email, input.password);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(registered.ok ? registered.data.id : '');
    expect(authService.getSessionUid()).toBe(result.data.id);
  });

  it('rejects the wrong password', async () => {
    const input = makeRegistration();
    await authService.register(input);
    authService.signOut();

    const result = await authService.signIn(input.email, 'wrong password');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Email or password is incorrect.');
    expect(authService.getSessionUid()).toBeNull();
  });

  it('rejects unknown emails with the same generic message', async () => {
    const result = await authService.signIn('nobody@college.edu', 'whatever');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Email or password is incorrect.');
  });

  it('requires both fields', async () => {
    expect((await authService.signIn('', '')).ok).toBe(false);
    expect((await authService.signIn('student@college.edu', '')).ok).toBe(false);
  });

  it('provisions a pending profile for an identity that has none', async () => {
    fake.seed('orphan@college.edu', 'secret123');

    const result = await authService.signIn('orphan@college.edu', 'secret123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const profile = authService.getCurrentUser();
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(fake.current?.uid);
    expect(profile?.status).toBe('pending');
    expect(profile?.role).toBe('student');
  });

  it('handles an authenticated identity without a usable profile gracefully', async () => {
    fake.setUser({ uid: 'uid_without_email', email: null, displayName: null, emailVerified: false });

    expect(authService.getSessionUid()).toBe('uid_without_email');
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('restores an approved admin profile without recreating or downgrading it', async () => {
    const identity = fake.seed('admin@college.edu', 'correct horse battery');
    fakeUsers.seed([storedProfile(identity.uid)]);

    const result = await authService.signIn('admin@college.edu', 'correct horse battery');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const profile = authService.getCurrentUser();
    expect(profile?.id).toBe(identity.uid);
    expect(profile?.role).toBe('admin');
    expect(profile?.status).toBe('approved');
    // The document already existed: auth restoration must never write to it,
    // otherwise a login could silently reset an admin to student/pending.
    expect(fakeUsers.calls.createUserProfile).toBe(0);
    expect(fakeUsers.calls.updateUserProfile).toBe(0);
  });

  it('fails the session closed when Firestore rules deny the profile read', async () => {
    fake.seed('denied@college.edu', 'correct horse battery');
    fakeUsers.getUserProfile = async () => {
      throw { code: 'permission-denied' };
    };

    const result = await authService.signIn('denied@college.edu', 'correct horse battery');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(
      'You do not have permission to do that. Contact your department administrator.'
    );
    expect(authService.getSessionUid()).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
    expect(authService.isLoading()).toBe(false);
  });

  it('reports a missing profile differently from a rules denial', async () => {
    fake.seed('no_profile@college.edu', 'correct horse battery');
    fakeUsers.getUserProfile = async () => null;
    fakeUsers.createUserProfile = async () => {
      throw new ServiceError('user/id-taken', 'That account already exists.');
    };

    const result = await authService.signIn('no_profile@college.edu', 'correct horse battery');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(
      'Your account profile could not be loaded. Contact your department administrator.'
    );
    expect(result.message).not.toContain('permission');
  });
});

describe('authService.signOut', () => {
  it('clears the session', async () => {
    await authService.register(makeRegistration());
    expect(authService.getSessionUid()).not.toBeNull();

    authService.signOut();
    expect(authService.getSessionUid()).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
    expect(authService.isLoading()).toBe(false);
    await Promise.resolve();
    expect(fake.current).toBeNull();
  });
});

describe('authService.requestPasswordReset', () => {
  it('rejects malformed emails', async () => {
    const result = await authService.requestPasswordReset('not-an-email');
    expect(result.ok).toBe(false);
  });

  it('sends a real reset email through the adapter', async () => {
    const input = makeRegistration();
    await authService.register(input);
    authService.signOut();

    const result = await authService.requestPasswordReset(input.email);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain('password reset instructions have been sent');
    expect(fake.resetEmails).toContain(input.email);
  });

  it('answers an unknown account exactly like a known one', async () => {
    const email = randomEmail();
    const result = await authService.requestPasswordReset(email);

    // Anti-enumeration: the caller cannot tell the two outcomes apart.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain('password reset instructions have been sent');
    expect(result.data).toContain(email);
    expect(result.data).not.toContain('No account exists');
    expect(fake.resetEmails).toHaveLength(0);
  });
});

describe('email verification', () => {
  it('re-sends the verification email for the signed-in identity', async () => {
    const registered = await authService.register(makeRegistration());
    expect(registered.ok).toBe(true);
    expect(fake.verificationEmails).toBe(1);

    const result = await authService.requestEmailVerification();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain('verification link was sent to');
    expect(fake.verificationEmails).toBe(2);
  });

  it('refuses to send while signed out', async () => {
    const result = await authService.requestEmailVerification();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Sign in to verify your college email address.');
    expect(fake.verificationEmails).toBe(0);
  });

  it('picks up a completed verification after a refresh', async () => {
    await authService.register(makeRegistration());
    expect(authService.sessionStore.get().emailVerified).toBe(false);

    fake.markEmailVerified();
    expect(authService.sessionStore.get().emailVerified).toBe(true);

    const result = await authService.refreshSession();
    expect(result.ok).toBe(true);
    expect(authService.sessionStore.get().emailVerified).toBe(true);
  });

  it('fails cleanly when there is no signed-in identity to reload', async () => {
    const result = await authService.refreshSession();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Sign in to continue.');
  });
});

describe('auth session state', () => {
  it('starts in loading until Firebase answers onAuthStateChanged', () => {
    const deferred = new FakeAuthAdapter({ emitOnSubscribe: false });
    authService.setAuthAdapter(deferred);

    expect(authService.isLoading()).toBe(true);
    expect(authService.getSessionUid()).toBeNull();

    deferred.setUser(null);
    expect(authService.isLoading()).toBe(false);
    expect(authService.getSessionUid()).toBeNull();
  });

  it('restores a persisted Firebase session on startup', async () => {
    const persisted = fake.seed('restored@college.edu', 'secret123');
    fake.setUser(persisted); // signed in before the app booted
    authService.setAuthAdapter(fake); // onAuthStateChanged replays the user

    expect(authService.isLoading()).toBe(false);
    expect(authService.getSessionUid()).toBe(persisted.uid);

    // The session settles synchronously; the profile behind it is restored
    // from the profile backend right afterwards.
    await flush();

    const profile = authService.getCurrentUser();
    expect(profile?.id).toBe(persisted.uid);
    expect(profile?.status).toBe('pending');
  });

  it('reports a clean signed-out state when there is no persisted session', () => {
    expect(authService.isLoading()).toBe(false);
    expect(authService.getSessionUid()).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
    expect(authService.sessionStore.get().source).toBeNull();
  });
});

describe('no dev persona, no demo identity', () => {
  it('exposes no persona-switching API on the auth service', () => {
    expect(removed('switch', 'DevPersona') in authService).toBe(false);
    expect(removed('credentials', 'Store') in authService).toBe(false);
  });

  it('keeps every production source file free of mock/demo auth artifacts', () => {
    const forbidden = [
      removed('switch', 'DevPersona'),
      removed('ensure', 'DevPersona'),
      removed('Role', 'Switcher'),
      removed('credentials', 'Store'),
      removed('current', 'UserMock'),
      removed('YOUR_FIREBASE_', 'API_KEY'),
      removed('mock', ' password'),
      removed('fake ', 'credentials'),
      removed('demo ', 'user'),
      removed('mock', 'Users'),
      removed('mock', 'Doubts'),
      removed('mock', 'Answers'),
      removed('mock', 'Notifications'),
      removed('mock', 'Messages'),
      removed('mock', 'AdminData')
    ];
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (/\.test\.tsx?$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, 'utf8').toLowerCase();
        const hit = forbidden.find(value => content.includes(value.toLowerCase()));
        if (hit) offenders.push(`${path.relative(process.cwd(), full)} -> ${hit}`);
      }
    };

    walk(path.resolve(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('no plaintext passwords', () => {
  it('keeps the password out of the session, the profile and storage', async () => {
    const input = makeRegistration();
    await authService.register(input);
    await authService.signIn(input.email, input.password);

    expect(JSON.stringify(authService.sessionStore.get())).not.toContain(input.password);
    expect(JSON.stringify(authService.getCurrentUser())).not.toContain(input.password);
    expect(JSON.stringify(userService.getUsers())).not.toContain(input.password);
  });

  it('has no credential store or storage writes left in the auth service', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/authService.ts'), 'utf8');
    expect(source).not.toContain(removed('credentials', 'Store'));
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('digest(');
    expect(removed('credentials', 'Store') in authService).toBe(false);
  });

  it('never writes a password to web storage anywhere in the app source', () => {
    const root = path.resolve(process.cwd(), 'src');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.test.ts')) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/set(Item|State)\([^)]*password/i.test(content) || /password[^=]*=\s*localStorage/.test(content)) {
          offenders.push(full);
        }
      }
    };

    walk(root);
    expect(offenders).toEqual([]);
  });
});
