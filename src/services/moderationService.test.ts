import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminService } from './adminService';
import { reportService, REPORT_REASONS } from './reportService';
import { setModerationAdapter } from './moderationAdapter';
import {
  createFakeModerationAdapter,
  DENIED_COPY,
  type FakeModerationAdapter
} from './testing/fakeModerationAdapter';
import { makeUser } from './testing/contentFixtures';

/**
 * Reports, announcements, the audit trail, warnings and the moderation
 * policy all live behind `ModerationAdapter` now - the previous
 * session-only stores meant a report filed in one tab was invisible in the
 * next, and "saved" meant "until you refresh".
 */
const moderator = makeUser({ id: 'uid_mod', name: 'Mira Faculty', role: 'admin', status: 'approved' });
const reporter = makeUser({ id: 'uid_alice', name: 'Alice Kumar', role: 'student', status: 'approved' });
const accused = makeUser({ id: 'uid_bob', name: 'Bob Mentor', role: 'mentor', status: 'approved' });

let fake: FakeModerationAdapter;

beforeEach(() => {
  fake = createFakeModerationAdapter();
  setModerationAdapter(fake);
  adminService.bootstrap();
  reportService.bootstrap();
});

afterEach(() => {
  setModerationAdapter(null);
  adminService.bootstrap();
  reportService.bootstrap();
});

function reportInput(overrides: Partial<Parameters<typeof reportService.createReport>[0]> = {}) {
  return {
    targetType: 'doubt' as const,
    targetId: 'doubt-42',
    targetTitle: 'Solved my homework for me',
    reporter,
    reportedUserId: accused.id,
    reportedUserName: accused.name,
    reason: 'Spam' as const,
    description: 'Posting paid assignment links in a public thread.',
    ...overrides
  };
}

describe('reportService.createReport', () => {
  it('persists with the deterministic id the rules rebuild', async () => {
    const result = await reportService.createReport(reportInput());

    expect(result.ok).toBe(true);
    expect(fake.reportRecords()).toHaveLength(1);
    expect(fake.reportRecords()[0].id).toBe('doubt_doubt-42_uid_alice');
    expect(reportService.store.get().reports[0].status).toBe('pending');
  });

  it('refuses a second report of the same target by the same member', async () => {
    await reportService.createReport(reportInput());
    const second = await reportService.createReport(reportInput());

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.message).toContain('already reported');
    expect(fake.reportRecords()).toHaveLength(1);
    expect(reportService.store.get().reports).toHaveLength(1);
  });

  it('lets a different member report the same target', async () => {
    await reportService.createReport(reportInput());
    const result = await reportService.createReport(
      reportInput({ reporter: moderator, targetTitle: 'Same target, other reporter' })
    );

    expect(result.ok).toBe(true);
    expect(fake.reportRecords()).toHaveLength(2);
  });

  it('rejects a missing target, an unknown reason and an oversized description', async () => {
    const missing = await reportService.createReport(reportInput({ targetId: '' }));
    const unknown = await reportService.createReport(
      reportInput({ reason: 'Not a real reason' as never })
    );
    const oversized = await reportService.createReport(
      reportInput({ description: 'x'.repeat(1001) })
    );

    expect(missing.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    expect(oversized.ok).toBe(false);
    expect(fake.reportRecords()).toHaveLength(0);
  });

  it('requires a real description when the reason is "Other"', async () => {
    const tooShort = await reportService.createReport(
      reportInput({ reason: 'Other', description: 'bad' })
    );
    const fine = await reportService.createReport(
      reportInput({ reason: 'Other', description: 'long enough description' })
    );

    expect(tooShort.ok).toBe(false);
    expect(fine.ok).toBe(true);
  });

  it('offers exactly the reasons the rules accept', () => {
    expect(REPORT_REASONS).toEqual([
      'Spam',
      'Wrong information',
      'Abusive content',
      'Inappropriate content',
      'Harassment',
      'Duplicate question',
      'Other'
    ]);
  });
});

describe('reportService.loadAll', () => {
  it('reads the queue and marks the store ready', async () => {
    await reportService.createReport(reportInput());

    await reportService.loadAll();

    expect(reportService.store.get().status).toBe('ready');
    expect(reportService.store.get().reports).toHaveLength(1);
  });

  it('captures a refused read as a typed error status with friendly copy', async () => {
    fake.setDenied(true);

    await expect(reportService.loadAll()).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: DENIED_COPY
    });
    expect(reportService.store.get()).toMatchObject({ status: 'error', reports: [] });
  });
});

describe('closing a case', () => {
  it('dismisses and records the decision on the audit trail', async () => {
    const created = await reportService.createReport(reportInput());
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : '';

    const result = await reportService.dismissReport(id, moderator);

    expect(result.ok).toBe(true);
    expect(fake.reportRecords()[0].status).toBe('dismissed');
    expect(fake.auditRecords()[0]).toMatchObject({
      actorId: moderator.id,
      actor: 'Mira Faculty',
      action: 'Dismissed report',
      type: 'moderation'
    });
  });

  it('resolves with the action taken and keeps the moderator accountable', async () => {
    const created = await reportService.createReport(reportInput());
    const id = created.ok ? created.data.id : '';

    await reportService.resolveReport(id, 'Content removed and member warned', moderator);

    expect(fake.reportRecords()[0]).toMatchObject({
      status: 'resolved',
      resolutionNote: 'Content removed and member warned',
      resolvedById: moderator.id
    });
    expect(fake.auditRecords()[0].action).toContain('Content removed');
  });

  it('reports a missing case instead of silently succeeding', async () => {
    const result = await reportService.dismissReport('doubt_nope_uid_alice', moderator);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe('That report no longer exists.');
  });
});

