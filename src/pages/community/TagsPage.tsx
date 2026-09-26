import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Search, TrendingUp, Check, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TagsPage: React.FC = () => {
  const navigate = useNavigate();
  const { tags, toggleFollowTag } = useApp();
  const [search, setSearch] = useState('');

  const filtered = tags.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tags & Subscribed Topics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Follow technical keywords to receive notified updates whenever doubts are asked
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tags (#DSA, #C++)..."
            className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(tag => (
          <div
            key={tag.id}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  onClick={() => navigate(`/app/explore?tag=${tag.name}`)}
                  className="font-mono text-sm font-bold text-white hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                  <Hash className="w-4 h-4 text-indigo-400" />
                  <span>{tag.name}</span>
                </button>

                {tag.isTrending && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3" />
                    <span>Trending</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {tag.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="font-mono text-[11px] tabular-nums">
                <span>{tag.count} doubts</span>
                <span className="mx-1.5">·</span>
                <span>{tag.followersCount} followers</span>
              </div>

              <button
                onClick={() => toggleFollowTag(tag.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  tag.isFollowing
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 hover:bg-slate-700/80 text-slate-300'
                }`}
              >
                {tag.isFollowing ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Subscribed</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
