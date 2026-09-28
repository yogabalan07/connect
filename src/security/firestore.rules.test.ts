import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

/**
 * Phase 21: the rules are the product's security model, so they are tested
 * against the real Firestore emulator rather than reasoned about.
 *
 * The whole suite is skipped when no emulator is running (`npm run test`)
 * and runs under `npm run test:rules`, which wraps the suite in
 * `firebase emulators:exec`. That keeps the default `npm run test` green on
 * machines without a JDK while still making the rules executable.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const rulesSuite = hasEmulator ? describe : describe.skip;

const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-connect-rules';
const NOW = Date.now();

const ALICE = 'alice';
const BOB = 'bob';
const MALLORY = 'mallory';
const ROOT = 'root';

type Role = 'student' | 'admin';

function profile(uid: string, role: Role = 'student', status = 'approved') {
  return {
    id: uid,
    email: `${uid}@college.edu`,
    displayName: uid.toUpperCase(),
    username: uid,
    role,
    status,
    reputation: 0,
    badges: [] as string[],
    photoURL: '',
    department: 'CSE',
    year: 3,
    batch: '2026',
    bio: '',
    skills: [] as string[],
    answersCount: 0,
    doubtsCount: 0,
    followersCount: 0,
    followingCount: 0,
    createdAtMs: NOW,
    updatedAtMs: NOW
  };
}

function doubtOf(id: string, authorId: string, authorRole: Role, allowed: string[] = []) {
  return {
    id,
    authorId,
    authorSnapshot: { id: authorId, role: authorRole, displayName: authorId.toUpperCase() },
    title: 'How do I centre a div?',
    description: 'Everything I try pushes it off screen.',
    category: 'Web Development',
    subject: 'CSS',
    tags: ['css', 'layout'],
    visibility: allowed.length > 0 ? 'private' : 'public',
    allowedUserIds: allowed,
    priority: 'normal',
    codeSnippet: null,
    attachments: [],
    mentions: [],
    mentionIds: [],
    upvotes: 0,
    downvotes: 0,
    views: 0,
    answersCount: 0,
    hasAcceptedAnswer: false,
    acceptedAnswerId: null,
    lastAnswerId: null,
    isPinned: false,
    createdAtMs: NOW,
    updatedAtMs: NOW
  };
}

function reportOf(id: string, reporterId: string) {
  return {
    id,
    targetType: 'doubt',
    targetId: 'd1',
    targetTitle: 'How do I centre a div?',
    reporterId,
    reporterName: reporterId.toUpperCase(),
    reportedUserId: MALLORY,
    reportedUserName: 'MALLORY',
    reason: 'Spam',
    description: 'Repeated posting.',
    status: 'pending',
    resolvedById: '',
    resolvedAtMs: 0,
    resolutionNote: '',
    createdAtMs: NOW
  };
}

function announcementOf(id: string, authorId: string) {
  return {
    id,
    authorId,
    authorName: 'ROOT',
    title: 'Mid-term timetable',
    content: 'Exams start Monday.',
    priority: 'normal',
    targetAudience: 'all',
    isActive: true,
    createdAtMs: NOW,
    updatedAtMs: NOW
  };
}

function auditOf(id: string, actorId: string) {
  return {
    id,
    actorId,
    actorName: actorId.toUpperCase(),
    action: 'Approved member',
    target: ALICE,
    type: 'user',
    createdAtMs: NOW
  };
}

function warningOf(id: string, issuedById: string) {
  return {
    id,
    userId: MALLORY,
    userName: 'Mallory',
    reason: 'Repeatedly posting the same question.',
    issuedById,
    issuedByName: 'ROOT',
    createdAtMs: NOW
  };
}

function conversationOf(id: string, participants: string[]) {
  const createdAtMs = Date.now();
  return {
    id,
    participants,
    createdAtMs,
    updatedAtMs: createdAtMs,
    lastMessageAtMs: 0,
    lastMessageSenderId: '',
    lastMessagePreview: ''
  };
}

function messageOf(id: string, conversationId: string, senderId: string, receiverId: string) {
  return {
    id,
    conversationId,
    senderId,
    receiverId,
    text: 'Can you take a look at this?',
    codeSnippet: null,
    createdAtMs: Date.now()
  };
}

function readOf(conversationId: string, uid: string) {
  return {
    id: `${conversationId}_${uid}`,
    conversationId,
    userId: uid,
    lastReadAtMs: Date.now()
  };
}

rulesSuite('firestore.rules (emulator)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: {
        rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8')
      }
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [uid, role, status] of [
        [ALICE, 'student', 'approved'],
        [BOB, 'student', 'approved'],
        [MALLORY, 'student', 'approved'],
        [ROOT, 'admin', 'approved'],
        ['pending', 'student', 'pending'],
        ['blocked', 'student', 'blocked']
      ] as const) {
        await setDoc(doc(db, 'users', uid), profile(uid, role, status));
      }
      await setDoc(doc(db, 'doubts', 'd1'), doubtOf('d1', ALICE, 'student'));
      await setDoc(doc(db, 'doubts', 'dprivate'), doubtOf('dprivate', ALICE, 'student', [ALICE, MALLORY]));
    });
  });

  const as = (uid: string | null) =>
    uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

  // ------------------------------------------------------------ directory

  describe('the member directory', () => {
    it('refuses an anonymous profile create', async () => {
      await assertFails(setDoc(doc(as(null), 'users', 'ghost'), profile('ghost')));
    });

    it('lets an approved member edit their own display data', async () => {
      const db = as(ALICE);
      await assertSucceeds(
        updateDoc(doc(db, 'users', ALICE), { bio: 'Second year, CSE.', updatedAt: new Date() })
      );
    });

    it('refuses a member elevating their own role', async () => {
      const db = as(ALICE);
      await assertFails(updateDoc(doc(db, 'users', ALICE), { role: 'admin' }));
    });

    it('refuses a blocked member approving themselves', async () => {
      const db = as('blocked');
      await assertFails(updateDoc(doc(db, 'users', 'blocked'), { status: 'approved' }));
    });

    it('lets an admin approve a pending member', async () => {
      const db = as(ROOT);
      await assertSucceeds(updateDoc(doc(db, 'users', 'pending'), { status: 'approved' }));
    });

    it('refuses an admin demoting themselves out of the system', async () => {
      const db = as(ROOT);
      await assertFails(updateDoc(doc(db, 'users', ROOT), { status: 'blocked' }));
    });
  });

  // -------------------------------------------------------------- doubts

  describe('the doubt feed', () => {
    it('lets an approved member publish a public doubt', async () => {
      const db = as(ALICE);
      await assertSucceeds(setDoc(doc(db, 'doubts', 'd2'), doubtOf('d2', ALICE, 'student')));
    });

    it('refuses a pending member publishing anything', async () => {
      const db = as('pending');
      await assertFails(setDoc(doc(db, 'doubts', 'd2'), doubtOf('d2', 'pending', 'student')));
    });

    it('refuses a doubt whose author is not the caller', async () => {
      const db = as(MALLORY);
      await assertFails(setDoc(doc(db, 'doubts', 'd2'), doubtOf('d2', ALICE, 'student')));
    });

    it('reads a public doubt for any approved member', async () => {
      await assertSucceeds(getDoc(doc(as(BOB), 'doubts', 'd1')));
    });

    it('keeps a private doubt unreadable to a member who was not invited', async () => {
      await assertFails(getDoc(doc(as(BOB), 'doubts', 'dprivate')));
    });

    it('keeps a private doubt unreadable to a pending member', async () => {
      await assertFails(getDoc(doc(as('pending'), 'doubts', 'dprivate')));
    });

    it('reads a private doubt for an invited member', async () => {
      await assertSucceeds(getDoc(doc(as(MALLORY), 'doubts', 'dprivate')));
    });

    it('refuses an unfiltered list of the collection', async () => {
      await assertFails(getDocs(query(collection(as(BOB), 'doubts'))));
    });

    it('accepts the scoped public feed query', async () => {
      const snapshot = await assertSucceeds(
        getDocs(query(collection(as(BOB), 'doubts'), where('visibility', '==', 'public')))
      );
      expect(snapshot.docs.length).toBeGreaterThan(0);
    });

    it('refuses a non-author rewriting the author field', async () => {
      await assertFails(updateDoc(doc(as(BOB), 'doubts', 'd1'), { authorId: BOB }));
    });

    it('lets the author edit their own question body', async () => {
      await assertSucceeds(
        updateDoc(doc(as(ALICE), 'doubts', 'd1'), {
          title: 'How do I centre a div?',
          description: 'Still stuck.',
          updatedAtMs: Date.now()
        })
      );
    });

    it('refuses a student pinning a question', async () => {
      await assertFails(updateDoc(doc(as(BOB), 'doubts', 'd1'), { isPinned: true }));
    });

    it('lets an admin pin a question', async () => {
      await assertSucceeds(updateDoc(doc(as(ROOT), 'doubts', 'd1'), { isPinned: true }));
    });

    it('refuses a non-author deleting someone else question', async () => {
      await assertFails(deleteDoc(doc(as(BOB), 'doubts', 'd1')));
    });

    it('lets the author delete their own question', async () => {
      await assertSucceeds(deleteDoc(doc(as(ALICE), 'doubts', 'd1')));
    });
  });

  // ------------------------------------------------------------- reports

  describe('the moderation queue', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'reports', 'doubt_d1_alice'), reportOf('doubt_d1_alice', ALICE));
      });
    });

    it('files a report under the deterministic id the rules rebuild', async () => {
      await assertSucceeds(
        setDoc(doc(as(BOB), 'reports', 'doubt_d1_bob'), reportOf('doubt_d1_bob', BOB))
      );
    });

    it('refuses the same member filing the same case twice', async () => {
      await assertFails(
        setDoc(doc(as(ALICE), 'reports', 'doubt_d1_alice'), reportOf('doubt_d1_alice', ALICE))
      );
    });

    it('refuses an id that does not encode the reporter', async () => {
      await assertFails(
        setDoc(doc(as(BOB), 'reports', 'doubt_d1_alice'), reportOf('doubt_d1_alice', BOB))
      );
    });

    it('hides the queue from an ordinary member', async () => {
      await assertFails(getDoc(doc(as(BOB), 'reports', 'doubt_d1_alice')));
      await assertFails(getDocs(collection(as(BOB), 'reports')));
    });

    it('shows the queue to a moderator', async () => {
      await assertSucceeds(getDocs(collection(as(ROOT), 'reports')));
    });

    it('lets a moderator dismiss a case', async () => {
      const db = as(ROOT);
      await assertSucceeds(
        updateDoc(doc(db, 'reports', 'doubt_d1_alice'), {
          status: 'dismissed',
          resolvedById: ROOT,
          resolvedAtMs: Date.now(),
          resolutionNote: 'Dismissed as a false positive.'
        })
      );
    });

    it('refuses a decision filed under somebody else name', async () => {
      const db = as(ROOT);
      await assertFails(
        updateDoc(doc(db, 'reports', 'doubt_d1_alice'), {
          status: 'resolved',
          resolvedById: ALICE,
          resolvedAtMs: Date.now(),
          resolutionNote: 'Content removed.'
        })
      );
    });

    it('refuses a non-moderator closing a case at all', async () => {
      const db = as(BOB);
      await assertFails(
        updateDoc(doc(db, 'reports', 'doubt_d1_alice'), {
          status: 'dismissed',
          resolvedById: BOB,
          resolvedAtMs: Date.now(),
          resolutionNote: 'nothing to see'
        })
      );
    });

    it('refuses a reopen that still claims a resolution', async () => {
      const db = as(ROOT);
      await assertFails(
        updateDoc(doc(db, 'reports', 'doubt_d1_alice'), {
          status: 'pending',
          resolvedById: ROOT,
          resolvedAtMs: Date.now(),
          resolutionNote: 'kept'
        })
      );
    });
  });

  // -------------------------------------------------------- announcements

  describe('official announcements', () => {
    it('refuses an ordinary member publishing one', async () => {
      await assertFails(
        setDoc(doc(as(ALICE), 'announcements', 'a1'), announcementOf('a1', ALICE))
      );
    });

    it('lets a moderator publish one', async () => {
      await assertSucceeds(
        setDoc(doc(as(ROOT), 'announcements', 'a1'), announcementOf('a1', ROOT))
      );
    });

    it('is readable by every approved member', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'announcements', 'a1'), announcementOf('a1', ROOT));
      });
      await assertSucceeds(getDoc(doc(as(BOB), 'announcements', 'a1')));
      await assertFails(getDoc(doc(as('pending'), 'announcements', 'a1')));
    });

    it('refuses rewriting the pinned author', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'announcements', 'a1'), announcementOf('a1', ROOT));
      });
      await assertFails(updateDoc(doc(as(ROOT), 'announcements', 'a1'), { authorId: ALICE }));
    });

    it('lets a moderator restate a notice', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'announcements', 'a1'), announcementOf('a1', ROOT));
      });
      await assertSucceeds(
        updateDoc(doc(as(ROOT), 'announcements', 'a1'), {
          priority: 'urgent',
          updatedAtMs: Date.now()
        })
      );
    });
  });

  // --------------------------------------------------------- audit trail

  describe('the audit trail', () => {
    it('refuses a member writing a row at all', async () => {
      await assertFails(setDoc(doc(as(ALICE), 'auditLogs', 'l1'), auditOf('l1', ALICE)));
    });

    it('lets a moderator append a row', async () => {
      await assertSucceeds(setDoc(doc(as(ROOT), 'auditLogs', 'l1'), auditOf('l1', ROOT)));
    });

    it('refuses a row filed under somebody else name', async () => {
      await assertFails(setDoc(doc(as(ROOT), 'auditLogs', 'l1'), auditOf('l1', ALICE)));
    });

    it('is append-only, even for a moderator', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'auditLogs', 'l1'), auditOf('l1', ROOT));
      });
      await assertFails(updateDoc(doc(as(ROOT), 'auditLogs', 'l1'), { action: 'Rewritten' }));
    });

    it('hides the trail from an ordinary member', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'auditLogs', 'l1'), auditOf('l1', ROOT));
      });
      await assertFails(getDocs(collection(as(ALICE), 'auditLogs')));
      await assertSucceeds(getDocs(collection(as(ROOT), 'auditLogs')));
    });
  });

  // ------------------------------------------------------------ warnings

  describe('academic warnings', () => {
    it('refuses an ordinary member issuing one', async () => {
      await assertFails(setDoc(doc(as(ALICE), 'warnings', 'w1'), warningOf('w1', ALICE)));
    });

    it('refuses a moderator issuing one under another moderator name', async () => {
      await assertFails(setDoc(doc(as(ROOT), 'warnings', 'w1'), warningOf('w1', ALICE)));
    });

    it('lets a moderator issue one', async () => {
      await assertSucceeds(setDoc(doc(as(ROOT), 'warnings', 'w1'), warningOf('w1', ROOT)));
    });

    it('hides the record from the member it names', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'warnings', 'w1'), warningOf('w1', ROOT));
      });
      await assertFails(getDoc(doc(as(MALLORY), 'warnings', 'w1')));
      await assertSucceeds(getDoc(doc(as(ROOT), 'warnings', 'w1')));
    });
  });

  // ------------------------------------------------------- admin settings

  describe('the moderation policy', () => {
    const settings = (updatedBy: string) => ({
      id: 'singleton',
      requireFacultyApproval: true,
      autoFlagSpamWords: true,
      allowedDomain: 'college.edu',
      minRepToComment: 0,
      updatedAtMs: Date.now(),
      updatedBy
    });

    it('refuses a student reading the policy', async () => {
      await assertFails(getDoc(doc(as(ALICE), 'adminSettings', 'singleton')));
    });

    it('lets a moderator create the policy', async () => {
      await assertSucceeds(setDoc(doc(as(ROOT), 'adminSettings', 'singleton'), settings(ROOT)));
    });

    it('refuses a policy written by somebody else', async () => {
      await assertFails(setDoc(doc(as(ROOT), 'adminSettings', 'singleton'), settings(ALICE)));
    });

    it('refuses a policy whose domain has a space in it', async () => {
      const bad = { ...settings(ROOT), allowedDomain: 'col lege.edu' };
      await assertFails(setDoc(doc(as(ROOT), 'adminSettings', 'singleton'), bad));
    });

    it('refuses a student editing the policy', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'adminSettings', 'singleton'), settings(ROOT));
      });
      await assertFails(updateDoc(doc(as(ALICE), 'adminSettings', 'singleton'), { minRepToComment: 50 }));
    });
  });

  // ------------------------------------------------------------ messaging

  describe('direct messaging', () => {
    const PAIR_ID = `${ALICE}_${BOB}`;

    it('lets the caller open the one conversation a pair owns', async () => {
      await assertSucceeds(
        setDoc(doc(as(ALICE), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]))
      );
    });

    it('lets the other member open that same conversation from their side', async () => {
      await assertSucceeds(
        setDoc(doc(as(BOB), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]))
      );
    });

    it('refuses a conversation that does not name the caller', async () => {
      const id = `${BOB}_${MALLORY}`;
      await assertFails(setDoc(doc(as(ALICE), 'conversations', id), conversationOf(id, [BOB, MALLORY])));
    });

    it('refuses a conversation written out of order', async () => {
      await assertFails(setDoc(doc(as(ALICE), 'conversations', 'bob_alice'), conversationOf('bob_alice', [BOB, ALICE])));
    });

    it('refuses a conversation naming a pending member', async () => {
      const id = `${ALICE}_pending`;
      await assertFails(setDoc(doc(as(ALICE), 'conversations', id), conversationOf(id, [ALICE, 'pending'])));
    });

    it('keeps a thread unreadable to a stranger who knows the id', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      await assertSucceeds(getDoc(doc(as(ALICE), 'conversations', PAIR_ID)));
      await assertFails(getDoc(doc(as(MALLORY), 'conversations', PAIR_ID)));
      await assertFails(getDocs(collection(as(MALLORY), 'conversations')));
    });

    it('lists my threads with a scoped array-contains query', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      const snapshot = await assertSucceeds(
        getDocs(query(collection(as(ALICE), 'conversations'), where('participants', 'array-contains', ALICE)))
      );
      expect(snapshot.docs.length).toBe(1);
    });

    it('refuses an unfiltered list of every conversation', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      await assertFails(getDocs(collection(as(ALICE), 'conversations')));
    });

    it('lets a member move the summary but never the participants', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      await assertSucceeds(
        updateDoc(doc(as(ALICE), 'conversations', PAIR_ID), {
          updatedAtMs: Date.now(),
          lastMessageAtMs: Date.now(),
          lastMessageSenderId: ALICE,
          lastMessagePreview: 'Can you look at this?'
        })
      );
      await assertFails(updateDoc(doc(as(ALICE), 'conversations', PAIR_ID), { participants: [ALICE, MALLORY] }));
    });

    it('lets a member send into their own thread and refuses a stranger', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      const message = messageOf('m1', PAIR_ID, ALICE, BOB);
      await assertSucceeds(setDoc(doc(as(ALICE), 'conversations', PAIR_ID, 'messages', 'm1'), message));
      await assertFails(setDoc(doc(as(MALLORY), 'conversations', PAIR_ID, 'messages', 'm2'), {
        ...messageOf('m2', PAIR_ID, MALLORY, BOB),
        senderId: MALLORY
      }));
      await assertFails(setDoc(doc(as(BOB), 'conversations', PAIR_ID, 'messages', 'm3'), {
        ...messageOf('m3', PAIR_ID, BOB, BOB)
      }));
    });

    it('refuses a message that lies about its thread', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      await assertFails(
        setDoc(doc(as(ALICE), 'conversations', PAIR_ID, 'messages', 'm1'), {
          ...messageOf('m1', PAIR_ID, ALICE, BOB),
          conversationId: `${ALICE}_${MALLORY}`
        })
      );
    });

    it('keeps messages immutable for everybody but their author', async () => {
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
        await setDoc(doc(db, 'conversations', PAIR_ID, 'messages', 'm1'), messageOf('m1', PAIR_ID, ALICE, BOB));
      });
      await assertFails(updateDoc(doc(as(ALICE), 'conversations', PAIR_ID, 'messages', 'm1'), { text: 'edited' }));
      await assertSucceeds(deleteDoc(doc(as(ALICE), 'conversations', PAIR_ID, 'messages', 'm1')));
    });

    it('lets each member move only their own read cursor, forwards only', async () => {
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
        await setDoc(doc(db, 'conversationReads', `${PAIR_ID}_${ALICE}`), readOf(PAIR_ID, ALICE));
      });

      const mine = doc(as(ALICE), 'conversationReads', `${PAIR_ID}_${ALICE}`);
      await assertSucceeds(updateDoc(mine, { lastReadAtMs: Date.now() + 5000 }));

      // The other member's receipt is not mine to write, or even to read.
      const theirs = doc(as(ALICE), 'conversationReads', `${PAIR_ID}_${BOB}`);
      await assertFails(setDoc(theirs, readOf(PAIR_ID, BOB)));
      await assertFails(getDoc(theirs));

      // A receipt cannot be rewound to make old messages look unreadable.
      await assertFails(updateDoc(mine, { lastReadAtMs: Date.now() - 60000 }));
    });

    it('refuses a read receipt for a thread the caller is not in', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'conversations', PAIR_ID), conversationOf(PAIR_ID, [ALICE, BOB]));
      });
      await assertFails(setDoc(doc(as(MALLORY), 'conversationReads', `${PAIR_ID}_${MALLORY}`), readOf(PAIR_ID, MALLORY)));
    });
  });

  // ---------------------------------------------------- deny by default

  it('closes every path the policy does not name', async () => {
    const db = as(ALICE);
    await assertFails(getDoc(doc(db, 'secrets', 'anything')));
    await assertFails(setDoc(doc(db, 'secrets', 'anything'), { value: 1 }));
  });
});
