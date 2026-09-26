import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { ServiceError } from './errors';

/**
 * Firebase foundation (single initialization module).
 *
 * Rules enforced here:
 * - Exactly one Firebase app instance (no duplicate initialization files).
 * - Configuration comes only from Vite env vars — never hardcoded.
 * - Nothing is created at import time: the app is initialized lazily, so
 *   builds/tests/local dev without Firebase config never throw or connect
 *   anywhere.
 *
 * React pages must NEVER import this module directly. They go through
 * hooks/context -> domain services -> Firebase adapters -> these getters.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

const NOT_CONFIGURED_MESSAGE =
  'Firebase is not configured. Copy .env.example to .env and fill in the ' +
  'VITE_FIREBASE_* values from your Firebase console (Project settings > ' +
  'Your apps > SDK setup).';

function readEnv(key: string): string {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** True when every required VITE_FIREBASE_* variable is present and non-empty. */
export function isFirebaseConfigured(): boolean {
  return REQUIRED_ENV_KEYS.every(key => readEnv(key).length > 0);
}

/** Names of the variables that are missing (empty strings when none). */
export function missingFirebaseConfigKeys(): string[] {
  return REQUIRED_ENV_KEYS.filter(key => readEnv(key).length === 0);
}

/** Assembles the Firebase web config from the environment. Callers must check `isFirebaseConfigured()` first. */
export function getFirebaseWebConfig(): FirebaseWebConfig {
  const missing = missingFirebaseConfigKeys();
  if (missing.length > 0) {
    throw new ServiceError(
      'firebase/not-configured',
      `${NOT_CONFIGURED_MESSAGE} Missing: ${missing.join(', ')}.`
    );
  }

  const config: FirebaseWebConfig = {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID')
  };

  const measurementId = readEnv('VITE_FIREBASE_MEASUREMENT_ID');
  if (measurementId) config.measurementId = measurementId;

  return config;
}

let cachedApp: FirebaseApp | null = null;

/**
 * Lazily initializes (and caches) the single Firebase app instance.
 * Reuses an app created elsewhere (e.g. by the emulator tooling) to avoid
 * the "app already exists" error.
 */
export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;

  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }

  const app = initializeApp(getFirebaseWebConfig());
  cachedApp = app;
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
