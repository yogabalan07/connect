/**
 * Service barrel + bootstrapping.
 *
 * UI  ->  hooks/context  ->  services  ->  adapter (MOCK today, FIREBASE next)
 *
 * `bootstrapServices` is intentionally synchronous for the mock adapter so
 * the first paint has data ready. The Firebase adapter will keep stores in
 * `loading` until the first snapshot arrives, and pages already render
 * skeletons for that state.
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
