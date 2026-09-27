import { AcademicYear, Department, User, UserRole } from '../types';
import { createStore, useStore } from '../lib/store';
import { ServiceError, ServiceResult, fail, ok } from '../lib/errors';
import { userService } from './userService';
import { AuthAdapter, AuthUser, getAuthAdapter, setAuthAdapter as setBackendAdapter } from './authAdapter';
import { mapAuthError } from './authErrors';
import { mapFirestoreError } from './firestoreErrors';

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
 *   are always read from `users/{uid}`, never from the credential layer.
 * - The profile behind a session is restored from Firestore: the session is
 *   settled synchronously so guards never block on a read, and the profile is
 *   resolved right after (deduplicated per UID so a restore, a sign-in and a
 *   registration cannot race each other into duplicate creates).
 * - When the profile cannot be read the session fails closed instead of
 *   stranding the user in a session no guard can render, and the reason is
 *   surfaced through `sessionStore.profileError`.
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
  /**
   * Why the profile behind the session could not be resolved (read failure or
   * an identity without a profile). Null while everything is healthy; shown
   * once by the UI instead of silently bouncing the user around.
   */
  profileError: string | null;
}

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_MISSING_MESSAGE =
  'Your account profile could not be loaded. Contact your department administrator.';

const INITIAL_SESSION: AuthSessionState = {
  isLoading: true,
  uid: null,
  source: null,
  emailVerified: false,
  profileError: null
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

/** Profile restores currently running, keyed by UID (dedupes listeners). */
const inFlightRestores = new Map<string, Promise<User | null>>();

function forgetRestores(): void {
  inFlightRestores.clear();
}

/**
 * Resolves `users/{uid}` for a Firebase identity.
 *
 * Never rejects: failures fail the session closed (uid cleared, reason kept in
 * `profileError`) and are reported through the returned `null`, so both the
 * fire-and-forget listener path and an awaited sign-in share one behaviour.
 * Concurrent calls for the same UID share a single promise — Firebase can
 * replay `onAuthStateChanged` while a sign-in is still in flight, and a
 * second create must never race the first one.
 */
function restoreProfile(user: AuthUser): Promise<User | null> {
  const running = inFlightRestores.get(user.uid);
  if (running) return running;

  const task = (async (): Promise<User | null> => {
    try {
      const profile = await userService.ensureProfileForAuthUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });

      // The session may have moved on while the read was in flight.
      if (sessionStore.get().uid !== user.uid) return profile;

      if (profile) {
        userService.setActor(profile);
        sessionStore.set(prev => (prev.profileError ? { ...prev, profileError: null } : prev));
        return profile;
      }

      sessionStore.set(prev => ({ ...prev, profileError: PROFILE_MISSING_MESSAGE }));
      return null;
    } catch (error) {
      const mapped = mapFirestoreError(error);
      if (sessionStore.get().uid !== user.uid) return null;
      // Fail closed: no profile means no role/status, so no session.
      userService.setActor(null);
      sessionStore.set({
        ...INITIAL_SESSION,
        isLoading: false,
        profileError: mapped.message
      });
      return null;
    }
  })();

  inFlightRestores.set(user.uid, task);
  const settle = (): void => {
    if (inFlightRestores.get(user.uid) === task) inFlightRestores.delete(user.uid);
  };
  task.then(settle, settle);

  return task;
}

function applyFirebaseUser(user: AuthUser): void {
  const cached = userService.getById(user.uid) ?? null;
  sessionStore.set({
    isLoading: false,
    uid: user.uid,
    source: 'firebase',
    emailVerified: user.emailVerified,
    profileError: cached ? null : sessionStore.get().profileError
  });
  userService.setActor(cached);
  // Refresh from Firestore even when the profile is already cached, so an
  // approval or a block made elsewhere is picked up on the next visit.
  void restoreProfile(user);
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

  userService.setActor(null);
  sessionStore.set({ ...INITIAL_SESSION, isLoading: false });
}

let boundAdapter: AuthAdapter | null = null;
let unsubscribeAdapter: (() => void) | null = null;

function bindAdapter(adapter: AuthAdapter): void {
  unsubscribeAdapter?.();
  boundAdapter = adapter;
  forgetRestores();
  userService.setActor(null);
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

/** Drops the local session after a failed action without revoking the user. */
function endSession(): void {
  userService.setActor(null);
  sessionStore.set({ ...INITIAL_SESSION, isLoading: false });
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
      // `onAuthStateChanged` may already have started this restore; awaiting
      // the same promise keeps one read and one create.
      const profile = await restoreProfile(authUser);
      if (!profile) {
        const message = sessionStore.get().profileError ?? PROFILE_MISSING_MESSAGE;
        // Authenticated but unusable: leave the client signed out instead of
        // stranding the user in a session no guard can render.
        await currentAdapter()
          .signOut()
          .catch(() => undefined);
        endSession();
        return fail(message);
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
        // profile for this brand-new UID: the service upserts it instead of
        // failing, and it is the only place that accepts registration data.
        profile = await userService.registerProfile({
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
        endSession();
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
    forgetRestores();
    endSession();

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
    const persona = userService.ensureDevPersona(role);
    sessionStore.set({
      isLoading: false,
      uid: persona.id,
      source: 'dev',
      emailVerified: true,
      profileError: null
    });
    userService.setActor(persona);
    return persona;
  }
};

export function useAuthServiceStore(): AuthSessionState {
  return useStore(sessionStore);
}
