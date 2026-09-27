import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps } from 'firebase/app';
import { ServiceError } from './errors';
import {
  FIRESTORE_DATABASE_ID,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
  getFirebaseWebConfig,
  isFirebaseConfigured,
  missingFirebaseConfigKeys
} from './firebase';

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];
const OPTIONAL_KEYS = ['VITE_FIREBASE_MEASUREMENT_ID'];
const FIREBASE_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

type EnvRecord = Record<string, string | undefined>;

/**
 * These tests are hermetic: they must never read the developer's `.env.local`.
 *
 * Vite populates `import.meta.env` (a live view shared with `process.env`) at
 * startup, so the real Firebase identifiers of a configured machine would make
 * every "unconfigured" expectation pass/fail for the wrong reason. Each test
 * therefore declares the exact environment it wants: the hooks below snapshot
 * the developer values, wipe every VITE_FIREBASE_* key, and restore them once
 * the test is done.
 */
function metaEnv(): EnvRecord {
  return import.meta.env as unknown as EnvRecord;
}

function readEnvValue(key: string): string | undefined {
  const fromMeta = metaEnv()[key];
  if (typeof fromMeta === 'string') return fromMeta;
  const fromProcess = process.env[key];
  return typeof fromProcess === 'string' ? fromProcess : undefined;
}

/** Writes/deletes on both views so `import.meta.env` and `process.env` stay in sync. */
function writeEnvValue(key: string, value: string | undefined): void {
  const proc: EnvRecord = process.env;
  if (value === undefined) {
    delete metaEnv()[key];
    delete proc[key];
    return;
  }
  metaEnv()[key] = value;
  proc[key] = value;
}

function setEnv(key: string, value: string): void {
  writeEnvValue(key, value);
}

function removeEnv(key: string): void {
  writeEnvValue(key, undefined);
}

/** Explicitly removes every required + optional Firebase variable. */
function clearFirebaseEnv(): void {
  for (const key of FIREBASE_KEYS) removeEnv(key);
}

/** Fake, self-contained configuration for tests that need a valid one. */
function stubFullConfig(): void {
  for (const key of REQUIRED_KEYS) setEnv(key, `test-value-${key.toLowerCase()}`);
}

let savedEnv: EnvRecord = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of FIREBASE_KEYS) savedEnv[key] = readEnvValue(key);
  clearFirebaseEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of FIREBASE_KEYS) writeEnvValue(key, savedEnv[key]);
});

describe('configuration detection', () => {
  it('reports unconfigured when no VITE_FIREBASE_* variables are set', () => {
    clearFirebaseEnv();

    expect(isFirebaseConfigured()).toBe(false);
    expect(missingFirebaseConfigKeys()).toEqual(REQUIRED_KEYS);
  });

  it('reports configured only when every required variable is present', () => {
    clearFirebaseEnv();
    for (const key of REQUIRED_KEYS) setEnv(key, 'set');

    expect(isFirebaseConfigured()).toBe(true);
    expect(missingFirebaseConfigKeys()).toEqual([]);
  });

  it('treats empty or whitespace-only values as missing', () => {
    clearFirebaseEnv();
    stubFullConfig();
    setEnv('VITE_FIREBASE_API_KEY', '   ');

    expect(isFirebaseConfigured()).toBe(false);
    expect(missingFirebaseConfigKeys()).toEqual(['VITE_FIREBASE_API_KEY']);
  });
});

describe('getFirebaseWebConfig', () => {
  it('throws a typed error listing every missing key', () => {
    clearFirebaseEnv();

    let thrown: unknown;
    try {
      getFirebaseWebConfig();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ServiceError);
    const serviceError = thrown as ServiceError;
    expect(serviceError.code).toBe('firebase/not-configured');
    for (const key of REQUIRED_KEYS) {
      expect(serviceError.message).toContain(key);
    }
  });

  it('assembles the config from the environment', () => {
    clearFirebaseEnv();
    stubFullConfig();
    setEnv('VITE_FIREBASE_API_KEY', 'abc123');
    setEnv('VITE_FIREBASE_PROJECT_ID', 'campus-doubts');
    setEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST');

    const config = getFirebaseWebConfig();
    expect(config).toEqual({
      apiKey: 'abc123',
      authDomain: 'test-value-vite_firebase_auth_domain',
      projectId: 'campus-doubts',
      storageBucket: 'test-value-vite_firebase_storage_bucket',
      messagingSenderId: 'test-value-vite_firebase_messaging_sender_id',
      appId: 'test-value-vite_firebase_app_id',
      measurementId: 'G-TEST'
    });
  });

  it('omits the optional measurement id when unset', () => {
    clearFirebaseEnv();
    stubFullConfig();
    removeEnv('VITE_FIREBASE_MEASUREMENT_ID');

    expect(getFirebaseWebConfig().measurementId).toBeUndefined();
  });
});

// NOTE: the app-initialization tests must run after the "throws when not
// configured" case above, because the first successful call caches the app
// for the rest of this test file (matching production singleton behaviour).
describe('singleton initialization', () => {
  it('refuses to initialize without configuration', () => {
    clearFirebaseEnv();
    expect(getApps()).toHaveLength(0);

    expect(() => getFirebaseApp()).toThrowError(ServiceError);
    expect(getApps()).toHaveLength(0);
  });

  it('creates exactly one app and reuses it', () => {
    clearFirebaseEnv();
    stubFullConfig();

    const app = getFirebaseApp();
    expect(app.name).toBe('[DEFAULT]');
    expect(getFirebaseApp()).toBe(app);
    expect(getApps()).toHaveLength(1);
  });

  it('derives stable auth/db/storage handles from the same app', () => {
    clearFirebaseEnv();
    stubFullConfig();

    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();

    expect(getFirebaseAuth()).toBe(auth);
    expect(getFirebaseDb()).toBe(db);
    expect(getFirebaseStorage()).toBe(storage);
    expect(auth.app).toBe(getFirebaseApp());
    expect(db.app).toBe(getFirebaseApp());
    expect(storage.app).toBe(getFirebaseApp());
  });
});

/**
 * This project's Firestore database is named `default`. Passing the database
 * id explicitly is load-bearing: the SDK's implicit resolution targets a
 * database this project does not have, which surfaces as `NOT_FOUND` on every
 * read and write. These tests fail if `getFirebaseDb()` ever goes implicit
 * again, because the resolved database id flips to `(default)`.
 */
describe('firestore database targeting', () => {
  type DatabaseIdInternals = { _databaseId?: { projectId: string; database: string } };

  /** Reads the database id the SDK actually resolved for this handle. */
  function resolvedDatabase(db: ReturnType<typeof getFirebaseDb>): string | undefined {
    return (db as unknown as DatabaseIdInternals)._databaseId?.database;
  }

  it('pins the database id to "default"', () => {
    expect(FIRESTORE_DATABASE_ID).toBe('default');
  });

  it('resolves getFirebaseDb() against `default`, never the implicit database', () => {
    clearFirebaseEnv();
    stubFullConfig();

    const db = getFirebaseDb();

    expect(resolvedDatabase(db)).toBe('default');
    expect(resolvedDatabase(db)).not.toBe('(default)');
    expect(db.app).toBe(getFirebaseApp());
    expect(getApps()).toHaveLength(1);
  });

  it('keeps returning one handle for that database id', () => {
    clearFirebaseEnv();
    stubFullConfig();

    expect(getFirebaseDb()).toBe(getFirebaseDb());
  });
});
