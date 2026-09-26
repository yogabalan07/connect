import React from 'react';
import { Award, CheckCircle2, HelpCircle, Sparkles, Shield, Heart, Code, Cpu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ReputationPage: React.FC = () => {
  const { currentUser } = useApp();

  const tiers = [
    { name: 'Bronze', threshold: '100+ points', desc: 'Active student asking and answering questions.' },
    { name: 'Silver', threshold: '500+ points', desc: 'Frequent solver with at least 5 accepted solutions.' },
    { name: 'Gold', threshold: '1,500+ points', desc: 'Senior departmental mentor with high answer accuracy.' },
    { name: 'Diamond', threshold: '3,000+ points', desc: 'Campus scholar, faculty, and top placement mentor.' }
  ];

  const pointRules = [
    { action: 'Answer Accepted by Author', points: '+15', type: 'positive' },
    { action: 'Answer Upvoted by Peer', points: '+10', type: 'positive' },
    { action: 'Question Upvoted', points: '+5', type: 'positive' },
    { action: 'Post Valid Academic Question', points: '+5', type: 'positive' },
    { action: 'Content Downvoted', points: '-2', type: 'negative' },
    { action: 'Spam Flag Upheld by Admin', points: '-50', type: 'negative' }
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
            <Award className="w-4 h-4" />
            <span>Academic Merit System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Reputation & Community Badges
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-xl">
            Reputation reflects your academic credibility, helpfulness, and peer-verified problem solving across semesters.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center shrink-0">
          <div className="text-xs text-slate-400">Your Current Merit</div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono tabular-nums my-1">
            {currentUser.reputation}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">Top 5% of Department</div>
        </div>
      </div>

      {/* Badges Earned */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Your Unlocked Academic Badges</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {currentUser.badges && currentUser.badges.length > 0 ? (
            currentUser.badges.map(b => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5 hover:border-slate-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{b.name}</div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{b.description}</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                    {b.tier} tier · Unlocked {b.unlockedAt}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 p-6 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
              Answer questions and help classmates to unlock your first badge!
            </div>
          )}
        </div>
      </section>

      {/* Point Rules Table */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white">How Reputation Points Are Calculated</h2>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden text-xs">
          <div className="grid grid-cols-2 p-3.5 border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
            <span>Contribution Activity</span>
            <span className="text-right">Reputation Adjustment</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {pointRules.map((rule, idx) => (
              <div key={idx} className="grid grid-cols-2 p-3.5 items-center">
                <span className="text-slate-200">{rule.action}</span>
                <span
                  className={`text-right font-mono font-bold tabular-nums ${
                    rule.type === 'positive' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {rule.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tier Breakdown */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white">Reputation Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs font-bold text-white">{t.name}</div>
              <div className="text-[11px] font-mono text-indigo-400 font-semibold mt-0.5">
                {t.threshold}
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
