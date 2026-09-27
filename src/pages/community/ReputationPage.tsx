import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, History, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { relativeTime } from '../../lib/time';
import { profileService, reputationService } from '../../services';
import type { Badge, ReputationEvent } from '../../types';

/**
 * The signed-in member's reputation, badges and ledger.
 *
 * Every number on this page is read back from Firestore: the score from
 * `users.reputation` (which only `reputationCreditEdit()` may move), the
 * badges from `userBadges`, and the history from `reputationEvents`. The
 * rules tables below document the policy the rules actually enforce, which
 * is why they list exactly `+15 / +10 / +5 / +5 / −2` and nothing else.
 */
const POINT_RULES = [
  { action: 'Your answer is accepted by the question author', points: '+15', positive: true },
  { action: 'A peer upvotes one of your answers', points: '+10', positive: true },
  { action: 'A peer upvotes one of your questions', points: '+5', positive: true },
  { action: 'You post a valid academic question', points: '+5', positive: true },
  { action: 'A peer downvotes your question or answer', points: '-2', positive: false },
  { action: 'You withdraw a vote you had cast', points: '0', positive: true }
];

const TIERS = [
  { name: 'Bronze', threshold: '100+ points', desc: 'Active student asking and answering questions.' },
  { name: 'Silver', threshold: '500+ points', desc: 'Frequent solver with several accepted solutions.' },
  { name: 'Gold', threshold: '1,500+ points', desc: 'Senior contributor with high answer accuracy.' },
  { name: 'Diamond', threshold: '3,000+ points', desc: 'Campus scholar, faculty and top placement mentor.' }
];

const EVENT_LABELS: Record<ReputationEvent['type'], string> = {
  question: 'Asked a question',
  answer: 'Posted an answer',
  accepted: 'Answer accepted',
  vote: 'Peer vote'
};

export const ReputationPage: React.FC = () => {
  const { currentUser } = useApp();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [events, setEvents] = useState<ReputationEvent[] | null>(null);
  const [reputation, setReputation] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser) return () => undefined;
    setBadges([]);
    setEvents(null);
    setReputation(null);

    profileService
      .getProfileStats(currentUser.id)
      .then(stats => {
        if (cancelled) return;
        setBadges(stats.badges);
        setReputation(stats.reputation);
      })
      .catch(() => {
        if (!cancelled) setReputation(currentUser.reputation);
      });

    // Own history includes `vote` rows: `firestore.rules` opens them to the
    // voter and the beneficiary only, and this page is the beneficiary.
    reputationService
      .history(currentUser.id, { includeVotes: true, limit: 50 })
      .then(list => {
        if (!cancelled) setEvents(list);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (!currentUser) return null;

  const score = reputation ?? currentUser.reputation;
  const earned = events ?? [];

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
            Reputation reflects your academic credibility, helpfulness and peer-verified problem
            solving across semesters.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center shrink-0">
          <div className="text-xs text-slate-400">Your Current Merit</div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono tabular-nums my-1">
            {score}
          </div>
          <Link
            to={`/app/users/${currentUser.id}`}
            className="text-[11px] text-indigo-400 hover:underline"
          >
            View public profile →
          </Link>
        </div>
      </div>

      {/* Badges Earned */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Your Unlocked Academic Badges</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {badges.length > 0 ? (
            badges.map(b => (
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
                    {b.tier} tier · Unlocked {relativeTime(Date.parse(b.unlockedAt))}
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

      {/* Ledger */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          <span>Your Reputation History</span>
        </h2>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden text-xs">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-3.5 border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
            <span>Event</span>
            <span className="text-right">When</span>
            <span className="text-right w-16">Points</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {events === null ? (
              <div className="p-8 text-center text-slate-400">Loading your ledger…</div>
            ) : earned.length > 0 ? (
              earned.map(event => (
                <div
                  key={event.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 p-3.5 items-center"
                >
                  <span className="text-slate-200">
                    {EVENT_LABELS[event.type]}
                    {event.type !== 'vote' && event.doubtId ? (
                      <Link
                        to={`/app/doubts/${event.doubtId}`}
                        className="ml-2 text-indigo-400 hover:underline"
                      >
                        Open thread →
                      </Link>
                    ) : null}
                  </span>
                  <span className="text-slate-500 font-mono text-right">
                    {relativeTime(event.createdAtMs)}
                  </span>
                  <span
                    className={`text-right font-mono font-bold tabular-nums w-16 ${
                      event.delta > 0 ? 'text-emerald-400' : event.delta < 0 ? 'text-rose-400' : 'text-slate-500'
                    }`}
                  >
                    {event.delta > 0 ? `+${event.delta}` : event.delta}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                No reputation earned yet - ask your first question to get started.
              </div>
            )}
          </div>
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
            {POINT_RULES.map(rule => (
              <div key={rule.action} className="grid grid-cols-2 p-3.5 items-center">
                <span className="text-slate-200">{rule.action}</span>
                <span
                  className={`text-right font-mono font-bold tabular-nums ${
                    rule.positive ? 'text-emerald-400' : 'text-rose-400'
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
          {TIERS.map(tier => (
            <div key={tier.name} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs font-bold text-white">{tier.name}</div>
              <div className="text-[11px] font-mono text-indigo-400 font-semibold mt-0.5">
                {tier.threshold}
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">{tier.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
