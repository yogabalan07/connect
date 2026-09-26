import React from 'react';
import { Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserCard } from '../../components/cards/UserCard';

export const FollowingPage: React.FC = () => {
  const { users, followingUserIds } = useApp();

  const followingUsers = users.filter(u => followingUserIds.includes(u.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Following Feed</h1>
        <p className="text-xs text-slate-400 mt-1">
          Stay connected with senior mentors, research partners, and classmates
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {followingUsers.length > 0 ? (
          followingUsers.map(u => <UserCard key={u.id} user={u} />)
        ) : (
          <div className="col-span-3 p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <span>You are not following any students or mentors yet.</span>
          </div>
        )}
      </div>
    </div>
  );
};
