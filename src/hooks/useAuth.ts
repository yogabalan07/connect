import { useAuthContext } from '../context/AuthContext';

/**
 * Public auth hook: current user, session state and auth commands.
 * Consumers never touch localStorage or credentials directly.
 */
export function useAuth() {
  return useAuthContext();
}
