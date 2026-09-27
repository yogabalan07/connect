#!/usr/bin/env node
/**
 * Idempotent bootstrap of the department administrator account.
 *
 * Implemented with the official `firebase-admin` Node.js SDK — the previous
 * hand-rolled OAuth JWT + Identity Toolkit REST client has been removed
 * entirely, so there is only one admin-auth implementation.
 *
 * Credential source: GOOGLE_APPLICATION_CREDENTIALS (service-account JSON,
 * kept outside the repository). `firebase-admin` is imported only by scripts,
 * never by `src/`, so neither the key nor the password can reach the browser
 * bundle.
 *
 * Flow:
 *   1. read ADMIN_EMAIL (and ADMIN_PASSWORD only when it is actually needed),
 *   2. initializeApp() + getAuth() + getFirestore(),
 *   3. getAuth().getUserByEmail(ADMIN_EMAIL)
 *        exists   -> reuse it (never create a second account); update the
 *                    password with updateUser() only when one is configured,
 *        missing  -> createUser({ email, password, emailVerified: true }),
 *   4. write `users/{uid}` with the required admin fields; if the document
 *      already exists, update only those fields (never a duplicate create),
 *   5. read `users/{uid}` back and verify id / role / status / email.
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS='<path to service-account JSON>'
 *   npm run admin:create
 *
 * The password is never printed, never stored in Firestore, and every error
 * report is reduced to operation + Firebase error code + message.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { describeError, initFirebaseAdmin, loadLocalEnv, readSecret } from './lib/env.mjs';

/** Everything the failure reporter needs; secrets are scrubbed before print. */
const reportContext = { projectId: undefined, databaseId: undefined, secrets: [] };

function fail(message) {
  console.error(`\n[create-admin] ${message}`);
  process.exit(1);
}

/** Task 11: operation + Firebase error code + concise message, never secrets. */
function failOperation(operation, error) {
  const detail = describeError(error, { operation, ...reportContext }, reportContext.secrets);
  console.error(`\n[create-admin] bootstrap failed`);
  console.error(`  ${detail.split('\n').join('\n  ')}`);
  process.exit(1);
}

