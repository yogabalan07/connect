import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, PlusCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDoubts } from '../../hooks/useDoubts';
import { DoubtCard } from '../../components/cards/DoubtCard';

export const MyDoubtsPage: React.FC = () => {
  const { currentUser } = useApp();
  const { doubts, status } = useDoubts();
  const [tab, setTab] = useState<'all' | 'public' | 'private' | 'solved' | 'unanswered'>('all');

  if (status === 'loading') {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <div className="h-8 w-64 rounded bg-slate-800 animate-pulse" />
        <div className="h-36 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        <div className="h-36 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        <span className="sr-only">Loading your doubts…</span>
      </div>
    );
  }

  if (!currentUser) return null;

  const myDoubts = doubts.filter(d => d.authorId === currentUser.id);

  let filtered = myDoubts;
  if (tab === 'public') filtered = myDoubts.filter(d => d.visibility === 'public');
  if (tab === 'private') filtered = myDoubts.filter(d => d.visibility === 'private');
  if (tab === 'solved') filtered = myDoubts.filter(d => d.hasAcceptedAnswer);
  if (tab === 'unanswered') filtered = myDoubts.filter(d => !d.hasAcceptedAnswer);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Academic Doubts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Questions you have asked across semesters and current course modules
          </p>
        </div>

        <Link
          to="/app/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Ask New Doubt</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'all', label: `All (${myDoubts.length})` },
          { id: 'public', label: `Public (${myDoubts.filter(d => d.visibility === 'public').length})` },
          { id: 'private', label: `Private (${myDoubts.filter(d => d.visibility === 'private').length})` },
          { id: 'solved', label: `Solved (${myDoubts.filter(d => d.hasAcceptedAnswer).length})` },
          { id: 'unanswered', label: `Unanswered (${myDoubts.filter(d => !d.hasAcceptedAnswer).length})` }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Doubts List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map(doubt => (
            <DoubtCard key={doubt.id} doubt={doubt} showDelete={true} />
          ))
        ) : (
          <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No questions in this tab</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              You haven't asked any doubts matching this filter yet.
            </p>
            <Link
              to="/app/create"
              className="mt-4 inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Ask your first doubt
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
