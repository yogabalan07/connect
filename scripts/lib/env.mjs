/**
 * Shared helpers for the privileged admin bootstrap scripts.
 *
 * Credential policy:
 *   - the service-account key is located through GOOGLE_APPLICATION_CREDENTIALS
 *     and handed to the official `firebase-admin` SDK; this module only ever
 *     reads the file *path* and its `project_id` field,
 *   - the private key is never printed, never written, never stored in `src/`,
 *     never placed in `.env.example` and never bundled into the web app,
 *   - the admin password is read or prompted for without echoing and is never
 *     logged,
 *   - every error report is reduced to operation + Firebase error code +
 *     message, with private keys, bearer/access tokens and the password
 *     scrubbed before anything reaches the console.
 *
 * `firebase-admin` is imported here and nowhere else: this file lives under
 * `scripts/`, which the browser bundle never reaches.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Firestore database id used by every admin script.
 *
 * The Admin SDK's *implicit* default cannot be used here: it does not resolve
 * to the database this project actually has, so every Firestore call fails with
 * gRPC `5 NOT_FOUND`. The database id must therefore always be explicit.
 */
export const DEFAULT_DATABASE_ID = 'default';

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

/**
 * Resolves the service-account JSON behind GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Only the path and `project_id` are read. The JSON itself (and therefore the
 * private key) stays inside the SDK.
 */
function resolveServiceAccount(env) {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!file) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Point it at a service-account JSON key file\n' +
        '  (Firebase console > Project settings > Service accounts >\n' +
        '   Generate new private key) and run this script again.\n' +
        '  Keep that file out of git, out of src/ and never log it.'
    );
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Service-account file not found: ${file}`);
  }

  let projectId;
  try {
    projectId = JSON.parse(fs.readFileSync(file, 'utf8')).project_id;
  } catch {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS does not point at a readable service-account JSON file.');
  }
  if (!projectId) {
    throw new Error('The service-account file has no project_id field.');
  }

  // The SDK reads the variable from process.env; let it come from `.env.local`
  // too. Only the *path* is propagated — never the key material.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
  }

  return { file, projectId };
}

/**
 * Initializes Firebase Admin with the GOOGLE_APPLICATION_CREDENTIALS
 * service-account credential. Scripts only — never called by the web app.
 *
 * Returns the app, its project id and `getAuth()`. Firestore is deliberately
 * NOT created here: callers must name the database explicitly with
 * `getFirestore(databaseId)`, because implicit database resolution is the bug
 * this script works around.
 */
export function initFirebaseAdmin(env = loadLocalEnv()) {
  const { projectId } = resolveServiceAccount(env);

  const app = initializeApp({ credential: applicationDefault(), projectId });

  return { app, projectId, auth: getAuth(app) };
}

/**
 * Reads a secret from the environment, or prompts for it without echoing.
 * The value is returned to the caller and never logged here.
 */
export async function readSecret(label, env = loadLocalEnv()) {
  const fromEnv = env[label];
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    throw new Error(
      `${label} is not set and no interactive terminal is available. Set ${label} in the environment.`
    );
  }

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

/** Firebase Auth errors carry string codes (`auth/...`). */
function isAuthCode(code) {
  return typeof code === 'string' && code.startsWith('auth/');
}

/**
 * The error code, normalized to a string.
 * firebase-admin Auth throws `{ code: 'auth/...' }`; gRPC/Firestore throws
 * `{ code: 5 }`. Both are reported verbatim, never guessed from the message.
 */
export function errorCode(error) {
  const code = error?.code;
  if (typeof code === 'string') return code;
  if (typeof code === 'number') return String(code);
  return 'unknown';
}

/** Static, never-interpolated hint for a known Firebase error code. */
function hintFor(error, context) {
  const code = errorCode(error);
  const message = error instanceof Error ? error.message : '';

  if (isAuthCode(code)) {
    const hints = {
      'auth/user-not-found': 'no Auth account with that email',
      'auth/email-already-exists': 'an Auth account with that email already exists',
      'auth/invalid-email': 'the address is not a valid email',
      'auth/invalid-password': 'the password does not meet Firebase requirements',
      'auth/weak-password': 'the password is too weak',
      'auth/project-not-found': 'the service account points at a different project',
      'auth/permission-error': 'the service account lacks Identity Toolkit permission',
      'auth/internal-error': 'Firebase Auth rejected the request'
    };
    return hints[code] ?? '';
  }

  if (code === '5' || /NOT_FOUND/.test(message)) {
    if (context.operation?.startsWith('initializing')) return '';
    return (
      `the Firestore database "${context.databaseId ?? DEFAULT_DATABASE_ID}" does not exist in project ` +
      `${context.projectId ?? '<unknown>'}. Create it (open ` +
      `https://console.cloud.google.com/datastore/setup?project=${context.projectId} and choose ` +
      'Native mode), or set FIRESTORE_DATABASE_ID to a database that does exist.'
    );
  }
  if (code === '7' || /PERMISSION_DENIED/.test(message)) {
    return 'the service account is missing a required IAM permission for this operation.';
  }
  return '';
}

/**
 * Scrubs anything that must never reach the console: PEM private keys,
 * bearer/access tokens, and any explicitly known secret (the admin password).
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  out = out.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted private key]');
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]');
  out = out.replace(/\bya29\.[A-Za-z0-9._~+/=-]+/g, '[redacted token]');
  out = out.replace(/([?&](?:access_token|refresh_token|id_token)=)[^&\s]+/g, '$1[redacted]');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 4) {
      out = out.split(secret).join('[redacted]');
    }
  }
  return out;
}

/**
 * Builds the report required for every Firebase failure:
 * operation that failed + Firebase error code + concise message.
 * The result is already redacted.
 */
export function describeError(error, context = {}, secrets = []) {
  const lines = [];
  if (context.operation) lines.push(`operation: ${context.operation}`);
  lines.push(`code:      ${errorCode(error)}`);
  lines.push(`message:   ${redactSecrets(error instanceof Error ? error.message : String(error), secrets)}`);
  const hint = hintFor(error, context);
  if (hint) lines.push(`hint:      ${hint}`);
  return lines.map(line => redactSecrets(line, secrets)).join('\n  ');
}
