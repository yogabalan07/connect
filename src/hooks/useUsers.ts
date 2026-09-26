import { useMemo } from 'react';
import { User } from '../types';
import { useUsersStore } from '../services/userService';

/** Read-only view of the user directory. */
export function useUsers() {
  const state = useUsersStore();

  const getUserById = useMemo(() => {
    return (userId: string | null | undefined): User | undefined =>
      state.users.find(u => u.id === userId);
  }, [state.users]);

  return {
    users: state.users,
    status: state.status,
    getUserById
  };
}
