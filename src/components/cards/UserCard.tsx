import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, CheckCircle2, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import { User } from '../../types';
import { useApp } from '../../context/AppContext';

interface UserCardProps {
  user: User;
  onMessage?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onMessage }) => {
  const { currentUser, followingUserIds, toggleFollowUser, startConversation } = useApp();
  const navigate = useNavigate();
  const isFollowing = followingUserIds.includes(user.id);
  const isSelf = currentUser ? currentUser.id === user.id : false;

  /**
   * Opens (or reuses) the thread first, then navigates.
   *
   * Landing on `/app/messages` with an empty inbox would look broken even
   * though the write succeeded; `startConversation` is idempotent, so
   * pressing this twice never mints a second document.
   */
  const handleMessage = (): void => {
    void (async () => {
      try {
        await startConversation(user.id);
      } catch {
        // Already toasted by `AppContext.startConversation`.
        return;
      }
      onMessage?.();
      navigate('/app/messages');
    })();
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 p-5 shadow-sm transition-all text-slate-100 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <Link to={`/app/users/${user.id}`} className="flex items-center gap-3 group">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-indigo-400 transition-colors"
              />
              {user.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {user.name}
                </span>
                {user.role === 'mentor' && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                    Mentor
                  </span>
                )}
                {user.role === 'admin' && (
                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 rounded">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                @{user.username} · {user.department} ({user.year})
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-3 text-xs text-slate-300 line-clamp-2 leading-relaxed">
          {user.bio}
        </p>

        {/* Skills list */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {user.skills.slice(0, 3).map(skill => (
            <span
              key={skill}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60"
            >
              {skill}
            </span>
          ))}
          {user.skills.length > 3 && (
            <span className="text-[10px] text-slate-400 self-center">
              +{user.skills.length - 3} more
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200 tabular-nums">{user.reputation}</span>
            <span>rep</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200 tabular-nums">{user.acceptedCount}</span>
            <span>solved</span>
          </div>
          <div>
            <span className="font-semibold text-slate-200 tabular-nums">{user.followersCount}</span>
            <span className="ml-1">followers</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {!isSelf && (
        <div className="mt-4 pt-3 flex items-center gap-2">
          <button
            onClick={() => toggleFollowUser(user.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              isFollowing
                ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
            }`}
          >
            {isFollowing ? (
              <>
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Following</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Follow</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleMessage}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Send Message"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
