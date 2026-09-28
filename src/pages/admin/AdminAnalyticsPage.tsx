import React, { useMemo } from 'react';
import { Users, CheckCircle2, MessageSquare, Flag, Activity } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Campus analytics computed from the collections the app actually owns.
 *
 * Every number here is derived from live Firestore data - `users`,
 * `doubts`, `answers`, `reports`, `auditLogs`. Nothing is hard-coded: an
 * invented "1,842 Active Daily Inquirers" or a "<0.2% flagged" claim would
 * be indistinguishable from a real one on screen, and this page is read as
 * evidence.
 *
 * There is deliberately no 7d / 30d / semester toggle: those windows would
 * need a time-series query over a date index, and a selector that silently
 * shows the same totals is worse than no selector at all.
 */
export const AdminAnalyticsPage: React.FC = () => {
  const { doubts, users, categories, answers, reports, auditLogs } = useApp();

  const approvedMembers = users.filter(u => u.status === 'approved').length;
  const solvedCount = doubts.filter(d => d.hasAcceptedAnswer).length;
  const resolutionPercentage = Math.round((solvedCount / (doubts.length || 1)) * 100);
  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const closedReports = reports.length - pendingReports;

  const deptBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    doubts.forEach(doubt => {
      const dept = doubt.authorSnapshot.department || 'Unspecified';
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    });
    const total = doubts.length || 1;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([dept, count]) => ({
        dept,
        count,
        percentage: Math.round((count / total) * 100)
      }));
  }, [doubts]);

  const metrics = [
    {
      label: 'Approved Members',
      value: approvedMembers.toLocaleString(),
      note: `${users.length - approvedMembers} awaiting or blocked`,
      icon: Users,
      tone: 'text-white'
    },
    {
      label: 'Solved Ratio',
      value: `${resolutionPercentage}%`,
      note: `${solvedCount} of ${doubts.length} doubts accepted a solution`,
      icon: CheckCircle2,
      tone: 'text-emerald-400'
    },
    {
      label: 'Answers Posted',
      value: answers.length.toLocaleString(),
      note: `${doubts.length} questions in the forum`,
      icon: MessageSquare,
      tone: 'text-indigo-400'
    },
    {
      label: 'Open Reports',
      value: pendingReports.toLocaleString(),
      note: `${closedReports} closed in the queue`,
      icon: Flag,
      tone: 'text-rose-400'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Campus Academic Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Derived from the live forum, directory and moderation collections
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
          <Activity className="w-3.5 h-3.5" />
          {auditLogs.length} audit entries recorded
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(metric => (
          <div key={metric.label} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold">{metric.label}</span>
            <div className={`text-2xl font-bold font-mono mt-1 ${metric.tone}`}>{metric.value}</div>
            <span className="text-[10px] text-slate-400">{metric.note}</span>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Participation Breakdown */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white">Department Question Volume Distribution</h2>
          <div className="space-y-3 pt-2">
            {deptBreakdown.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No questions yet.</div>
            ) : (
              deptBreakdown.map(item => (
                <div key={item.dept} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{item.dept}</span>
                    <span className="text-slate-400 font-mono">
                      {item.percentage}% ({item.count} questions)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Most Active Subject Hubs */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white">Top Active Academic Subjects</h2>
          <div className="space-y-2.5 pt-2">
            {categories.slice(0, 5).map((cat, i) => (
              <div
                key={cat.id}
                className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 font-mono font-bold text-purple-400">#{i + 1}</span>
                  <span className="font-semibold text-slate-200">{cat.name}</span>
                </div>
                <span className="font-mono text-slate-400 tabular-nums">
                  {cat.questionsCount} doubts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
