import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Trash2, Eye, ShieldAlert, MessageSquare, HelpCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminDoubtsPage: React.FC = () => {
  const { doubts, deleteDoubt, issueWarning, blockUser, warnings } = useApp();
  const [search, setSearch] = useState('');

  const filtered = doubts.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.authorSnapshot.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleWarn = async (authorId: string, authorName: string) => {
    const reason = window.prompt(
      `Academic warning reason for ${authorName} (min 5 characters):`,
      'Repeated off-topic or low-effort posting'
    );
    if (!reason) return;
    await issueWarning(authorId, authorName, reason);
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
                    <div className="font-semibold text-white">{d.authorSnapshot.name}</div>
                    <div className="text-[11px] text-slate-500">@{d.authorSnapshot.username}</div>
                  </td>
                  <td className="p-4 text-slate-300">
                    {d.authorSnapshot.department} · {d.authorSnapshot.year}
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
                      onClick={() => handleWarn(d.authorId, d.authorSnapshot.name)}
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

      {/* Warnings issued through the ShieldAlert action above. Until this
          panel existed the write landed in Firestore with nowhere to be read
          back, which made "recorded" an invisible claim. */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-800 bg-slate-950/60">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Recorded Academic Warnings</h2>
          <span className="ml-auto text-[11px] font-mono text-slate-500">{warnings.length}</span>
        </div>

        {warnings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No academic warnings on record.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {warnings.map(warning => (
              <li key={warning.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{warning.userName}</span>
                    <span className="text-[10px] font-mono text-slate-500">{warning.issuedAt}</span>
                  </div>
                  <p className="mt-1 text-slate-300 line-clamp-2">{warning.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Issued by {warning.issuedByName}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
                  Warned
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
