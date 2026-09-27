import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserCard } from '../../components/cards/UserCard';
import { profileService } from '../../services';
import type { Follow, User } from '../../types';

/**
 * Members a profile follows.
 *
 * Read from `follows/{target}_{follower}` filtered on `userId`, so the list
 * is the same document set the rules open to any approved member - not a
 * mirror of the signed-in member's own `followingUserIds` cache.
 */
export const FollowingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { users, currentUser } = useApp();
  const profileId = id ?? currentUser?.id ?? '';
  const profile = users.find(u => u.id === profileId);
  const [edges, setEdges] = useState<Follow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEdges(null);
    profileService
      .listFollowing(profileId)
      .then(list => {
        if (!cancelled) setEdges(list);
      })
      .catch(() => {
        if (!cancelled) setEdges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const byId = new Map<string, User>(users.map(user => [user.id, user]));
  const members = (edges ?? [])
    .map(edge => byId.get(edge.targetUserId))
    .filter((user): user is User => Boolean(user));
  const isOwnProfile = Boolean(currentUser && profileId === currentUser.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {isOwnProfile ? 'Following' : `${profile?.name ?? 'Profile'} Is Following`}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Mentors, classmates and campus voices this profile keeps up with.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {edges === null ? (
          <div className="col-span-3 p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            Loading following…
          </div>
        ) : members.length > 0 ? (
          members.map(user => <UserCard key={user.id} user={user} />)
        ) : (
          <div className="col-span-3 p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <span>Not following anyone yet.</span>
          </div>
        )}
      </div>
    </div>
  );
};
