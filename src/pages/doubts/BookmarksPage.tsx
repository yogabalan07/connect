import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Compass } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDoubts } from '../../hooks/useDoubts';
import { useStore } from '../../lib/store';
import { socialService } from '../../services/socialService';
import { DoubtCard } from '../../components/cards/DoubtCard';

export const BookmarksPage: React.FC = () => {
  const { doubts, bookmarkedDoubtIds } = useApp();
  const { status: doubtsStatus } = useDoubts();
  const social = useStore(socialService.store);
  const [filter, setFilter] = useState<'all' | 'solved' | 'unsolved'>('all');

  const savedDoubts = doubts.filter(d => bookmarkedDoubtIds.includes(d.id));
  const loading = doubtsStatus === 'loading' || social.status === 'loading';

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <div className="h-8 w-56 rounded bg-slate-800 animate-pulse" />
        <div className="h-36 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        <div className="h-36 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        <span className="sr-only">Loading saved doubts…</span>
      </div>
    );
  }

  let filtered = savedDoubts;
  if (filter === 'solved') filtered = savedDoubts.filter(d => d.hasAcceptedAnswer);
  if (filter === 'unsolved') filtered = savedDoubts.filter(d => !d.hasAcceptedAnswer);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Saved Doubts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Questions and reference solutions you bookmarked for mid-terms and finals
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({savedDoubts.length})
          </button>
          <button
            onClick={() => setFilter('solved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'solved' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Solved ({savedDoubts.filter(d => d.hasAcceptedAnswer).length})
          </button>
          <button
            onClick={() => setFilter('unsolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'unsolved' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Unsolved ({savedDoubts.filter(d => !d.hasAcceptedAnswer).length})
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map(doubt => (
            <DoubtCard key={doubt.id} doubt={doubt} />
          ))
        ) : (
          <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Bookmark className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No saved bookmarks yet</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              Save doubts with useful algorithm implementations or proofs to easily find them before exams.
            </p>
            <Link
              to="/app/explore"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Questions</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
