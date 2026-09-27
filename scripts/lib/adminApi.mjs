/**
 * Dependency-free helpers for one-time Firebase administration scripts.
 *
 * Everything privileged comes from the environment at run time:
 *   - Firebase project config  : `.env.local` / `.env` (`VITE_FIREBASE_*`)
 *   - privileged credentials   : `FIREBASE_SERVICE_ACCOUNT` (JSON) or
 *                                `GOOGLE_APPLICATION_CREDENTIALS` (JSON file)
 *   - admin password           : `ADMIN_PASSWORD` (or an interactive prompt)
 *
 * No credential, private key or password is ever read from, written to or
 * logged from this repository, and nothing here is imported by the web app.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1';
const IDENTITY_URL = 'https://identitytoolkit.googleapis.com/v1';

export const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/datastore'
];

/** Parses `KEY=VALUE` files without adding a dotenv dependency. */
export function loadLocalEnv(cwd = process.cwd()) {
  const values = {};
  for (const name of ['.env.local', '.env']) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith('#')) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
  }
  // A real environment variable always wins over a file.
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}

export function getFirebaseConfig(env) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.FIREBASE_PROJECT_ID;
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;
  if (!projectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is not set (add it to .env.local).');
  }
  return { projectId, apiKey };
}

/** Loads a service account from env/ADC files. The contents are never logged. */
export function loadServiceAccount(env) {
  const inline = env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.');
    }
  }

  const file = env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!file) {
    throw new Error(
      'No privileged credentials found.\n' +
        '  Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file\n' +
        '  (Firebase console > Project settings > Service accounts > Generate new\n' +
        '  private key), or set FIREBASE_SERVICE_ACCOUNT to that JSON. Never commit it.'
    );
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Service-account file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Exchanges a service-account JWT for a short-lived OAuth access token. */
export async function getAccessToken(serviceAccount, scopes = SCOPES) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64url(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: scopes.join(' '),
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600
      })
    )
  ].join('.');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .end()
    .sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `Token exchange failed (${response.status}): ${payload.error_description || payload.error || 'unknown error'}`
    );
  }
  return payload.access_token;
}

/** Thin JSON API helper; throws an Error carrying the server message. */
export async function api(url, { method = 'GET', token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: { message: text } };
    }
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `${method} ${url} failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

// ---------------------------------------------------------------- Firestore

export function userDocumentUrl(projectId, uid) {
  return `${FIRESTORE_URL}/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
}

export function usersCollectionUrl(projectId) {
  return `${FIRESTORE_URL}/projects/${projectId}/databases/(default)/documents/users`;
}

/** JavaScript value -> Firestore REST `Value`. */
export function toValue(value) {
  if (value === null || value === undefined) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, entry] of Object.entries(value)) fields[key] = toValue(entry);
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported value for Firestore: ${typeof value}`);
}

export function fromValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields ?? {});
  return undefined;
}

export function fromFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields ?? {})) result[key] = fromValue(value);
  return result;
}

/** Pages through a Firestore collection. */
export async function listCollection(collectionUrl, token) {
  const documents = [];
  let pageToken;
  do {
    const query = new URLSearchParams({ pageSize: '300' });
    if (pageToken) query.set('pageToken', pageToken);
    const payload = await api(`${collectionUrl}?${query}`, { token });
    documents.push(...(payload.documents ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return documents;
}

export function documentData(document) {
  return fromFields(document.fields ?? {});
}

// ---------------------------------------------------------- Identity Toolkit

/** Returns the localId (uid) for an email, or null when it does not exist. */
export async function lookupAccount(projectId, email, token) {
  try {
    const payload = await api(`${IDENTITY_URL}/projects/${projectId}/accounts:lookup`, {
      method: 'POST',
      token,
      body: { email }
    });
    return payload.users?.[0]?.localId ?? null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** Creates an Auth account with the public Identity Toolkit API. */
export async function createAccount(apiKey, email, password) {
  const payload = await api(`${IDENTITY_URL}/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body: { email, password, returnSecureToken: true }
  });
  return payload.localId;
}

/** Best-effort password reset for an existing account (admin API). */
export async function setPassword(projectId, localId, password, token) {
  return api(`${IDENTITY_URL}/projects/${projectId}/accounts:update`, {
    method: 'POST',
    token,
    body: { localId, password, updateMask: 'password' }
  });
}

/** Reads the password from env, or prompts without echoing it. */
export async function readSecret(label) {
  const fromEnv = process.env[label];
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    throw new Error(`${label} is not set and no interactive terminal is available. Set ${label} in the environment.`);
  }

  const readline = await import('node:readline');
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    process.stdout.write(`${label}: `);
    muted = true;
    rl._writeToOutput = chunk => {
      if (!muted) process.stdout.write(chunk);
    };
    rl.question('', answer => {
      muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}
