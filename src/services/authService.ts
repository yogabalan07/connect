import { AcademicYear, Department, User, UserRole } from '../types';
import { createStore, useStore } from '../lib/store';
import { ServiceError, ServiceResult, fail, ok } from '../lib/errors';
import { userService } from './userService';
import { AuthAdapter, AuthUser, getAuthAdapter, setAuthAdapter as setBackendAdapter } from './authAdapter';
import { mapAuthError } from './authErrors';

/**
 * Authentication domain service (Firebase Authentication).
 *
 * Layering: UI -> context/hooks -> THIS file -> auth adapter -> Firebase SDK.
 *
 * Guarantees:
 * - The Firebase Auth UID is the canonical identity; `sessionStore.uid` always
 *   mirrors `onAuthStateChanged` (or a DEV-only local persona).
 * - Passwords are handed straight to the adapter and never stored, logged or
 *   written to any store, browser storage or profile document.
 * - Role/status are application profile data (defaults: student / pending) and
 *   are always read from the user record, never from the credential layer.
 * - Every SDK failure leaves as a `ServiceError` with its original
 *   `auth/...` code, mapped to campus-friendly copy by `authErrors`.
 */
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  department: Department;
  year: AcademicYear;
  section?: string;
  skills: string[];
}

export type AuthResult = ServiceResult<User>;

export interface AuthSessionState {
  /** True until Firebase answers its first `onAuthStateChanged` callback. */
  isLoading: boolean;
  uid: string | null;
  /** `firebase` for real sessions, `dev` for the local persona helper. */
  source: 'firebase' | 'dev' | null;
  emailVerified: boolean;
}

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_SESSION: AuthSessionState = {
  isLoading: true,
  uid: null,
  source: null,
  emailVerified: false
};

const sessionStore = createStore<AuthSessionState>({ ...INITIAL_SESSION });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * DEV builds only. `import.meta.env.DEV` is statically replaced with `false`
 * by the production bundler, so persona switching cannot exist in production;
 * this check is the runtime backstop for anyone calling the API directly.
 */
function isDevBuild(): boolean {
  const env = import.meta.env as Record<string, unknown>;
  const dev = env.DEV;
  if (dev === true || dev === 'true') return true;
  if (dev === false || dev === 'false') return false;
  return env.MODE !== 'production';
}

function assertDevBuild(): void {
  if (!isDevBuild()) {
    throw new ServiceError(
      'auth/dev-only',
      'Development personas are only available while running `npm run dev`.'
    );
  }
}

/** Ensures the directory has a profile for a Firebase identity (uid = id). */
function provisionProfile(user: AuthUser): User | null {
  return userService.ensureProfileForAuthUser({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  });
}

function applyFirebaseUser(user: AuthUser): void {
  provisionProfile(user);
  sessionStore.set({
    isLoading: false,
    uid: user.uid,
    source: 'firebase',
    emailVerified: user.emailVerified
  });
}

/** Single consumer of `onAuthStateChanged`. */
function handleAuthState(user: AuthUser | null): void {
  if (user) {
    applyFirebaseUser(user);
    return;
  }

  const current = sessionStore.get();
  if (current.source === 'dev') {
    // A local DEV persona is not a Firebase session: keep it until signed out.
    if (current.isLoading) sessionStore.set({ ...current, isLoading: false });
    return;
  }

  sessionStore.set({ ...INITIAL_SESSION, isLoading: false });
}

let boundAdapter: AuthAdapter | null = null;
let unsubscribeAdapter: (() => void) | null = null;

function bindAdapter(adapter: AuthAdapter): void {
  unsubscribeAdapter?.();
  boundAdapter = adapter;
  sessionStore.set({ ...INITIAL_SESSION });
  unsubscribeAdapter = adapter.subscribe(handleAuthState);
}

function ensureListening(): void {
  if (boundAdapter) return;
  bindAdapter(getAuthAdapter());
}

/** The adapter every operation runs against (binds the default one lazily). */
function currentAdapter(): AuthAdapter {
  ensureListening();
  if (!boundAdapter) {
    throw new ServiceError('auth/not-initialized', 'Authentication is not available right now.');
  }
  return boundAdapter;
}

function toFail(error: unknown): ServiceResult<never> {
  return fail(mapAuthError(error).message);
}

