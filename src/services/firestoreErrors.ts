import { ServiceError } from '../lib/errors';

/**
 * Firestore error mapping.
 *
 * Every SDK failure (`FirebaseError`, plain `Error`, timeout, …) is
 * translated into the app's `ServiceError` vocabulary before it reaches a
 * page. Raw codes (`permission-denied`, `failed-precondition`, …), stack
 * traces and project identifiers never reach the UI.
 *
 * Codes keep a `firestore/…` prefix so services can tell an auth failure
 * from a profile-store failure, while the message stays campus-friendly.
 */
const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': 'You do not have permission to do that. Contact your department administrator.',
  unauthenticated: 'Sign in to continue.',
  'not-found': 'That record no longer exists.',
  'already-exists': 'That record already exists.',
  'failed-precondition': 'That record changed elsewhere. Refresh the page and try again.',
  aborted: 'That record changed elsewhere. Refresh the page and try again.',
  'resource-exhausted': 'Too many requests right now. Wait a moment and try again.',
  'quota-exceeded': 'Too many requests right now. Wait a moment and try again.',
  'out-of-range': 'That request could not be processed.',
  'invalid-argument': 'That request could not be processed.',
  data_loss: 'We could not save that change. Please try again.',
  unavailable: 'Campus services are unreachable right now. Check your connection and try again.',
  'deadline-exceeded': 'The connection timed out. Check your connection and try again.',
  'network-request-failed': 'Network error. Check your connection and try again.',
  cancelled: 'That request was cancelled. Please try again.',
  internal: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.'
};

export const GENERIC_FIRESTORE_ERROR = 'Something went wrong. Please try again.';

/** Friendly copy for a Firestore/domain code (`undefined` → generic message). */
export function firestoreErrorMessage(code: string | null | undefined): string {
  if (!code) return GENERIC_FIRESTORE_ERROR;
  return FIRESTORE_ERROR_MESSAGES[code] ?? GENERIC_FIRESTORE_ERROR;
}

function readCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      // Firebase reports `permission-denied`; some SDKs report `firestore/…`.
      const colon = code.indexOf(':');
      const normalized = colon === -1 ? code : code.slice(colon + 1);
      const slash = normalized.lastIndexOf('/');
      return slash === -1 ? normalized : normalized.slice(slash + 1);
    }
  }
  return null;
}

/**
 * Normalizes anything thrown by Firestore (or by our own validation) into a
 * `ServiceError`. Already-typed errors pass through untouched so their code
 * and message stay stable for callers.
 */
export function mapFirestoreError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  const code = readCode(error);
  if (!code) {
    return new ServiceError('firestore/unknown', GENERIC_FIRESTORE_ERROR);
  }
  return new ServiceError(`firestore/${code}`, firestoreErrorMessage(code));
}
