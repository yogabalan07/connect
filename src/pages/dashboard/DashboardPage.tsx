import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Award,
  PlusCircle,
  Flame,
  Clock,
  Sparkles,
  Users,
  Search,
  Filter,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DoubtCard } from '../../components/cards/DoubtCard';
import { Doubt } from '../../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, doubts, followingUserIds } = useApp();
  const [activeTab, setActiveTab] = useState<'latest' | 'trending' | 'unanswered' | 'following'>('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // Feed filtering
  let feedDoubts = [...doubts];

  // Filter based on tab
  if (activeTab === 'latest') {
    feedDoubts.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  } else if (activeTab === 'trending') {
    feedDoubts.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else if (activeTab === 'unanswered') {
    feedDoubts = feedDoubts.filter(d => d.answersCount === 0 || !d.hasAcceptedAnswer);
  } else if (activeTab === 'following') {
    feedDoubts = feedDoubts.filter(d => followingUserIds.includes(d.authorId));
  }

  // Filter based on search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    feedDoubts = feedDoubts.filter(
      d =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q)) ||
        d.category.toLowerCase().includes(q)
    );
  }

  const statCards = [
    {
      title: 'Questions Asked',
      value: currentUser.questionsCount,
      icon: <HelpCircle className="w-5 h-5 text-indigo-400" />,
      sub: 'This semester'
    },
    {
      title: 'Answers Given',
      value: currentUser.answersCount,
      icon: <MessageSquare className="w-5 h-5 text-sky-400" />,
      sub: 'Peer contributions'
    },
    {
      title: 'Accepted Answers',
      value: currentUser.acceptedCount,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      sub: 'Verified solutions'
    },
    {
      title: 'Campus Reputation',
      value: currentUser.reputation,
      icon: <Award className="w-5 h-5 text-amber-400" />,
      sub: 'Level 4 Contributor'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Good morning, {currentUser.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            What would you like to learn or solve on campus today?
          </p>
        </div>

        <Link
          to="/app/create"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Ask a Doubt</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{stat.title}</span>
              <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                {stat.icon}
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
              {stat.value}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Interactive Quick Doubt Launcher Card */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-10 h-10 rounded-full object-cover border border-indigo-500/30 shrink-0"
          />
          <Link
            to="/app/create"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 hover:border-indigo-500/40 hover:text-slate-200 transition-all flex items-center justify-between"
          >
            <span>Have a technical or academic question? Ask seniors and mentors...</span>
            <PlusCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          </Link>
        </div>

        {/* Quick Filter Shortcuts */}
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Quick Topics:
          </span>
          {['KalmanFilter', 'ESP32', 'DSA', 'FreeRTOS', 'DBMS', 'Placement'].map(tag => (
            <button
              key={tag}
              onClick={() => navigate(`/app/explore?tag=${tag}`)}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-[11px] font-mono text-slate-300 transition-colors"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Filter & Tabs Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
          {/* Segmented Tab Controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('latest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'latest'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Latest Doubts</span>
            </button>

            <button
              onClick={() => setActiveTab('trending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'trending'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Trending</span>
            </button>

            <button
              onClick={() => setActiveTab('unanswered')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'unanswered'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unsolved</span>
            </button>

            <button
              onClick={() => setActiveTab('following')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'following'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Following ({followingUserIds.length})</span>
            </button>
          </div>

          {/* Quick feed filter input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter current feed..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Doubts Feed List */}
        {feedDoubts.length > 0 ? (
          <div className="space-y-4">
            {feedDoubts.map(doubt => (
              <DoubtCard key={doubt.id} doubt={doubt} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No doubts found in this view</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'following'
                ? "You aren't following anyone who has posted doubts yet. Follow seniors and mentors to see their feed here!"
                : 'Try adjusting your search query or post the very first doubt on this topic.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {activeTab === 'following' ? (
                <Link
                  to="/app/community"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Find Top Mentors
                </Link>
              ) : (
                <Link
                  to="/app/create"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Ask a Doubt
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
