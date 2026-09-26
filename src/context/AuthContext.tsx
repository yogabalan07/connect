import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { useStore } from '../lib/store';
import { authService, AuthResult, RegisterInput } from '../services/authService';
import { useUsersStore } from '../services/userService';
import { toastStore } from '../lib/toastStore';

export interface AuthContextValue {
  /** Signed-in profile, or null when nobody is signed in. */
  currentUser: User | null;
  isAuthenticated: boolean;
  /** True while the auth layer is restoring a session (Firebase-ready). */
  isLoading: boolean;
  status: UserStatus | null;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  /** DEV-ONLY persona switch (throws in production builds). */
  switchDevPersona: (role: UserRole) => User;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth provider. Role and status are always derived from the user record in
 * the user service — never from localStorage — so the future Firebase adapter
 * (Auth + custom claims) can replace the mock without changing consumers.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useStore(authService.sessionStore);
  const { users } = useUsersStore();

  const currentUser = useMemo(() => {
    if (!session.uid) return null;
    return users.find(u => u.id === session.uid) ?? null;
  }, [session.uid, users]);

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

  const switchDevPersona = useCallback((role: UserRole): User => {
    const persona = authService.switchDevPersona(role);
    toastStore.add(`DEV session switched to ${persona.name} (${persona.role}).`, 'info');
    return persona;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      isLoading: session.isLoading,
      status: currentUser ? currentUser.status : null,
      role: currentUser ? currentUser.role : null,
      login,
      register,
      logout,
      forgotPassword,
      switchDevPersona
    }),
    [currentUser, session.isLoading, login, register, logout, forgotPassword, switchDevPersona]
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
