import { AcademicYear, Department, User, UserRole } from '../types';
import { createStore, useStore } from '../lib/store';
import { ServiceError, ServiceResult, fail, ok } from '../lib/errors';
import { userService } from './userService';

/**
 * Authentication abstraction.
 *
 * The mock adapter keeps a *local* credential book (salted hash, no plain
 * passwords anywhere in the source tree) and a session that only stores the
 * signed-in user id. Role and status are always read from the user record —
 * never from storage — so a future Firebase adapter can replace this file
 * without touching any page, guard or hook.
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

interface SessionState {
  isLoading: boolean;
  uid: string | null;
}

interface CredentialRecord {
  salt: string;
  hash: string;
}

type CredentialBook = Record<string, CredentialRecord>;

const SESSION_KEY = 'ch_session_uid';
const CREDENTIALS_KEY = 'ch_credentials_v1';
const MIN_PASSWORD_LENGTH = 6;

const hasStorage = typeof localStorage !== 'undefined';

function readStorage(key: string): string | null {
  if (!hasStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (!hasStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — session stays in memory */
  }
}

function removeStorage(key: string): void {
  if (!hasStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Non-cryptographic digest used ONLY by the local mock adapter so that no
 * password is stored in plaintext or shipped in the bundle.
 * Real credentials will be handled exclusively by Firebase Auth.
 */
function digest(password: string, salt: string): string {
  const input = `${salt}:${password}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function createSalt(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function loadCredentials(): CredentialBook {
  const raw = readStorage(CREDENTIALS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CredentialBook;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persistCredentials(book: CredentialBook): void {
  writeStorage(CREDENTIALS_KEY, JSON.stringify(book));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function restoreSession(): SessionState {
  const stored = readStorage(SESSION_KEY);
  if (!stored) return { isLoading: false, uid: null };
  const user = userService.getById(stored);
  if (!user) {
    removeStorage(SESSION_KEY);
    return { isLoading: false, uid: null };
  }
  return { isLoading: false, uid: stored };
}

const sessionStore = createStore<SessionState>(restoreSession());
const credentialsStore = createStore<CredentialBook>(loadCredentials());

function setSession(uid: string | null): void {
  sessionStore.set({ isLoading: false, uid });
  if (uid) writeStorage(SESSION_KEY, uid);
  else removeStorage(SESSION_KEY);
}

function assertDevBuild(): void {
  if (!import.meta.env.DEV) {
    throw new ServiceError(
      'auth/dev-only',
      'Development personas are only available while running `npm run dev`.'
    );
  }
}

export const authService = {
  sessionStore,
  credentialsStore,

  isLoading(): boolean {
    return sessionStore.get().isLoading;
  },

  getSessionUid(): string | null {
    return sessionStore.get().uid;
  },

  /** Resolves the signed-in profile, or null when there is no valid session. */
  getCurrentUser(): User | null {
    const uid = sessionStore.get().uid;
    return uid ? userService.getById(uid) ?? null : null;
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    const normalized = normalizeEmail(email);
    if (!normalized || !password) {
      return fail('Enter your college email and password.');
    }

    const user = userService.getByEmail(normalized);
    const credential = credentialsStore.get()[normalized];

    if (!user || !credential) {
      return fail('Email or password is incorrect.');
    }
    if (credential.hash !== digest(password, credential.salt)) {
      return fail('Email or password is incorrect.');
    }

    setSession(user.id);
    return ok(user);
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (userService.emailExists(email)) {
      return fail('An account with this college email already exists.');
    }

    try {
      const user = userService.createPendingUser({
        name: input.name,
        email,
        department: input.department,
        year: input.year,
        section: input.section,
        skills: input.skills
      });

      const salt = createSalt();
      const book = { ...credentialsStore.get(), [email]: { salt, hash: digest(input.password, salt) } };
      credentialsStore.set(book);
      persistCredentials(book);

      setSession(user.id);
      return ok(user);
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Registration failed.');
    }
  },

  signOut(): void {
    setSession(null);
  },

  /**
   * Password recovery placeholder. It never claims that a mail was sent:
   * delivery only exists once Firebase Auth is wired up.
   */
  async requestPasswordReset(email: string): Promise<ServiceResult<string>> {
    const normalized = normalizeEmail(email);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return fail('Enter a valid college email address.');
    }
    return ok(
      `If an account exists for ${normalized}, reset instructions will be delivered once email delivery is enabled with the Firebase backend.`
    );
  },

  /**
   * DEV-ONLY persona switch used by the development tooling in
   * `components/ui/RoleSwitcher`. It changes the local mock session only:
   * it never writes a role to storage and it does not exist in production
   * builds (the call throws when `import.meta.env.DEV` is false).
   */
  switchDevPersona(role: UserRole): User {
    assertDevBuild();
    const persona =
      userService.getUsers().find(u => u.role === role && u.status === 'active') ||
      userService.getUsers().find(u => u.role === role);
    if (!persona) {
      throw new ServiceError('auth/no-persona', `No ${role} persona exists in the mock directory.`);
    }
    setSession(persona.id);
    return persona;
  }
};

export function useAuthServiceStore(): SessionState {
  return useStore(sessionStore);
}
