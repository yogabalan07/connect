import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInAnonymously
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { FIRESTORE_DATABASE_ID, getFirebaseWebConfig } from '../lib/firebase';
import { conversationIdFor } from '../services/messagingAdapter';
import { firebaseMessagingAdapter } from '../services/firebaseMessagingAdapter';

/**
 * Phase 10: the one claim a unit test cannot make - that a message written by
 * one real account reaches another real account's screen with no refresh, no
 * navigation and no refetch.
 *
 * This runs the PRODUCTION adapter (`firebaseMessagingAdapter`) and the
 * DEPLOYED `firestore.rules` against the Firestore + Auth emulators, with two
 * distinct authenticated accounts in two separate OS processes, so neither
 * client shares memory, a store or a session with the other.
 *
 * Skipped unless both emulators are up (`FIRESTORE_EMULATOR_HOST` and
 * `FIREBASE_AUTH_EMULATOR_HOST`), so `npm run test` stays green without a JDK.
 * Run it with:
 *   firebase emulators:exec --only auth,firestore --project connect-yb `
 *     "npx vitest run src/security/realtimeMessaging.test.ts"
 */
const hasFirestore = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const hasAuth = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const markerDir = process.env.REALTIME_VERIFY_DIR ?? '';
const realtimeSuite = hasFirestore && hasAuth && markerDir ? describe : describe.skip;

const PROJECT = process.env.GCLOUD_PROJECT ?? 'connect-yb';
const PEER = path.join(markerDir, 'peer');
const READY = path.join(markerDir, 'ready');
const SENT = path.join(markerDir, 'sent');
const SENDER_LOG = path.join(markerDir, 'sender.log');
const RECEIVER_LOG = path.join(markerDir, 'receiver.log');

const ROOT = path.resolve(__dirname, '../..');

