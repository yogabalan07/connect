import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserCard } from '../../components/cards/UserCard';
import { profileService } from '../../services';
import type { Follow, User } from '../../types';

/**
 * Members who follow a profile.
 *
 * The edge list comes straight from `follows/{target}_{follower}` - the one
 * collection that actually records the relationship - rather than from a
 * counter on `users/{uid}` that nothing is allowed to write. The route is
 * `/app/users/:id/followers`, with `/app/followers` kept as the signed-in
 * member's own shortcut.
 */
export const FollowersPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { users, currentUser } = useApp();
  const profileId = id ?? currentUser?.id ?? '';
  const profile = users.find(u => u.id === profileId);
  const [edges, setEdges] = useState<Follow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEdges(null);
    profileService
      .listFollowers(profileId)
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
    .map(edge => byId.get(edge.userId))
    .filter((user): user is User => Boolean(user));
  const isOwnProfile = Boolean(currentUser && profileId === currentUser.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {isOwnProfile ? 'Your Followers' : `${profile?.name ?? 'Profile'}'s Followers`}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Members who chose to keep up with this profile's questions, answers and code reviews.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {edges === null ? (
          <div className="col-span-3 p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            Loading followers…
          </div>
        ) : members.length > 0 ? (
          members.map(user => <UserCard key={user.id} user={user} />)
        ) : (
          <div className="col-span-3 p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <span>No followers yet.</span>
          </div>
        )}
      </div>
    </div>
  );
};
