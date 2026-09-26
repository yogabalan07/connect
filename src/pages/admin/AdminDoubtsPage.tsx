import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Trash2, Eye, ShieldAlert, MessageSquare, HelpCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminDoubtsPage: React.FC = () => {
  const { doubts, deleteDoubt, addToast, blockUser } = useApp();
  const [search, setSearch] = useState('');

  const filtered = doubts.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.author.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleWarn = (authorName: string) => {
    addToast(`Official academic warning issued to ${authorName}.`, 'warning');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Content Moderation</h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit campus doubts, prune duplicate homework requests, and maintain academic rigor
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions or author..."
            className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Question Title</th>
                <th className="p-4">Author</th>
                <th className="p-4">Department</th>
                <th className="p-4">Stats</th>
                <th className="p-4 text-right">Moderator Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 max-w-sm">
                    <Link
                      to={`/app/doubts/${d.id}`}
                      className="font-bold text-white hover:text-purple-300 line-clamp-1"
                    >
                      {d.title}
                    </Link>
                    <div className="text-[11px] text-slate-400 mt-0.5">{d.category}</div>
                  </td>
                  <td className="p-4 text-slate-300">
                    <div className="font-semibold text-white">{d.author.name}</div>
                    <div className="text-[11px] text-slate-500">@{d.author.username}</div>
                  </td>
                  <td className="p-4 text-slate-300">
                    {d.author.department} · {d.author.year}
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-[11px]">
                    <div>{d.answersCount} answers</div>
                    <div className="text-emerald-400">▲ {d.upvotes} upvotes</div>
                  </td>
                  <td className="p-4 text-right space-x-1.5">
                    <Link
                      to={`/app/doubts/${d.id}`}
                      className="inline-block p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Inspect Thread"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      onClick={() => handleWarn(d.author.name)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400"
                      title="Issue Warning"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Delete this doubt from the forum?')) {
                          deleteDoubt(d.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                      title="Remove Doubt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
