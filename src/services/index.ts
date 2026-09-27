/**
 * Service barrel + bootstrapping.
 *
 * UI  ->  hooks/context  ->  services  ->  adapters (Firebase Authentication
 * and Firestore; tests inject in-memory doubles through `setAuthAdapter`,
 * `setUserAdapter` / `setContentAdapter`).
 *
 * `bootstrapServices` puts every store into `loading`; `loadContent` starts
 * the actual reads once a session exists (the Firestore rules only let
 * signed-in, approved members read content, so an anonymous boot must not
 * issue a request that is guaranteed to come back `permission-denied`).
 */
import { setServiceActor } from './actor';
import { userService } from './userService';
import { doubtService } from './doubtService';
import { answerService } from './answerService';
import { notificationService } from './notificationService';
import { messageService } from './messageService';
import { socialService } from './socialService';
import { catalogService } from './catalogService';
import { adminService } from './adminService';
import { reportService } from './reportService';
import * as badgeService from './badgeService';
import * as profileService from './profileService';
import * as reputationService from './reputationService';

let bootstrapped = false;

export function bootstrapServices(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  userService.bootstrap();
  doubtService.bootstrap();
  answerService.bootstrap();
  notificationService.bootstrap();
  messageService.bootstrap();
  socialService.bootstrap();
  catalogService.bootstrap();
  adminService.bootstrap();
  reportService.bootstrap();
  profileService.invalidateProfile();
}

/**
 * First content read for this session: doubts, catalogue, bookmarks/follows
 * and notifications, in parallel. Every store keeps `loading` until its own
 * adapter answers, so pages render skeletons instead of an empty feed.
 */
export async function loadContent(uid: string): Promise<void> {
  setServiceActor(uid);
  await Promise.all([
    doubtService.loadAll(uid),
    catalogService.loadAll(),
    socialService.loadAll(uid),
    notificationService.loadAll(uid)
  ]);
}

/** Drops the acting identity and returns every content store to `loading`. */
export function unloadContent(): void {
  setServiceActor(null);
  doubtService.bootstrap();
  answerService.bootstrap();
  notificationService.bootstrap();
  socialService.bootstrap();
  catalogService.bootstrap();
  profileService.invalidateProfile();
}

/** Test seam: restores the pristine boot state across every content store. */
export function resetContentServicesForTests(): void {
  setServiceActor(null);
  doubtService.bootstrap();
  answerService.bootstrap();
  notificationService.bootstrap();
  socialService.bootstrap();
  catalogService.bootstrap();
}

export {
  userService,
  doubtService,
  answerService,
  notificationService,
  messageService,
  socialService,
  catalogService,
  adminService,
  reportService,
  badgeService,
  profileService,
  reputationService
};
