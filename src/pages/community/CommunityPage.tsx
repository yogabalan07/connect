import React from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, TrendingUp, Users, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserCard } from '../../components/cards/UserCard';

export const CommunityPage: React.FC = () => {
  const { users, doubts, categories } = useApp();

  const activeUsers = users.filter(u => u.status === 'active');
  const topMentors = [...activeUsers].sort((a, b) => b.reputation - a.reputation).slice(0, 6);
  const mostAccepted = [...activeUsers].sort((a, b) => b.acceptedCount - a.acceptedCount).slice(0, 5);
  const newMembers = [...activeUsers].slice(0, 4);
  const trendingDoubts = [...doubts].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Community Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/20 shadow-sm relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Campus Knowledge Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Campus Community & Senior Mentors
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Recognizing the students and faculty who answer difficult technical doubts, review code, and elevate our college engineering ranking.
          </p>
        </div>
      </div>

      {/* Top Contributors Leaderboard Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Top Academic Contributors</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Ranked by Reputation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topMentors.map(user => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      </section>

      {/* Two-Column: Most Helpful Solvers + Trending Doubts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Accepted Answers */}
        <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Most Verified Solutions</h3>
            </div>
            <span className="text-[11px] text-slate-400">Accepted Answers</span>
          </div>

          <div className="space-y-3">
            {mostAccepted.map((u, i) => (
              <Link
                key={u.id}
                to={`/app/users/${u.id}`}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-500 w-4">#{i + 1}</span>
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {u.department} · {u.year} Year
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                    {u.acceptedCount}
                  </span>
                  <div className="text-[10px] text-slate-400">accepted</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Trending Academic Questions */}
        <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Trending Questions</h3>
            </div>
            <Link to="/app/explore?sort=trending" className="text-xs text-indigo-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {trendingDoubts.map(d => (
              <Link
                key={d.id}
                to={`/app/doubts/${d.id}`}
                className="block p-3 rounded-xl bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/60 transition-colors group"
              >
                <div className="text-xs font-semibold text-white group-hover:text-indigo-300 line-clamp-2 leading-snug">
                  {d.title}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{d.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">▲ {d.upvotes}</span>
                    <span>{d.answersCount} answers</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* New Campus Members */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">Recently Joined Freshmen & Lateral Entrants</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {newMembers.map(u => (
            <Link
              key={u.id}
              to={`/app/users/${u.id}`}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors text-center group"
            >
              <img
                src={u.avatar}
                alt={u.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-700 mx-auto mb-2 group-hover:scale-105 transition-transform"
              />
              <div className="text-xs font-bold text-white group-hover:text-indigo-300 truncate">
                {u.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {u.department} · {u.year}
              </div>
              <div className="mt-2 text-[10px] font-mono text-indigo-400">
                Joined {u.joinedDate}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
