import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { useStore } from '../lib/store';
import { authService, AuthResult, AuthSessionState, RegisterInput } from '../services/authService';
import { useUsersStore } from '../services/userService';
import { toastStore } from '../lib/toastStore';
import type { AuthSnapshot } from '../lib/routeAccess';

export interface AuthContextValue {
  /** Signed-in profile, or null when there is no profile yet. */
  currentUser: User | null;
  /** True whenever Firebase (or a DEV persona) says someone is signed in. */
  isAuthenticated: boolean;
  /** True while Firebase resolves the persisted session via onAuthStateChanged. */
  isLoading: boolean;
  /** Firebase email-verification flag for the signed-in identity. */
  emailVerified: boolean;
  status: UserStatus | null;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  /** Re-sends the Firebase verification email to the signed-in user. */
  sendVerification: () => Promise<{ ok: boolean; message: string }>;
  /** Reloads the Firebase identity (picks up a completed email verification). */
  refreshSession: () => Promise<{ ok: boolean; message: string }>;
  /** DEV-ONLY persona switch (throws in production builds). */
  switchDevPersona: (role: UserRole) => User;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Derives the routing snapshot the guards consume from the Firebase session +
 * the profile keyed by the UID. Kept pure so RequireAuth / RequireGuest /
 * StatusGate decisions stay unit-testable against real session states.
 *
 * - loading: Firebase has not answered `onAuthStateChanged` yet
 * - signed out: no uid
 * - authenticated: uid present, status/role come from the profile record
 * - missing profile: authenticated with `status: null` (guards fall back to
 *   the login screen instead of crashing)
 */
export function toAuthSnapshot(session: AuthSessionState, profile: User | null): AuthSnapshot {
  return {
    isLoading: session.isLoading,
    isAuthenticated: Boolean(session.uid),
    status: profile ? profile.status : null,
    role: profile ? profile.role : null
  };
}

/**
 * Auth provider backed by Firebase Authentication.
 *
 * `authService.start()` subscribes to `onAuthStateChanged`, so the persisted
 * Firebase session is restored before the guards make any decision. Role and
 * status always come from the user record keyed by the Firebase UID — they are
 * application profile data, never credentials.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useStore(authService.sessionStore);
  const { users } = useUsersStore();

  useEffect(() => {
    authService.start();
  }, []);

  // A profile that cannot be resolved (read failure, or an identity without
  // a usable `users/{uid}` document) is reported once instead of silently
  // bouncing the user between routes.
  useEffect(() => {
    if (!session.profileError) return;
    toastStore.add(session.profileError, 'error');
  }, [session.profileError]);

  const currentUser = useMemo(() => {
    if (!session.uid) return null;
    return users.find(u => u.id === session.uid) ?? null;
  }, [session.uid, users]);

  const snapshot = useMemo(() => toAuthSnapshot(session, currentUser), [session, currentUser]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await authService.signIn(email, password);
    if (result.ok) toastStore.add(`Welcome back, ${result.data.name}!`, 'success');
    return result;
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<AuthResult> => {
    const result = await authService.register(input);
    if (result.ok) {
      toastStore.add('Registration submitted! Awaiting department verification.', 'info');
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    authService.signOut();
    toastStore.add('You have been safely logged out.', 'info');
  }, []);

  const forgotPassword = useCallback(
    async (email: string): Promise<{ ok: boolean; message: string }> => {
      const result = await authService.requestPasswordReset(email);
      return result.ok ? { ok: true, message: result.data } : { ok: false, message: result.message };
    },
    []
  );

  const sendVerification = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const result = await authService.requestEmailVerification();
    return result.ok ? { ok: true, message: result.data } : { ok: false, message: result.message };
  }, []);

  const refreshSession = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const result = await authService.refreshSession();
    if (result.ok) return { ok: true, message: 'Email verification status refreshed.' };
    return { ok: false, message: result.message };
  }, []);

  const switchDevPersona = useCallback((role: UserRole): User => {
    const persona = authService.switchDevPersona(role);
    toastStore.add(`DEV session switched to ${persona.name} (${persona.role}).`, 'info');
    return persona;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated: snapshot.isAuthenticated,
      isLoading: snapshot.isLoading,
      emailVerified: session.emailVerified,
      status: snapshot.status,
      role: snapshot.role,
      login,
      register,
      logout,
      forgotPassword,
      sendVerification,
      refreshSession,
      switchDevPersona
    }),
    [
      currentUser,
      snapshot,
      session.emailVerified,
      login,
      register,
      logout,
      forgotPassword,
      sendVerification,
      refreshSession,
      switchDevPersona
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
