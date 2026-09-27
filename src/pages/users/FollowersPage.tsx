import React from 'react';
import { Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserCard } from '../../components/cards/UserCard';

export const FollowersPage: React.FC = () => {
  const { users, currentUser } = useApp();

  if (!currentUser) return null;

  // Show peers who follow current user
  const followerUsers = users.filter(u => u.id !== currentUser.id && u.status === 'approved').slice(0, 9);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Your Academic Followers</h1>
        <p className="text-xs text-slate-400 mt-1">
          Students, juniors, and mentors following your solutions, doubts, and code reviews
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {followerUsers.map(u => (
          <UserCard key={u.id} user={u} />
        ))}
      </div>
    </div>
  );
};
