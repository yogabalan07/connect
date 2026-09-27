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

  /**
   * Records a detail-page visit. The Firestore rules allow at most `+1` per
   * write, and a rejected view increment is swallowed by the service so it
   * can never break the page.
   */
  const recordView = useMemo(() => {
    return (doubtId: string): void => {
      void doubtService.incrementViews(doubtId);
    };
  }, [state.doubts]);

  return {
    doubts,
    status: state.status,
    error: state.error,
    getDoubtById,
    canView,
    incrementViews: recordView,
    /** Re-runs the first feed read (used by an error state's retry button). */
    reload: () => {
      if (currentUser) void doubtService.loadAll(currentUser.id);
    }
  };
}

/** Standalone access check for components outside the hook. */
export function useCanViewDoubt(): (doubt: Doubt, viewer?: User | null) => boolean {
  const { currentUser } = useAuth();
  return (doubt: Doubt) => canViewDoubt(doubt, currentUser);
}
