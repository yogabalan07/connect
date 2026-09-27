import { describe, expect, it } from 'vitest';
import { toAuthSnapshot } from './AuthContext';
import type { AuthSessionState } from '../services/authService';
import type { User } from '../types';
import {
  resolveAdminAccess,
  resolveAppAccess,
  resolveGuestAccess,
  resolveStatusAccess
} from '../lib/routeAccess';

/**
 * Guard compatibility with the Firebase-backed AuthContext.
 *
 * The session produced by `onAuthStateChanged` (+ the profile keyed by the
 * UID) must feed the exact snapshot shape RequireAuth / RequireGuest /
 * StatusGate / RequireAdmin already consume.
 */
function makeProfile(overrides: Partial<User> = {}): User {
  return {
    id: 'uid_1',
    name: 'M2 Tester',
    username: 'm2_tester',
    email: 'm2@college.edu',
    avatar: '',
    department: 'CSE',
    year: '2nd',
    bio: '',
    skills: [],
    role: 'student',
    status: 'active',
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

const loadingSession: AuthSessionState = {
  isLoading: true,
  uid: null,
  source: null,
  emailVerified: false
};

const signedOutSession: AuthSessionState = { ...loadingSession, isLoading: false };

const signedInSession: AuthSessionState = {
  isLoading: false,
  uid: 'uid_1',
  source: 'firebase',
  emailVerified: false
};

describe('toAuthSnapshot', () => {
  it('stays in loading while Firebase resolves the persisted session', () => {
    const snapshot = toAuthSnapshot(loadingSession, null);

    expect(snapshot.isLoading).toBe(true);
    expect(resolveAppAccess(snapshot)).toEqual({ type: 'loading' });
    expect(resolveGuestAccess(snapshot)).toEqual({ type: 'loading' });
    expect(resolveStatusAccess(snapshot, 'pending')).toEqual({ type: 'loading' });
  });

  it('treats a resolved null user as signed out', () => {
    const snapshot = toAuthSnapshot(signedOutSession, null);

    expect(snapshot.isLoading).toBe(false);
    expect(snapshot.isAuthenticated).toBe(false);
    expect(snapshot.status).toBeNull();
    expect(resolveAppAccess(snapshot)).toEqual({ type: 'redirect', to: '/login' });
    expect(resolveGuestAccess(snapshot)).toEqual({ type: 'allow' });
    expect(resolveStatusAccess(snapshot, 'pending')).toEqual({ type: 'redirect', to: '/login' });
  });

  it('routes a newly registered (pending) user to the approval screen', () => {
    const snapshot = toAuthSnapshot(signedInSession, makeProfile({ status: 'pending' }));

    expect(snapshot.isAuthenticated).toBe(true);
    expect(snapshot.status).toBe('pending');
    expect(resolveAppAccess(snapshot)).toEqual({ type: 'redirect', to: '/pending-approval' });
    expect(resolveStatusAccess(snapshot, 'pending')).toEqual({ type: 'allow' });
    expect(resolveGuestAccess(snapshot)).toEqual({ type: 'allow' });
  });

  it('lets an active user into /app and into guest screens only when signed out', () => {
    const snapshot = toAuthSnapshot(signedInSession, makeProfile({ status: 'active' }));

    expect(resolveAppAccess(snapshot)).toEqual({ type: 'allow' });
    expect(resolveGuestAccess(snapshot)).toEqual({ type: 'redirect', to: '/app' });
    expect(resolveAdminAccess(snapshot)).toEqual({ type: 'redirect', to: '/forbidden' });
  });

  it('keeps admin routes behind the profile role', () => {
    const snapshot = toAuthSnapshot(
      signedInSession,
      makeProfile({ status: 'active', role: 'admin' })
    );

    expect(snapshot.role).toBe('admin');
    expect(resolveAdminAccess(snapshot)).toEqual({ type: 'allow' });
  });

  it('sends rejected and blocked profiles to their status screens', () => {
    expect(
      resolveStatusAccess(toAuthSnapshot(signedInSession, makeProfile({ status: 'rejected' })), 'rejected')
    ).toEqual({ type: 'allow' });
    expect(
      resolveStatusAccess(toAuthSnapshot(signedInSession, makeProfile({ status: 'blocked' })), 'blocked')
    ).toEqual({ type: 'allow' });
    expect(
      resolveAppAccess(toAuthSnapshot(signedInSession, makeProfile({ status: 'blocked' })))
    ).toEqual({ type: 'redirect', to: '/blocked' });
  });

  it('degrades safely when the profile is missing for an authenticated identity', () => {
    const snapshot = toAuthSnapshot(signedInSession, null);

    expect(snapshot.isAuthenticated).toBe(true);
    expect(snapshot.status).toBeNull();
    expect(snapshot.role).toBeNull();
    expect(resolveAppAccess(snapshot)).toEqual({ type: 'redirect', to: '/login' });
    expect(resolveGuestAccess(snapshot)).toEqual({ type: 'allow' });
  });

  it('feeds a DEV persona session through the same guard contract', () => {
    const snapshot = toAuthSnapshot(
      { ...signedInSession, source: 'dev' },
      makeProfile({ role: 'admin' })
    );

    expect(snapshot.isAuthenticated).toBe(true);
    expect(resolveAppAccess(snapshot)).toEqual({ type: 'allow' });
    expect(resolveAdminAccess(snapshot)).toEqual({ type: 'allow' });
  });
});
