import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from './authService';

const uniqueEmail = `phase1_${Date.now()}@college.edu`;

const baseRegistration = {
  name: 'Phase One Tester',
  password: 'correct horse battery',
  department: 'CSE' as const,
  year: '2nd' as const,
  skills: ['React', 'Data Structures']
};

const makeRegistration = () => ({
  ...baseRegistration,
  email: `phase1_${Math.random().toString(36).slice(2, 10)}@college.edu`
});

beforeEach(() => {
  authService.signOut();
});

describe('authService.register', () => {
  it('creates a pending account and signs the user in', async () => {
    const input = makeRegistration();
    const result = await authService.register(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.email).toBe(input.email);
    expect(result.data.status).toBe('pending');
    expect(result.data.role).toBe('student');
    expect(authService.getSessionUid()).toBe(result.data.id);
    expect(authService.getCurrentUser()?.id).toBe(result.data.id);
  });

  it('rejects weak passwords', async () => {
    const result = await authService.register({ ...makeRegistration(), password: 'abc' });
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate emails without touching the session', async () => {
    const input = makeRegistration();
    const first = await authService.register(input);
    expect(first.ok).toBe(true);

    authService.signOut();
    const second = await authService.register(input);
    expect(second.ok).toBe(false);
    expect(authService.getSessionUid()).toBeNull();
  });
});

describe('authService.signIn', () => {
  it('accepts the registered credentials', async () => {
    const input = makeRegistration();
    const registered = await authService.register(input);
    expect(registered.ok).toBe(true);
    authService.signOut();

    const result = await authService.signIn(input.email, input.password);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(registered.ok ? registered.data.id : '');
    expect(authService.getSessionUid()).toBe(result.data.id);
  });

  it('rejects the wrong password', async () => {
    const input = makeRegistration();
    await authService.register(input);
    authService.signOut();

    const result = await authService.signIn(input.email, 'wrong password');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Email or password is incorrect.');
    expect(authService.getSessionUid()).toBeNull();
  });

  it('rejects unknown emails with the same generic message', async () => {
    const result = await authService.signIn('nobody@college.edu', 'whatever');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Email or password is incorrect.');
  });

  it('requires both fields', async () => {
    const empty = await authService.signIn('', '');
    expect(empty.ok).toBe(false);
  });
});

describe('authService.requestPasswordReset', () => {
  it('rejects malformed emails', async () => {
    const result = await authService.requestPasswordReset('not-an-email');
    expect(result.ok).toBe(false);
  });

  it('never claims that an email was actually sent', async () => {
    const result = await authService.requestPasswordReset(uniqueEmail);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toContain('once email delivery is enabled');
    expect(result.data.toLowerCase()).not.toContain('email sent');
  });
});

describe('authService.switchDevPersona (development only)', () => {
  it('signs in as an active admin persona', () => {
    const persona = authService.switchDevPersona('admin');
    expect(persona.role).toBe('admin');
    expect(persona.status).toBe('active');
    expect(authService.getSessionUid()).toBe(persona.id);
  });
});

describe('authService.signOut', () => {
  it('clears the session', async () => {
    await authService.register(makeRegistration());
    expect(authService.getSessionUid()).not.toBeNull();

    authService.signOut();
    expect(authService.getSessionUid()).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
  });
});