/** Polls for a marker file written by the other process. */
async function waitFor(file: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(file)) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path.basename(file)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/** One production client: the same app, auth and Firestore wiring the app uses. */
async function connectProductionClient(): Promise<{ uid: string; db: Firestore }> {  const app: FirebaseApp = getApps()[0] ?? initializeApp(getFirebaseWebConfig());

  const [authHost, authPort] = (process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099').split(
    ':'
  );
  connectAuthEmulator(getAuth(app), `http://${authHost}:${authPort}`, { disableWarnings: true });

  const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  const db = getFirestore(app, FIRESTORE_DATABASE_ID);
  connectFirestoreEmulator(db, fsHost, Number(fsPort));

  try {
    const credential = await signInAnonymously(getAuth(app));
    return { uid: credential.user.uid, db };
  } catch {
    // Account creation is the emulator's most permissive path; anonymous
    // sign-in is faster but depends on the provider being enabled.
    const credential = await createUserWithEmailAndPassword(
      getAuth(app),
      `member-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      'password'
    );
    return { uid: credential.user.uid, db };
  }
}

/**
 * Makes `uid` an approved member.
 *
 * The client reads database `default` (see `FIRESTORE_DATABASE_ID`), which is
 * not the database `withSecurityRulesDisabled` writes to, so seeding goes
 * through the Admin SDK against the emulator - the same way `scripts/` seed
 * production. Admin writes bypass rules by construction, so nothing about the
 * security model is relaxed for the code under test.
 */
async function seedApprovedMember(uid: string): Promise<void> {
  const app = getAdminApps()[0] ?? initializeAdminApp({ projectId: PROJECT });
  const db = getAdminFirestore(app, FIRESTORE_DATABASE_ID);
  await db.doc(`users/${uid}`).set({
    id: uid,
    email: `${uid}@test.local`,
    displayName: 'Realtime Test Member',
    username: uid.slice(0, 12),
    role: 'student',
    status: 'approved',
    reputation: 0,
    badges: [],
    photoURL: '',
    department: 'CSE',
    year: 3,
    batch: '2026',
    bio: '',
    skills: [],
    answersCount: 0,
    doubtsCount: 0,
    followersCount: 0,
    followingCount: 0,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  });
}

realtimeSuite('realtime messaging (emulator, two real accounts)', () => {
  const role = process.env.REALTIME_ROLE === 'sender' ? 'sender' : 'receiver';
  let env: RulesTestEnvironment;

  const listCalls = { conversations: 0, messages: 0, cursors: 0 };
  const streamErrors: unknown[] = [];
  const original = {
    listConversations: firebaseMessagingAdapter.listConversations,
    listMessages: firebaseMessagingAdapter.listMessages,
    listReadCursors: firebaseMessagingAdapter.listReadCursors
  };

  function logStreamError(error: unknown): void {
    streamErrors.push(error);
    appendFileSync(RECEIVER_LOG, `[stream error] ${String(error)}\n`);
  }

  beforeAll(async () => {
    // If either side ever falls back to a one-shot read this test must fail
    // rather than quietly pass: realtime has to be the only path.
    firebaseMessagingAdapter.listConversations = async (...args) => {
      listCalls.conversations += 1;
      return original.listConversations(...args);
    };
    firebaseMessagingAdapter.listMessages = async (...args) => {
      listCalls.messages += 1;
      return original.listMessages(...args);
    };
    firebaseMessagingAdapter.listReadCursors = async (...args) => {
      listCalls.cursors += 1;
      return original.listReadCursors(...args);
    };

    mkdirSync(markerDir, { recursive: true });
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: {
        rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8')
      }
    });
  }, 60_000);

  afterAll(async () => {
    firebaseMessagingAdapter.listConversations = original.listConversations;
    firebaseMessagingAdapter.listMessages = original.listMessages;
    firebaseMessagingAdapter.listReadCursors = original.listReadCursors;
    await env?.cleanup();
  });

  it('delivers a message to the other account with no refresh and no refetch', async () => {
    if (role === 'sender') {
      await runSender();
      return;
    }
    await runReceiver();

    /** Account A: listens, then spawns account B in its own process. */
    async function runReceiver(): Promise<void> {
      for (const file of [PEER, READY, SENT, SENDER_LOG, RECEIVER_LOG]) rmSync(file, { force: true });

      const { uid: receiverUid } = await connectProductionClient();
      await seedApprovedMember(receiverUid);

      const previews: string[] = [];
      const messages: string[] = [];
      const stops: Array<() => void> = [];

      stops.push(
        firebaseMessagingAdapter.subscribeToConversations(receiverUid, {
          onData: records => records.forEach(record => previews.push(record.lastMessagePreview)),
          onError: error => logStreamError(error)
        })
      );

      // Tell account B this account is live, and spawn it as a genuinely
      // separate client process before waiting on anything it produces.
      writeFileSync(READY, receiverUid);
      const child = spawn(
        process.execPath,
        [
          path.join(ROOT, 'node_modules/vitest/vitest.mjs'),
          'run',
          'src/security/realtimeMessaging.test.ts',
          '-t',
          'delivers a message'
        ],
        {
          cwd: ROOT,
          env: { ...process.env, REALTIME_ROLE: 'sender' },
          stdio: ['ignore', 'pipe', 'pipe']
        }
      );
      let childOutput = '';
      const capture = (chunk: unknown) => {
        const text = String(chunk);
        childOutput += text;
        appendFileSync(SENDER_LOG, text);
      };
      child.stdout?.on('data', capture);
      child.stderr?.on('data', capture);
      const childExit = new Promise<number | null>(resolve => child.on('close', resolve));

      // Account B identifies itself, so the thread id can be derived exactly
      // as `messageService` derives it, and its stream opened in advance.
      try {
        await waitFor(PEER, 90_000);
      } catch (error) {
        child.kill();
        throw error;
      }
      const peerUid = readFileSync(PEER, 'utf8').trim();

      stops.push(
        firebaseMessagingAdapter.subscribeToMessages(conversationIdFor(receiverUid, peerUid), {
          onData: snapshot => snapshot.forEach(message => messages.push(message.text)),
          onError: error => logStreamError(error)
        })
      );

      await waitFor(SENT, 90_000);
      const senderUid = readFileSync(SENT, 'utf8').trim();
      const exitCode = await childExit;

      // Let the last snapshot land, then tear the streams down.
      await new Promise(resolve => setTimeout(resolve, 1500));
      stops.forEach(stop => stop());

      expect(exitCode, `sender process failed:\n${childOutput}`).toBe(0);
      expect(senderUid).not.toBe(receiverUid);
      expect(streamErrors).toEqual([]);
      expect(previews.some(preview => preview.includes('hello from the other account'))).toBe(true);
      expect(messages).toContain('hello from the other account');
      // No part of this path may fall back to a one-shot read.
      expect(listCalls).toEqual({ conversations: 0, messages: 0, cursors: 0 });
    }

    /** Account B: a separate process, identified only by the peer marker. */
    async function runSender(): Promise<void> {
      const step = (label: string) => appendFileSync(SENDER_LOG, `\n[step] ${label}\n`);

      step('waiting for ready');
      await waitFor(READY, 90_000);
      const receiverUid = readFileSync(READY, 'utf8').trim();

      step('connecting');
      const client = await connectProductionClient();
      const senderUid = client.uid;
      expect(senderUid).not.toBe(receiverUid);
      step(`signed in as ${senderUid} (project ${getFirebaseWebConfig().projectId}/${process.env.GCLOUD_PROJECT ?? 'unset'})`);
      await seedApprovedMember(senderUid);
      step('seeded approved');

      // Both profiles must be readable and approved before the thread is
      // touched; the rules refuse anything else.
      for (const member of [senderUid, receiverUid].sort()) {
        const snapshot = await getDoc(doc(client.db, 'users', member));
        expect(snapshot.exists(), `users/${member} must be visible to the client`).toBe(true);
        expect(snapshot.data()?.status, `users/${member} must be approved`).toBe('approved');
      }

      // The thread has to exist before the other side subscribes to it: the
      // rules make a message read conditional on the parent conversation.
      const thread = await firebaseMessagingAdapter.ensureConversation(senderUid, receiverUid);
      step(`conversation ${thread.id}`);
      writeFileSync(PEER, senderUid);

      await firebaseMessagingAdapter.sendMessage({
        conversationId: thread.id,
        senderId: senderUid,
        receiverId: receiverUid,
        text: 'hello from the other account'
      });
      step('sent');
      writeFileSync(SENT, senderUid);
    }
  }, 300_000);
});
