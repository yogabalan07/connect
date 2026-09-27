#!/usr/bin/env node
/**
 * Removes legacy demo profiles from `users` - and nothing else.
 *
 * A document is only ever considered mock when its id matches the deleted
 * `src/data/mockUsers.ts` identity pattern (`user-1` … `user-30`). Real
 * accounts are keyed by a Firebase Auth uid (28+ random characters), so a
 * pattern match can never hit a genuine member.
 *
 * Safety rails (all of them are hard stops, not warnings):
 *   - dry-run by default: nothing is deleted without `--apply`;
 *   - the administrator account (ADMIN_EMAIL) is never deleted;
 *   - a document with `role: 'admin'` is never deleted;
 *   - anything not matching the mock pattern is reported but left alone,
 *     unless it is named explicitly with `--ids` / `--emails`.
 *
 * Usage:
 *   npm run admin:cleanup-mock            # report only
 *   npm run admin:cleanup-mock -- --apply  # delete what was reported
 *   npm run admin:cleanup-mock -- --ids user-1,user-7 --apply
 */
import {
  documentData,
  getAccessToken,
  getFirebaseConfig,
  listCollection,
  loadLocalEnv,
  loadServiceAccount,
  userDocumentUrl,
  usersCollectionUrl,
  api
} from './lib/adminApi.mjs';

const MOCK_ID = /^user-\d+$/;

function parseArgs(argv) {
  const args = { apply: false, ids: [], emails: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--ids') args.ids = (argv[++i] ?? '').split(',').map(v => v.trim()).filter(Boolean);
    else if (arg === '--emails') args.emails = (argv[++i] ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[cleanup-mock] ${error.message}`);
  process.exit(1);
}

if (args.help) {
  console.log('Usage: npm run admin:cleanup-mock [-- --apply] [--ids a,b] [--emails x@y,z@w]');
  process.exit(0);
}

function classify(docId, data, adminEmail, explicit) {
  if (adminEmail && data.email === adminEmail) return { action: 'keep', reason: 'administrator account' };
  if (data.role === 'admin') return { action: 'keep', reason: 'role=admin' };
  if (explicit.ids.includes(docId) || explicit.emails.includes(data.email)) {
    return { action: 'delete', reason: 'explicitly named on the command line' };
  }
  if (MOCK_ID.test(docId)) return { action: 'delete', reason: 'legacy mock identity (user-N)' };
  return { action: 'keep', reason: 'not a mock record' };
}

async function main() {
  const env = loadLocalEnv();
  const { projectId } = getFirebaseConfig(env);
  const adminEmail = (env.ADMIN_EMAIL ?? '').trim().toLowerCase() || null;
  const serviceAccount = loadServiceAccount(env);
  const token = await getAccessToken(serviceAccount);

  const documents = await listCollection(usersCollectionUrl(projectId), token);
  console.log(`[cleanup-mock] project: ${projectId}`);
  console.log(`[cleanup-mock] scanned ${documents.length} document(s) in users/\n`);

  const rows = documents.map(document => {
    const id = document.name.split('/').pop();
    const data = documentData(document);
    const verdict = classify(id, data, adminEmail, args);
    return { id, email: data.email ?? '(no email)', role: data.role ?? '?', status: data.status ?? '?', ...verdict };
  });

  const width = Math.max(8, ...rows.map(row => row.id.length));
  for (const row of rows) {
    const mark = row.action === 'delete' ? 'DELETE' : 'keep  ';
    console.log(`${mark}  ${row.id.padEnd(width)}  ${row.status.padEnd(8)}  ${row.role.padEnd(7)}  ${row.email}  (${row.reason})`);
  }

  const doomed = rows.filter(row => row.action === 'delete');
  console.log(`\n[cleanup-mock] ${doomed.length} candidate(s), ${rows.length - doomed.length} protected/kept.`);

  if (!doomed.length) return;
  if (!args.apply) {
    console.log('[cleanup-mock] dry run - re-run with --apply to delete the candidates above.');
    return;
  }

  for (const row of doomed) {
    await api(`${userDocumentUrl(projectId, row.id)}?currentDocument.exists=users/${encodeURIComponent(row.id)}`, {
      method: 'DELETE',
      token
    });
    console.log(`[cleanup-mock] deleted users/${row.id}`);
  }
  console.log(`[cleanup-mock] removed ${doomed.length} document(s).`);
}

main().catch(error => {
  console.error(`\n[cleanup-mock] ${error.message}`);
  process.exit(1);
});
