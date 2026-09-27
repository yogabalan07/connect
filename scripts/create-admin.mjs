#!/usr/bin/env node
/**
 * One-time bootstrap of the department administrator account.
 *
 *   1. ensures the Firebase Auth account exists for the administrator's email
 *      (created with the password you supply, never stored by this script),
 *   2. writes `users/{uid}` with `role: 'admin'` and `status: 'approved'`.
 *
 * This is deliberately NOT client-side: the web app can only ever create a
 * `role: 'student'`, `status: 'pending'` profile for its own uid (enforced by
 * `firestore.rules`), so an admin document has to be provisioned from here,
 * with privileged credentials, once.
 *
 * Usage:
 *   $env:ADMIN_EMAIL='...'; $env:ADMIN_PASSWORD='...'; npm run admin:create
 *   (or omit ADMIN_PASSWORD and type it at the prompt)
 *
 * Credentials come from GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT
 * at run time. Nothing here is ever logged, committed or written to disk.
 */
import {
  createAccount,
  documentData,
  getAccessToken,
  getFirebaseConfig,
  loadLocalEnv,
  loadServiceAccount,
  lookupAccount,
  readSecret,
  setPassword,
  toValue,
  userDocumentUrl,
  usersCollectionUrl,
  api
} from './lib/adminApi.mjs';

function fail(message) {
  console.error(`\n[create-admin] ${message}`);
  process.exit(1);
}

const fieldsOf = data => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toValue(value)]));

async function main() {
  const env = loadLocalEnv();
  const { projectId, apiKey } = getFirebaseConfig(env);

  const email = (env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email) {
    fail(
      'ADMIN_EMAIL is not set.\n' +
        '  Set it to the administrator address (e.g. `ADMIN_EMAIL=<your admin email>`\n' +
        '  in .env.local or in the shell) and run `npm run admin:create` again.'
    );
  }

  const password = await readSecret('ADMIN_PASSWORD');
  if (!password || password.length < 6) {
    fail('ADMIN_PASSWORD must be at least 6 characters.');
  }

  const serviceAccount = loadServiceAccount(env);
  const token = await getAccessToken(serviceAccount);
  console.log(`[create-admin] project: ${projectId}`);
  console.log(`[create-admin] admin:   ${email}`);

  // ---------------------------------------------------------- Auth account
  let uid = await lookupAccount(projectId, email, token);
  if (uid) {
    console.log(`[create-admin] Firebase Auth account already exists (${uid}).`);
    try {
      await setPassword(projectId, uid, password, token);
      console.log('[create-admin] password set for the existing account.');
    } catch (error) {
      console.warn(
        `[create-admin] warning: could not set the password (${error.message}).\n` +
          '               Set it in Firebase console > Authentication > Users.'
      );
    }
  } else {
    if (!apiKey) {
      fail('VITE_FIREBASE_API_KEY is missing from .env.local (needed to create the Auth account).');
    }
    uid = await createAccount(apiKey, email, password);
    console.log(`[create-admin] created Firebase Auth account ${uid}.`);
  }

  // ------------------------------------------------------- profile document
  const now = new Date().toISOString();
  const url = userDocumentUrl(projectId, uid);

  let existing = null;
  try {
    existing = await api(url, { token });
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  if (!existing) {
    const profile = {
      id: uid,
      email,
      displayName: env.ADMIN_NAME || 'Department Administrator',
      username: env.ADMIN_USERNAME || 'department_admin',
      role: 'admin',
      status: 'approved',
      department: env.ADMIN_DEPARTMENT || 'CSE',
      year: env.ADMIN_YEAR || 'Faculty',
      bio: env.ADMIN_BIO || 'Department administrator responsible for approving campus accounts.',
      createdAt: now,
      updatedAt: now
    };
    await api(`${usersCollectionUrl(projectId)}?documentId=${encodeURIComponent(uid)}`, {
      method: 'POST',
      token,
      body: { fields: fieldsOf(profile) }
    });
    console.log(`[create-admin] created users/${uid} with role=admin, status=approved.`);
  } else {
    const patch = { role: 'admin', status: 'approved', email, updatedAt: now };
    const mask = Object.keys(patch).join(',');
    await api(`${url}?updateMask=${encodeURIComponent(mask)}`, {
      method: 'PATCH',
      token,
      body: { fields: fieldsOf(patch) }
    });
    console.log(`[create-admin] updated users/${uid}: role=admin, status=approved.`);
  }

  // ------------------------------------------------------------- verification
  const saved = documentData(await api(url, { token }));
  if (saved.role !== 'admin' || saved.status !== 'approved' || saved.id !== uid) {
    fail(`verification failed: ${JSON.stringify({ id: saved.id, role: saved.role, status: saved.status })}`);
  }

  console.log('[create-admin] verified document:');
  console.log(
    JSON.stringify(
      { id: saved.id, email: saved.email, displayName: saved.displayName, role: saved.role, status: saved.status },
      null,
      2
    )
  );
  console.log('[create-admin] done. Deploy the rules next: firebase deploy --only firestore:rules');
  console.log('[create-admin] the password was used for the Auth account only - it is not stored anywhere here.');
}

main().catch(error => fail(error.message));
