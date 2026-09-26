import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserStatus } from '../../types';
import {
  AccessDecision,
  AuthSnapshot,
  resolveAdminAccess,
  resolveAppAccess,
  resolveForbiddenAccess,
  resolveGuestAccess,
  resolveStatusAccess
} from '../../lib/routeAccess';

/**
 * Route guards.
 *
 * Every decision is delegated to the pure helpers in `lib/routeAccess` so the
 * rules are unit testable and the components stay trivial.
 *
 * NOTE: these guards are UX protection only. Real enforcement lives in
 * Firestore Security Rules + Firebase Auth custom claims (next phase).
 */

function RouteLoadingScreen(): React.ReactElement {
  return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">Restoring your session…</span>
    </div>
  );
}

interface RouteGuardProps {
  resolve: (auth: AuthSnapshot) => AccessDecision;
  children?: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ resolve, children }) => {
  const { isLoading, isAuthenticated, status, role } = useAuth();
  const decision = resolve({ isLoading, isAuthenticated, status, role });

  if (decision.type === 'loading') return <RouteLoadingScreen />;
  if (decision.type === 'redirect') return <Navigate to={decision.to} replace />;
  if (children) return <>{children}</>;
  return <Outlet />;
};

/** Signed-in, active users only (all /app routes). */
export const RequireAuth: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <RouteGuard resolve={resolveAppAccess}>{children}</RouteGuard>
);

/** Active admins only (/admin routes). Everyone else lands on /forbidden. */
export const RequireAdmin: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <RouteGuard resolve={resolveAdminAccess}>{children}</RouteGuard>
);

/** Signed-out users only (/login, /register, /forgot-password). */
export const RequireGuest: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <RouteGuard resolve={resolveGuestAccess}>{children}</RouteGuard>
);

/** Any signed-in active user may read the 403 page. */
export const RequireForbidden: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <RouteGuard resolve={resolveForbiddenAccess}>{children}</RouteGuard>
);

/** Status screens: /pending-approval, /rejected, /blocked. */
export const StatusGate: React.FC<{ status: UserStatus; children?: React.ReactNode }> = ({
  status,
  children
}) => (
  <RouteGuard resolve={auth => resolveStatusAccess(auth, status)}>{children}</RouteGuard>
);
