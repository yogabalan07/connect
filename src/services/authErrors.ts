import { ServiceError } from '../lib/errors';

/**
 * Firebase Auth error mapping.
 *
 * Every failure raised by the Firebase SDK is translated into the app's
 * existing `ServiceError` vocabulary so pages can keep using
 * `errorMessage()` / `ServiceResult` without knowing Firebase exists.
 *
 * - The original `auth/...` code is preserved on `ServiceError.code`.
 * - Messages are campus-friendly and never leak SDK internals.
 * - Sign-in failures collapse to one generic message so an attacker cannot
 *   enumerate which college emails have accounts.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid college email address.',
  'auth/missing-email': 'Enter your college email and password.',
  'auth/missing-password': 'Enter your college email and password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/user-disabled': 'This account has been disabled. Contact your department administrator.',
  'auth/email-already-in-use': 'An account with this college email already exists.',
  'auth/invalid-action-code': 'This link is invalid or has expired. Request a new one.',
  'auth/expired-action-code': 'This link is invalid or has expired. Request a new one.',
  'auth/requires-recent-login': 'Please sign in again before continuing.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/quota-exceeded': 'Too many requests right now. Try again in a few minutes.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed':
    'Email and password sign-in is not enabled for this Firebase project.',
  'auth/unauthorized-domain': 'This domain is not authorized for the Firebase project.',
  'auth/captcha-check-failed': 'Verification failed. Please try again.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/no-current-user': 'Sign in to continue.',
  'auth/internal-error': 'Authentication is temporarily unavailable. Please try again.',
  'auth/unavailable': 'Authentication is temporarily unavailable. Please try again.',
  'auth/timeout': 'The request timed out. Please try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled before it finished.'
};

export const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.';

/** Friendly copy for a Firebase Auth code (`undefined` → generic message). */
export function authErrorMessage(code: string | null | undefined): string {
  if (!code) return GENERIC_AUTH_ERROR;
  return AUTH_ERROR_MESSAGES[code] ?? GENERIC_AUTH_ERROR;
}

function readCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return null;
}

/**
 * Normalizes anything thrown by Firebase Auth (or by our own adapter) into a
 * `ServiceError`. Already-typed errors pass through untouched so configuration
 * problems (`firebase/not-configured`) keep their specific message.
 */
export function mapAuthError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  const code = readCode(error) ?? 'auth/internal-error';
  return new ServiceError(code, authErrorMessage(code));
}
