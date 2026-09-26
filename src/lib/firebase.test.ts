import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApps } from 'firebase/app';
import { ServiceError } from './errors';
import {
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

function stubFullConfig(): void {
  for (const key of REQUIRED_KEYS) {
    vi.stubEnv(key, `test-value-${key.toLowerCase()}`);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('configuration detection', () => {
  it('reports unconfigured when no VITE_FIREBASE_* variables are set', () => {
    expect(isFirebaseConfigured()).toBe(false);
    expect(missingFirebaseConfigKeys()).toEqual(REQUIRED_KEYS);
  });

  it('reports configured only when every required variable is present', () => {
    for (const key of REQUIRED_KEYS) vi.stubEnv(key, 'set');
    expect(isFirebaseConfigured()).toBe(true);
    expect(missingFirebaseConfigKeys()).toEqual([]);
  });

  it('treats empty or whitespace-only values as missing', () => {
    for (const key of REQUIRED_KEYS) vi.stubEnv(key, 'set');
    vi.stubEnv('VITE_FIREBASE_API_KEY', '   ');
    expect(isFirebaseConfigured()).toBe(false);
    expect(missingFirebaseConfigKeys()).toEqual(['VITE_FIREBASE_API_KEY']);
  });
});

describe('getFirebaseWebConfig', () => {
  it('throws a typed error listing every missing key', () => {
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
    stubFullConfig();
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'abc123');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'campus-doubts');
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST');

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
    stubFullConfig();
    expect(getFirebaseWebConfig().measurementId).toBeUndefined();
  });
});

// NOTE: the app-initialization tests must run after the "throws when not
// configured" case above, because the first successful call caches the app
// for the rest of this test file (matching production singleton behaviour).
describe('singleton initialization', () => {
  it('refuses to initialize without configuration', () => {
    expect(() => getFirebaseApp()).toThrowError(ServiceError);
    expect(getApps()).toHaveLength(0);
  });

  it('creates exactly one app and reuses it', () => {
    stubFullConfig();

    const app = getFirebaseApp();
    expect(app.name).toBe('[DEFAULT]');
    expect(getFirebaseApp()).toBe(app);
    expect(getApps()).toHaveLength(1);
  });

  it('derives stable auth/db/storage handles from the same app', () => {
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