describe('issueWarning', () => {
  it('persists the warning and audits it', async () => {
    const result = await reportService.issueWarning(
      moderator,
      accused.id,
      accused.name,
      'Repeated off-topic posting'
    );

    expect(result.ok).toBe(true);
    expect(fake.warningRecords()[0]).toMatchObject({
      userId: accused.id,
      userName: accused.name,
      issuedById: moderator.id,
      issuedByName: 'Mira Faculty'
    });
    expect(fake.auditRecords()[0].action).toBe('Issued academic warning');
  });

  it('rejects a reason too short to be a record', async () => {
    const result = await reportService.issueWarning(moderator, accused.id, accused.name, 'no');

    expect(result.ok).toBe(false);
    expect(fake.warningRecords()).toHaveLength(0);
  });
});

describe('adminService.loadAll', () => {
  it('reads announcements, the audit trail, warnings and the policy document', async () => {
    await adminService.createAnnouncement(moderator, {
      title: 'Mid-terms',
      content: 'Doubt clearing runs all week.',
      priority: 'urgent',
      targetAudience: 'all'
    });
    await adminService.createWarning(moderator, accused.id, accused.name, 'Late submission');
    await adminService.saveAdminSettings({ minRepToComment: 20 }, moderator);

    await adminService.loadAll();

    const state = adminService.store.get();
    expect(state.status).toBe('ready');
    expect(state.announcements).toHaveLength(1);
    expect(state.warnings).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(0);
    expect(state.adminSettings.minRepToComment).toBe(20);
    expect(state.announcements[0].authorId).toBe(moderator.id);
  });

  it('keeps the built-in defaults when nobody has saved a policy yet', async () => {
    await adminService.loadAll();

    expect(adminService.getAdminSettings()).toMatchObject({
      requireFacultyApproval: true,
      allowedDomain: 'college.edu'
    });
  });

  it('captures a refused read with friendly copy', async () => {
    fake.setDenied(true);

    await expect(adminService.loadAll()).rejects.toMatchObject({
      code: 'firestore/permission-denied',
      message: DENIED_COPY
    });
    expect(adminService.store.get().status).toBe('error');
  });
});

describe('adminService.saveAdminSettings', () => {
  it('validates before touching the adapter and stamps the actor', async () => {
    const emptyDomain = await adminService.saveAdminSettings({ allowedDomain: '  ' }, moderator);
    const spaced = await adminService.saveAdminSettings({ allowedDomain: 'a b.com' }, moderator);
    const fractional = await adminService.saveAdminSettings({ minRepToComment: 1.5 }, moderator);
    const negative = await adminService.saveAdminSettings({ minRepToComment: -1 }, moderator);

    expect(emptyDomain.ok).toBe(false);
    expect(spaced.ok).toBe(false);
    expect(fractional.ok).toBe(false);
    expect(negative.ok).toBe(false);
    expect(fake.calls.saveAdminSettings).toBeUndefined();
  });

  it('persists a valid policy and returns it with a timestamp', async () => {
    const result = await adminService.saveAdminSettings(
      { allowedDomain: 'campus.edu', minRepToComment: 50 },
      moderator
    );

    expect(result.ok).toBe(true);
    expect(fake.settingsRecord()).toMatchObject({
      allowedDomain: 'campus.edu',
      minRepToComment: 50,
      updatedBy: moderator.id
    });
    expect(adminService.getAdminSettings().updatedAtMs).toBeGreaterThan(0);
  });

  it('surfaces a refused save as failure copy instead of a rejected promise', async () => {
    fake.setDenied(true);

    const result = await adminService.saveAdminSettings({ allowedDomain: 'campus.edu' }, moderator);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe(DENIED_COPY);
    expect(adminService.getAdminSettings().allowedDomain).toBe('college.edu');
  });
});

describe('adminService.createAnnouncement', () => {
  it('refuses a titleless or bodiless notice', async () => {
    await expect(
      adminService.createAnnouncement(moderator, {
        title: ' ',
        content: 'Body',
        priority: 'normal',
        targetAudience: 'all'
      })
    ).rejects.toThrow('Announcement title and body are required.');
    expect(fake.announcementRecords()).toHaveLength(0);
  });

  it('stamps the publishing admin, which the rules freeze forever', async () => {
    const created = await adminService.createAnnouncement(moderator, {
      title: '  Lab slots  ',
      content: '  Extra slots opened.  ',
      priority: 'low',
      targetAudience: 'CSE'
    });

    expect(created.authorId).toBe(moderator.id);
    expect(created.title).toBe('Lab slots');
    expect(created.isActive).toBe(true);
    expect(adminService.store.get().announcements).toHaveLength(1);
  });
});

describe('the audit trail', () => {
  it('appends with the acting member pinned as actorId', async () => {
    const created = await adminService.logAudit({
      actor: moderator,
      action: 'Blocked account',
      target: 'Bob Mentor',
      type: 'moderation'
    });

    expect(created.actorId).toBe(moderator.id);
    expect(created.actor).toBe('Mira Faculty');
    expect(adminService.store.get().auditLogs).toHaveLength(1);
  });

  it('logAuditSafely swallows a refused append so the action still stands', async () => {
    fake.setDenied(true);

    await expect(
      adminService.logAuditSafely({
        actor: moderator,
        action: 'Deleted question',
        target: 'title',
        type: 'doubt'
      })
    ).resolves.toBeUndefined();
    expect(adminService.store.get().auditLogs).toHaveLength(0);
  });
});
