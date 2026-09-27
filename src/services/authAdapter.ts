import { firebaseAuthAdapter } from './firebaseAuthAdapter';

/** Normalized Firebase identity — the canonical id of an authenticated user. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export type AuthStateListener = (user: AuthUser | null) => void;

/**
 * Authentication backend contract.
 *
 * `firebaseAuthAdapter` is the only production implementation; the service
 * layer talks to this interface so tests (and a future emulator setup) can
 * substitute a deterministic double without touching pages, context or routes.
 *
 * Passwords only ever travel through these methods — nothing in this layer
 * persists them, and no other layer ever sees one.
 */
export interface AuthAdapter {
  /**
   * Subscribes to auth state changes (Firebase: `onAuthStateChanged`).
   * The listener receives the current user, or `null` when signed out.
   * Returns an unsubscribe function.
   */
  subscribe(listener: AuthStateListener): () => void;
  /** The identity Firebase currently considers signed in, if any. */
  getCurrentUser(): AuthUser | null;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  sendEmailVerification(): Promise<void>;
  /** Re-reads the current identity (used to refresh `emailVerified`). */
  reloadUser(): Promise<AuthUser>;
}

let overrideAdapter: AuthAdapter | null = null;
let defaultAdapter: AuthAdapter | null = null;

/** The adapter the app runs against: the Firebase adapter unless overridden. */
export function getAuthAdapter(): AuthAdapter {
  if (overrideAdapter) return overrideAdapter;
  if (!defaultAdapter) defaultAdapter = firebaseAuthAdapter;
  return defaultAdapter;
}

/**
 * Injection seam for tests and local tooling. Production code paths always
 * resolve to the Firebase adapter (`setAuthAdapter(null)` restores it).
 */
export function setAuthAdapter(adapter: AuthAdapter | null): void {
  overrideAdapter = adapter;
}
