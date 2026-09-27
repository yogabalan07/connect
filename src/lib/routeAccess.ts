import type { UserStatus, UserRole } from '../types';

/**
 * Pure routing decisions, deliberately kept free of React so they can be
 * unit tested and re-used by the guards.
 *
 * IMPORTANT: these guards are UX protection only. Real enforcement will
 * come from Firestore Security Rules + Firebase Auth custom claims.
 */
export interface AuthSnapshot {
  isLoading: boolean;
  isAuthenticated: boolean;
  status: UserStatus | null;
  role: UserRole | null;
}

export type AccessDecision =
  | { type: 'loading' }
  | { type: 'allow' }
  | { type: 'redirect'; to: string };

const allow: AccessDecision = { type: 'allow' };
const loading: AccessDecision = { type: 'loading' };

function redirect(to: string): AccessDecision {
  return { type: 'redirect', to };
}

function statusHome(status: UserStatus | null): string {
  switch (status) {
    case 'pending':
      return '/pending-approval';
    case 'rejected':
      return '/rejected';
    case 'blocked':
      return '/blocked';
    default:
      return '/login';
  }
}

/** /app/* — only authenticated, active users. */
export function resolveAppAccess(auth: AuthSnapshot): AccessDecision {
  if (auth.isLoading) return loading;
  if (!auth.isAuthenticated || !auth.status) return redirect('/login');
  if (auth.status !== 'approved') return redirect(statusHome(auth.status));
  return allow;
}

/** /admin/* — active admins only, everyone else lands on /forbidden. */
export function resolveAdminAccess(auth: AuthSnapshot): AccessDecision {
  const app = resolveAppAccess(auth);
  if (app.type !== 'allow') return app;
  if (auth.role !== 'admin') return redirect('/forbidden');
  return allow;
}

/** /login, /register — already-signed-in active users go back to the app. */
export function resolveGuestAccess(auth: AuthSnapshot): AccessDecision {
  if (auth.isLoading) return loading;
  if (auth.isAuthenticated && auth.status === 'approved') return redirect('/app');
  return allow;
}

/** Status pages: /pending-approval, /rejected, /blocked. */
export function resolveStatusAccess(
  auth: AuthSnapshot,
  pageStatus: UserStatus
): AccessDecision {
  if (auth.isLoading) return loading;
  if (!auth.isAuthenticated || !auth.status) return redirect('/login');
  if (auth.status === pageStatus) return allow;
  if (auth.status === 'approved') return redirect('/app');
  return redirect(statusHome(auth.status));
}

/** /forbidden — any signed-in active user may read the denial page. */
export function resolveForbiddenAccess(auth: AuthSnapshot): AccessDecision {
  const app = resolveAppAccess(auth);
  if (app.type !== 'allow') return app;
  return allow;
}
