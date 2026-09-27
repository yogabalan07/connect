import { describe, expect, it } from 'vitest';
import { ServiceError } from '../lib/errors';
import {
  GENERIC_FIRESTORE_ERROR,
  firestoreErrorMessage,
  mapFirestoreError
} from './firestoreErrors';

/**
 * Error boundary for the Firestore layer.
 *
 * Whatever the SDK throws (or whatever a document happens to contain), pages
 * only ever receive a typed `ServiceError` with a campus-friendly message:
 * no raw codes, no stack traces, no project identifiers.
 */
describe('mapFirestoreError', () => {
  it('maps a Firebase permission failure to friendly copy', () => {
    const mapped = mapFirestoreError({ code: 'permission-denied' });

    expect(mapped).toBeInstanceOf(ServiceError);
    expect(mapped.code).toBe('firestore/permission-denied');
    expect(mapped.message).toBe(
      'You do not have permission to do that. Contact your department administrator.'
    );
  });

  it('accepts prefixed and namespaced codes', () => {
    expect(mapFirestoreError({ code: 'firestore/unauthenticated' }).code).toBe(
      'firestore/unauthenticated'
    );
    expect(mapFirestoreError({ code: 'firestore:resource-exhausted' })).toMatchObject({
      code: 'firestore/resource-exhausted',
      message: 'Too many requests right now. Wait a moment and try again.'
    });
  });

  it('falls back to a generic message for unknown failures', () => {
    const mapped = mapFirestoreError(new Error('socket hang up'));

    expect(mapped.code).toBe('firestore/unknown');
    expect(mapped.message).toBe(GENERIC_FIRESTORE_ERROR);
    expect(mapped.message).not.toContain('socket hang up');
  });

  it('handles null, strings and non-objects without throwing', () => {
    expect(mapFirestoreError(null).code).toBe('firestore/unknown');
    expect(mapFirestoreError('boom').code).toBe('firestore/unknown');
    expect(mapFirestoreError(undefined).message).toBe(GENERIC_FIRESTORE_ERROR);
  });

  it('passes an already-typed ServiceError through untouched', () => {
    const original = new ServiceError('user/not-found', 'That account no longer exists.');

    const mapped = mapFirestoreError(original);

    expect(mapped).toBe(original);
    expect(mapped.code).toBe('user/not-found');
    expect(mapped.message).toBe('That account no longer exists.');
  });

  it('never leaks SDK internals into the message', () => {
    const sdkLike = {
      code: 'failed-precondition',
      name: 'FirebaseError',
      message: '[code=failed-precondition]: transaction already aborted at project connect-yb'
    };

    const mapped = mapFirestoreError(sdkLike);

    expect(mapped.message).toBe('That record changed elsewhere. Refresh the page and try again.');
    expect(mapped.message).not.toContain('connect-yb');
    expect(mapped.message).not.toContain('FirebaseError');
  });
});

describe('firestoreErrorMessage', () => {
  it('returns the copy for a known code', () => {
    expect(firestoreErrorMessage('unavailable')).toBe(
      'Campus services are unreachable right now. Check your connection and try again.'
    );
  });

  it('returns the generic copy for missing or unknown codes', () => {
    expect(firestoreErrorMessage(undefined)).toBe(GENERIC_FIRESTORE_ERROR);
    expect(firestoreErrorMessage(null)).toBe(GENERIC_FIRESTORE_ERROR);
    expect(firestoreErrorMessage('')).toBe(GENERIC_FIRESTORE_ERROR);
    expect(firestoreErrorMessage('made-up-code')).toBe(GENERIC_FIRESTORE_ERROR);
  });
});
