import { ServiceError } from '../lib/errors';

/**
 * The identity acting on the doubt-domain backend.
 *
 * Adapters never reach for `auth.currentUser` themselves: the actor is
 * published once per session (by the app bootstrap that also triggers the
 * first content read) and passed explicitly to every adapter call that needs
 * an owner id. That keeps the adapter contract testable — a test can publish
 * any actor without a Firebase Auth instance.
 */
let actorId: string | null = null;

/** Publishes the acting identity (set on session restore, cleared on sign-out). */
export function setServiceActor(uid: string | null): void {
  actorId = uid;
}

export function getServiceActor(): string | null {
  return actorId;
}

/** Throws a typed, campus-friendly failure when nobody is signed in. */
export function requireServiceActor(): string {
  if (!actorId) {
    throw new ServiceError('auth/required', 'You must be signed in to do that.');
  }
  return actorId;
}
