import { describe, expect, it } from 'vitest';
import { ServiceError, errorMessage } from '../lib/errors';
import { GENERIC_AUTH_ERROR, authErrorMessage, mapAuthError } from './authErrors';

describe('mapAuthError', () => {
  it('keeps the original Firebase code and returns campus-friendly copy', () => {
    const error = mapAuthError({ code: 'auth/email-already-in-use', message: 'EMAIL_EXISTS' });

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe('auth/email-already-in-use');
    expect(error.message).toBe('An account with this college email already exists.');
    expect(error.message).not.toContain('EMAIL_EXISTS');
  });

  it('collapses every credential failure into one non-enumerating message', () => {
    const codes = ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'];
    for (const code of codes) {
      const error = mapAuthError({ code });
      expect(error.code).toBe(code);
      expect(error.message).toBe('Email or password is incorrect.');
    }
  });

  it('falls back safely for unknown codes and malformed errors', () => {
    // Unknown Firebase codes keep their code but never leak SDK internals.
    expect(mapAuthError({ code: 'auth/mystery-code' }).code).toBe('auth/mystery-code');
    expect(mapAuthError({ code: 'auth/mystery-code' }).message).toBe(GENERIC_AUTH_ERROR);

    // Errors without a code are treated as transient auth outages.
    for (const malformed of [new Error('boom'), 'boom', null, undefined, 42]) {
      const mapped = mapAuthError(malformed);
      expect(mapped).toBeInstanceOf(ServiceError);
      expect(mapped.code).toBe('auth/internal-error');
      expect(mapped.message).toBe('Authentication is temporarily unavailable. Please try again.');
    }
  });

  it('passes ServiceError through unchanged (e.g. firebase/not-configured)', () => {
    const original = new ServiceError('firebase/not-configured', 'Copy .env.example first.');
    const mapped = mapAuthError(original);

    expect(mapped).toBe(original);
    expect(mapped.code).toBe('firebase/not-configured');
  });

  it('integrates with the existing errorMessage helper', () => {
    expect(errorMessage(mapAuthError({ code: 'auth/too-many-requests' }))).toBe(
      'Too many attempts. Wait a moment and try again.'
    );
    expect(errorMessage(mapAuthError({ code: 'auth/unknown-thing' }))).toBe(GENERIC_AUTH_ERROR);
    expect(errorMessage(new ServiceError('auth/dev-only', 'Dev only.'))).toBe('Dev only.');
  });
});

describe('authErrorMessage', () => {
  it('resolves known codes and degrades safely on unknown ones', () => {
    expect(authErrorMessage('auth/weak-password')).toBe('Password must be at least 6 characters.');
    expect(authErrorMessage('auth/network-request-failed')).toContain('Network error');
    expect(authErrorMessage('auth/not-a-real-code')).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage('')).toBe(GENERIC_AUTH_ERROR);
  });
});