async function main() {
  const env = loadLocalEnv();

  const email = (env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email) {
    fail(
      'ADMIN_EMAIL is not set.\n' +
        '  Set it to the administrator address (e.g. `ADMIN_EMAIL=<your admin email>`\n' +
        '  in .env.local or in the shell) and run `npm run admin:create` again.'
    );
  }

  let auth;
  let projectId;
  try {
    ({ auth, projectId } = initFirebaseAdmin(env));
  } catch (error) {
    failOperation('initializing Firebase Admin from GOOGLE_APPLICATION_CREDENTIALS', error);
  }
  reportContext.projectId = projectId;

  // Explicit database targeting. The Admin SDK's implicit database resolution
  // does not resolve to the database this project has, which surfaces as gRPC
  // `5 NOT_FOUND` on every Firestore call — so the database is always named:
  //   const databaseId = process.env.FIRESTORE_DATABASE_ID || "default";
  //   const db = getFirestore(databaseId);
  const databaseId = process.env.FIRESTORE_DATABASE_ID || env.FIRESTORE_DATABASE_ID || 'default';
  reportContext.databaseId = databaseId;
  const db = getFirestore(databaseId);

  console.log(`[create-admin] project:  ${projectId}`);
  console.log(`[create-admin] database: ${databaseId}`);
  console.log(`[create-admin] admin:    ${email}`);

  // ---------------------------------------------------------- Auth account
  let account;
  try {
    account = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') account = null;
    else failOperation(`looking up the Auth account for ${email}`, error);
  }

  let uid;
  let accountAction;
  if (account) {
    // NEVER create a second account: reuse the existing one and its uid.
    uid = account.uid;
    accountAction = 'reused';
    console.log(`[create-admin] Auth account: reused existing account (${uid}) - no new account created`);

    // Update the password only when one is configured ("only if needed").
    const patch = {};
    const password = env.ADMIN_PASSWORD;
    if (password) patch.password = password;
    if (account.emailVerified !== true) patch.emailVerified = true;

    if (Object.keys(patch).length === 0) {
      console.log('[create-admin] Auth password: ADMIN_PASSWORD not provided - existing password kept');
    } else {
      reportContext.secrets = password ? [password] : [];
      try {
        await auth.updateUser(uid, patch);
      } catch (error) {
        failOperation(`updating the existing Auth account ${uid}`, error);
      }
      console.log(
        `[create-admin] Auth ${patch.password ? 'password updated' : 'email verified'}` +
          `${patch.password && patch.emailVerified ? ' and email verified' : ''} on the existing account`
      );
    }
  } else {
    // Creating is the only case where the password is mandatory.
    const password = await readSecret('ADMIN_PASSWORD', env);
    if (!password || password.length < 6) fail('ADMIN_PASSWORD must be at least 6 characters.');
    reportContext.secrets = [password];

    try {
      const created = await auth.createUser({ email, password, emailVerified: true });
      uid = created.uid;
    } catch (error) {
      failOperation(`creating the Auth account for ${email}`, error);
    }
    accountAction = 'created';
    console.log(`[create-admin] Auth account: created (${uid})`);
  }

  // ------------------------------------------------------- profile document
  const displayName = (env.ADMIN_NAME ?? '').trim() || 'Department Administrator';
  const username = (env.ADMIN_USERNAME ?? '').trim() || 'department_admin';

  const usersRef = db.collection('users').doc(uid);
  let snapshot;
  try {
    snapshot = await usersRef.get();
  } catch (error) {
    failOperation(`reading users/${uid}`, error);
  }

  let profileAction;
  if (!snapshot.exists) {
    try {
      await usersRef.set({
        id: uid,
        email,
        name: displayName,
        displayName,
        username,
        role: 'admin',
        status: 'approved',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      failOperation(`creating users/${uid}`, error);
    }
    profileAction = 'created';
    console.log(`[create-admin] Profile: created users/${uid} (role=admin, status=approved)`);
  } else {
    const existing = snapshot.data() ?? {};
    const patch = {
      id: uid,
      email,
      name: displayName,
      displayName,
      username,
      role: 'admin',
      status: 'approved',
      updatedAt: FieldValue.serverTimestamp()
    };
    if (existing.createdAt === undefined) patch.createdAt = FieldValue.serverTimestamp();
    try {
      await usersRef.update(patch);
    } catch (error) {
      failOperation(`updating users/${uid}`, error);
    }
    profileAction = 'updated';
    console.log(
      `[create-admin] Profile: updated existing users/${uid} (only required admin fields; no duplicate created)`
    );
  }

  // ------------------------------------------------------------- verification
  let saved;
  try {
    saved = await usersRef.get();
  } catch (error) {
    failOperation(`reading back users/${uid}`, error);
  }

  const data = saved.exists ? saved.data() : undefined;
  const problems = [];
  if (!saved.exists) problems.push('document does not exist');
  else {
    if (data.id !== uid) problems.push(`id ${JSON.stringify(data.id)} does not equal Auth uid ${uid}`);
    if (data.role !== 'admin') problems.push(`role is ${JSON.stringify(data.role)}, expected "admin"`);
    if (data.status !== 'approved') problems.push(`status is ${JSON.stringify(data.status)}, expected "approved"`);
    if (data.email !== email) problems.push(`email ${JSON.stringify(data.email)} does not match ADMIN_EMAIL`);
  }
  if (problems.length) {
    console.error(`\n[create-admin] Verification: FAILED for users/${uid}`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`[create-admin] Verification: succeeded for users/${uid}`);
  console.log(
    JSON.stringify(
      {
        id: data.id,
        email: data.email,
        name: data.name,
        username: data.username,
        role: data.role,
        status: data.status
      },
      null,
      2
    )
  );
  console.log(
    `[create-admin] summary: account=${accountAction} profile=${profileAction} verification=passed`
  );
  console.log('[create-admin] The password was used for the Auth account only - it is not stored anywhere.');
}

main().catch(error => failOperation('running the bootstrap script', error));
