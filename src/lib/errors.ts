/**
 * Error vocabulary shared by the service layer.
 * Services either throw `ServiceError` (sync paths) or return a
 * `ServiceResult` (async paths) so the UI can surface real failures
 * instead of showing unconditional success messages.
 */
export class ServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(message: string): ServiceResult<T> {
  return { ok: false, message };
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
