import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Award, HelpCircle, UserPlus, Activity, CheckCircle2, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RightSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { doubts, users, tags, followingUserIds, toggleFollowUser, currentUser } = useApp();

  if (!currentUser) return null;

  // Trending tags
  const trendingTags = tags.filter(t => t.isTrending).slice(0, 6);

  // Top contributors
  const topContributors = [...users]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 4);

  // Unanswered questions
  const unansweredDoubts = doubts
    .filter(d => d.answersCount === 0 || !d.hasAcceptedAnswer)
    .slice(0, 3);

  // Suggested users (exclude current user and already following)
  const suggestedUsers = users
    .filter(u => u.id !== currentUser.id && !followingUserIds.includes(u.id) && u.status === 'approved')
    .slice(0, 3);

  // Live hub metrics - both derived from the feed and directory, never
  // declared. A hard-coded "96.4% Answer Rate" would be indistinguishable
  // from a measured one on screen.
  const answeredCount = doubts.filter(d => d.answersCount > 0).length;
  const answerRate = doubts.length === 0 ? 0 : Math.round((answeredCount / doubts.length) * 100);
  const approvedMembers = users.filter(u => u.status === 'approved').length;

  return (
    <aside className="w-80 shrink-0 hidden xl:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto pl-2 pb-8 space-y-5 text-slate-300">
      {/* Community Stats Widget */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-xs font-bold text-white uppercase tracking-wider">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Campus Hub Metrics</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="text-lg font-bold text-white font-mono tabular-nums">{answerRate}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Answered</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="text-lg font-bold text-indigo-400 font-mono tabular-nums">
              {approvedMembers}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Members</div>
          </div>
        </div>
      </div>

      {/* Trending Topics Widget */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>Trending Topics</span>
          </div>
          <Link to="/app/tags" className="text-[11px] text-indigo-400 hover:underline">
            View all
          </Link>
        </div>

        <div className="space-y-2">
          {trendingTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => navigate(`/app/explore?tag=${tag.name}`)}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/70 text-left transition-colors group"
            >
              <span className="font-mono text-xs text-slate-300 group-hover:text-indigo-300">
                #{tag.name}
              </span>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {tag.count} doubts
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Top Contributors Widget */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Top Contributors</span>
          </div>
          <Link to="/app/community" className="text-[11px] text-indigo-400 hover:underline">
            Leaderboard
          </Link>
        </div>

        <div className="space-y-2.5">
          {topContributors.map((user, idx) => (
            <Link
              key={user.id}
              to={`/app/users/${user.id}`}
              className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-mono font-bold text-slate-400 w-4 text-center">
                  #{idx + 1}
                </span>
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white group-hover:text-indigo-300 truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {user.department} · {user.year}
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400 font-mono tabular-nums shrink-0">
                {user.reputation}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Unanswered Doubts Widget */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span>Help Solve Doubts</span>
          </div>
          <Link to="/app/explore?status=unanswered" className="text-[11px] text-indigo-400 hover:underline">
            See more
          </Link>
        </div>

        <div className="space-y-2.5">
          {unansweredDoubts.map(doubt => (
            <Link
              key={doubt.id}
              to={`/app/doubts/${doubt.id}`}
              className="block p-2 rounded-xl bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/50 transition-colors group"
            >
              <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 line-clamp-2 leading-snug">
                {doubt.title}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>{doubt.category}</span>
                <span className="font-mono text-slate-500">
                  ▲ {doubt.upvotes}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Suggested Peers to Follow */}
      {suggestedUsers.length > 0 && (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-white uppercase tracking-wider">
            <UserPlus className="w-4 h-4 text-purple-400" />
            <span>Peers to Connect</span>
          </div>

          <div className="space-y-3">
            {suggestedUsers.map(user => {
              const isFollowing = followingUserIds.includes(user.id);
              return (
                <div key={user.id} className="flex items-center justify-between gap-2">
                  <Link to={`/app/users/${user.id}`} className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate hover:underline">
                        {user.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {user.department} · {user.skills[0] || 'Engineering'}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={() => toggleFollowUser(user.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs font-semibold transition-colors shrink-0"
                    title={isFollowing ? 'Following' : 'Follow'}
                  >
                    {isFollowing ? (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
