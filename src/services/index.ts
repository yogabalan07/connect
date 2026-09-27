/**
 * Service barrel + bootstrapping.
 *
 * UI  ->  hooks/context  ->  services  ->  adapters (Firebase Authentication
 * and Firestore; tests inject in-memory doubles through `setAuthAdapter` /
 * `setUserAdapter`).
 *
 * `bootstrapServices` starts each store's first read. Stores render
 * skeletons while that read is in flight and an adapter failure is captured
 * as a typed store status instead of an exception.
 */
import { userService } from './userService';
import { doubtService } from './doubtService';
import { answerService } from './answerService';
import { notificationService } from './notificationService';
import { messageService } from './messageService';
import { socialService } from './socialService';
import { catalogService } from './catalogService';
import { adminService } from './adminService';
import { reportService } from './reportService';

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
  reportService
};
