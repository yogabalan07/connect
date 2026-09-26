import { useMemo } from 'react';
import { Doubt, User } from '../types';
import { useDoubtsStore, canViewDoubt, doubtService } from '../services/doubtService';
import { useAuth } from './useAuth';

/**
 * Doubt feed access.
 *
 * `doubts` is already filtered by the private-doubt rule for the signed-in
 * user (deny by default). Use `getDoubtById` when you need the raw document
 * so a detail page can show a "restricted" screen instead of 404.
 */
export function useDoubts() {
  const state = useDoubtsStore();
  const { currentUser } = useAuth();

  const doubts = useMemo(
    () => state.doubts.filter(d => canViewDoubt(d, currentUser)),
    [state.doubts, currentUser]
  );

  const getDoubtById = useMemo(() => {
    return (id: string): Doubt | undefined => doubtService.getById(id);
  }, [state.doubts]);

  const canView = useMemo(() => {
    return (doubt: Doubt): boolean => canViewDoubt(doubt, currentUser);
  }, [currentUser]);

  return {
    doubts,
    status: state.status,
    getDoubtById,
    canView
  };
}

/** Standalone access check for components outside the hook. */
export function useCanViewDoubt(): (doubt: Doubt, viewer?: User | null) => boolean {
  const { currentUser } = useAuth();
  return (doubt: Doubt) => canViewDoubt(doubt, currentUser);
}
