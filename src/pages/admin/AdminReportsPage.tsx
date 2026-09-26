import React from 'react';
import { AlertTriangle, Check, Trash2, ShieldAlert, UserX, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminReportsPage: React.FC = () => {
  const { reports, dismissReport, resolveReport, deleteReportedContent, blockUser } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Report Management Queue</h1>
          <p className="text-xs text-slate-400 mt-1">
            Student and mentor flags regarding spam, inaccurate solutions, or policy violations
          </p>
        </div>
        <div className="text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl font-bold">
          {reports.filter(r => r.status === 'pending').length} Action Items
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Reported Target</th>
                <th className="p-4">Reason & Details</th>
                <th className="p-4">Reported By</th>
                <th className="p-4">Accused User</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 max-w-xs">
                    <span className="font-semibold text-white capitalize block">{r.targetType}:</span>
                    <span className="text-slate-300 line-clamp-2">{r.targetTitle}</span>
                  </td>
                  <td className="p-4 max-w-xs">
                    <span className="font-bold text-rose-400 uppercase text-[10px] tracking-wider block font-mono">
                      {r.reason}
                    </span>
                    <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">{r.description}</p>
                  </td>
                  <td className="p-4 text-slate-300 font-medium">
                    {r.reporterName}
                  </td>
                  <td className="p-4 text-slate-300 font-medium">
                    {r.reportedUserName}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                        r.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : r.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                    {r.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => deleteReportedContent(r.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px]"
                          title="Delete content and resolve report"
                        >
                          Delete Content
                        </button>

                        <button
                          onClick={() => dismissReport(r.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                          title="Dismiss report as false positive"
                        >
                          Dismiss
                        </button>

                        <button
                          onClick={() => blockUser(r.reportedUserId)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400"
                          title="Block User"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">Case closed</span>
                    )}
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
