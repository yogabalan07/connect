import { describe, expect, it } from 'vitest';
import {
  AuthSnapshot,
  resolveAdminAccess,
  resolveAppAccess,
  resolveForbiddenAccess,
  resolveGuestAccess,
  resolveStatusAccess
} from './routeAccess';

const loading: AuthSnapshot = { isLoading: true, isAuthenticated: false, status: null, role: null };
const signedOut: AuthSnapshot = { isLoading: false, isAuthenticated: false, status: null, role: null };
const pendingStudent: AuthSnapshot = {
  isLoading: false,
  isAuthenticated: true,
  status: 'pending',
  role: 'student'
};
const rejectedStudent: AuthSnapshot = {
  isLoading: false,
  isAuthenticated: true,
  status: 'rejected',
  role: 'student'
};
const blockedStudent: AuthSnapshot = {
  isLoading: false,
  isAuthenticated: true,
  status: 'blocked',
  role: 'student'
};
const activeStudent: AuthSnapshot = {
  isLoading: false,
  isAuthenticated: true,
  status: 'active',
  role: 'student'
};
const activeAdmin: AuthSnapshot = {
  isLoading: false,
  isAuthenticated: true,
  status: 'active',
  role: 'admin'
};

describe('resolveAppAccess (/app/*)', () => {
  it('waits while the session is loading', () => {
    expect(resolveAppAccess(loading)).toEqual({ type: 'loading' });
  });

  it('sends anonymous users to /login', () => {
    expect(resolveAppAccess(signedOut)).toEqual({ type: 'redirect', to: '/login' });
  });

  it('routes each non-active status to its status page', () => {
    expect(resolveAppAccess(pendingStudent)).toEqual({
      type: 'redirect',
      to: '/pending-approval'
    });
    expect(resolveAppAccess(rejectedStudent)).toEqual({ type: 'redirect', to: '/rejected' });
    expect(resolveAppAccess(blockedStudent)).toEqual({ type: 'redirect', to: '/blocked' });
  });

  it('allows active users', () => {
    expect(resolveAppAccess(activeStudent)).toEqual({ type: 'allow' });
  });
});

describe('resolveAdminAccess (/admin/*)', () => {
  it('sends non-admins to /forbidden', () => {
    expect(resolveAdminAccess(activeStudent)).toEqual({ type: 'redirect', to: '/forbidden' });
  });

  it('allows active admins', () => {
    expect(resolveAdminAccess(activeAdmin)).toEqual({ type: 'allow' });
  });

  it('keeps status gating ahead of role gating', () => {
    const pendingAdmin: AuthSnapshot = { ...pendingStudent, role: 'admin' };
    expect(resolveAdminAccess(pendingAdmin)).toEqual({
      type: 'redirect',
      to: '/pending-approval'
    });
  });
});

describe('resolveGuestAccess (/login, /register, /forgot-password)', () => {
  it('lets anonymous visitors in', () => {
    expect(resolveGuestAccess(signedOut)).toEqual({ type: 'allow' });
  });

  it('bounces signed-in active users back to /app', () => {
    expect(resolveGuestAccess(activeStudent)).toEqual({ type: 'redirect', to: '/app' });
  });

  it('lets pending users reach the status pages', () => {
    expect(resolveGuestAccess(pendingStudent)).toEqual({ type: 'allow' });
  });
});

describe('resolveStatusAccess (/pending-approval, /rejected, /blocked)', () => {
  it('allows the user whose status matches the page', () => {
    expect(resolveStatusAccess(pendingStudent, 'pending')).toEqual({ type: 'allow' });
    expect(resolveStatusAccess(rejectedStudent, 'rejected')).toEqual({ type: 'allow' });
    expect(resolveStatusAccess(blockedStudent, 'blocked')).toEqual({ type: 'allow' });
  });

  it('sends active users to /app', () => {
    expect(resolveStatusAccess(activeStudent, 'pending')).toEqual({
      type: 'redirect',
      to: '/app'
    });
  });

  it('sends anonymous users to /login', () => {
    expect(resolveStatusAccess(signedOut, 'pending')).toEqual({
      type: 'redirect',
      to: '/login'
    });
  });

  it('sends a user to their own status page when it differs', () => {
    expect(resolveStatusAccess(rejectedStudent, 'pending')).toEqual({
      type: 'redirect',
      to: '/rejected'
    });
  });
});

describe('resolveForbiddenAccess (/forbidden)', () => {
  it('sends anonymous users to /login instead of the denial page', () => {
    expect(resolveForbiddenAccess(signedOut)).toEqual({ type: 'redirect', to: '/login' });
  });

  it('allows any active signed-in user to read the denial', () => {
    expect(resolveForbiddenAccess(activeStudent)).toEqual({ type: 'allow' });
  });
});