export const authService = {
  sessionStore,

  /** Starts the `onAuthStateChanged` subscription (idempotent). */
  start(): void {
    ensureListening();
  },

  /**
   * Test/emulator seam: swap the auth backend and re-bind the session
   * listener. Production always runs the Firebase adapter.
   */
  setAuthAdapter(adapter: AuthAdapter): void {
    setBackendAdapter(adapter);
    bindAdapter(adapter);
  },

  isLoading(): boolean {
    return sessionStore.get().isLoading;
  },

  getSessionUid(): string | null {
    return sessionStore.get().uid;
  },

  /** Resolves the signed-in profile, or null when there is no profile yet. */
  getCurrentUser(): User | null {
    const uid = sessionStore.get().uid;
    return uid ? userService.getById(uid) ?? null : null;
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    const normalized = normalizeEmail(email);
    if (!normalized || !EMAIL_PATTERN.test(normalized) || !password) {
      return fail('Enter your college email and password.');
    }

    ensureListening();
    try {
      const authUser = await currentAdapter().signIn(normalized, password);
      const profile = provisionProfile(authUser) ?? userService.getById(authUser.uid);
      if (!profile) {
        // Authenticated but unusable: leave the client signed out instead of
        // stranding the user in a session no guard can render.
        await currentAdapter()
          .signOut()
          .catch(() => undefined);
        sessionStore.set({ ...INITIAL_SESSION, isLoading: false });
        return fail('Your account profile could not be loaded. Contact your department administrator.');
      }
      applyFirebaseUser(authUser);
      return ok(profile);
    } catch (error) {
      return toFail(error);
    }
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();

    if (!name) return fail('Enter your full name.');
    if (!email || !EMAIL_PATTERN.test(email)) return fail('Enter a valid college email address.');
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    // Fast-fail for emails the directory already owns (no orphaned auth user).
    if (userService.emailExists(email)) {
      return fail('An account with this college email already exists.');
    }

    ensureListening();
    try {
      const authUser = await currentAdapter().signUp(email, input.password);

      let profile: User;
      try {
        // `onAuthStateChanged` may already have provisioned a provisional
        // profile for this brand-new UID: upsert instead of failing.
        profile = userService.getById(authUser.uid)
          ? userService.updateProfile(authUser.uid, {
              name,
              department: input.department,
              year: input.year,
              skills: input.skills,
              ...(input.section ? { section: input.section } : {})
            })
          : userService.createPendingUser({
              id: authUser.uid, // Firebase UID = canonical identity
              name,
              email,
              department: input.department,
              year: input.year,
              section: input.section,
              skills: input.skills
            });
      } catch (error) {
        // Never leave an auth account without a matching profile.
        await currentAdapter()
          .signOut()
          .catch(() => undefined);
        sessionStore.set({ ...INITIAL_SESSION, isLoading: false });
        return toFail(error);
      }

      // Verification email is best-effort: the account already exists.
      await currentAdapter()
        .sendEmailVerification()
        .catch(() => undefined);

      applyFirebaseUser(authUser);
      return ok(profile);
    } catch (error) {
      return toFail(error);
    }
  },

  /** Signs out immediately on the client; Firebase clears its own session. */
  signOut(): void {
    const source = sessionStore.get().source;
    sessionStore.set({ ...INITIAL_SESSION, isLoading: false });

    if (source === 'dev') return; // local persona, nothing to revoke remotely

    ensureListening();
    void boundAdapter?.signOut().catch(() => undefined);
  },

  /**
   * Sends a password reset link.
   *
   * The reply is byte-identical whether or not the address has an account:
   * `auth/user-not-found` is swallowed and answered with the same generic
   * confirmation, so the form can never be used to enumerate registered
   * college emails.
   */
  async requestPasswordReset(email: string): Promise<ServiceResult<string>> {
    const normalized = normalizeEmail(email);
    if (!normalized || !EMAIL_PATTERN.test(normalized)) {
      return fail('Enter a valid college email address.');
    }

    const confirmation =
      `If an account exists for ${normalized}, password reset instructions ` +
      'have been sent. Check your inbox and spam folder.';

    ensureListening();
    try {
      await currentAdapter().sendPasswordReset(normalized);
      return ok(confirmation);
    } catch (error) {
      const mapped = mapAuthError(error);
      if (mapped.code === 'auth/user-not-found') {
        return ok(confirmation);
      }
      return fail(mapped.message);
    }
  },

  /** Sends (or re-sends) the verification email for the signed-in identity. */
  async requestEmailVerification(): Promise<ServiceResult<string>> {
    ensureListening();
    try {
      const current = currentAdapter().getCurrentUser();
      if (!current) return fail('Sign in to verify your college email address.');
      await currentAdapter().sendEmailVerification();
      return ok(
        `A verification link was sent to ${current.email ?? 'your college email'}. Open it to complete verification.`
      );
    } catch (error) {
      return toFail(error);
    }
  },

  /** Reloads the Firebase identity (refreshes `emailVerified` after a click). */
  async refreshSession(): Promise<ServiceResult<User | null>> {
    ensureListening();
    try {
      const authUser = await currentAdapter().reloadUser();
      applyFirebaseUser(authUser);
      return ok(userService.getById(authUser.uid) ?? null);
    } catch (error) {
      return toFail(error);
    }
  },

  /**
   * DEV-ONLY persona switch used by `components/ui/RoleSwitcher` and the dev
   * shortcuts on the auth screens. It writes a local `dev` session only — no
   * password, no Firebase user, no storage — and throws outside dev builds.
   */
  switchDevPersona(role: UserRole): User {
    assertDevBuild();
    const persona =
      userService.getUsers().find(u => u.role === role && u.status === 'active') ||
      userService.getUsers().find(u => u.role === role);
    if (!persona) {
      throw new ServiceError('auth/no-persona', `No ${role} persona exists in the mock directory.`);
    }
    sessionStore.set({ isLoading: false, uid: persona.id, source: 'dev', emailVerified: true });
    return persona;
  }
};

export function useAuthServiceStore(): AuthSessionState {
  return useStore(sessionStore);
}
