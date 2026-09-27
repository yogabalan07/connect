import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  Shield,
  Activity,
  CheckCircle2,
  Trash2,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { users, doubts, answers, reports, auditLogs, approveUser, rejectUser } = useApp();

  const totalUsers = users.length;
  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'approved');
  const blockedUsers = users.filter(u => u.status === 'blocked');
  const pendingReports = reports.filter(r => r.status === 'pending');

  const stats = [
    { label: 'Total Enrolled', value: totalUsers, icon: Users, color: 'text-indigo-400' },
    { label: 'Pending Approvals', value: pendingUsers.length, icon: UserCheck, color: 'text-amber-400', link: '/admin/users/pending' },
    { label: 'Active Students', value: activeUsers.length, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Restricted / Blocked', value: blockedUsers.length, icon: Shield, color: 'text-rose-400' },
    { label: 'Total Doubts', value: doubts.length, icon: HelpCircle, color: 'text-sky-400' },
    { label: 'Solutions Contributed', value: answers.length, icon: MessageSquare, color: 'text-purple-400' },
    { label: 'Flagged Reports', value: pendingReports.length, icon: AlertTriangle, color: 'text-amber-400', link: '/admin/reports' },
    { label: 'Audit Trail Records', value: auditLogs.length, icon: Activity, color: 'text-slate-400' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Control Center</h1>
        <p className="text-xs text-slate-400 mt-1">
          University moderation, faculty reviews, academic integrity enforcement, and platform metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={i}
              onClick={() => s.link && navigate(s.link)}
              className={`p-4 rounded-2xl bg-slate-900/80 border border-slate-800 ${
                s.link ? 'hover:border-purple-500/40 cursor-pointer' : ''
              } transition-all`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Section: Pending User Quick Approvals + Urgent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Queue */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Pending Registrations</h2>
            </div>
            <Link to="/admin/users/pending" className="text-xs text-purple-400 hover:underline">
              View all ({pendingUsers.length})
            </Link>
          </div>

          <div className="space-y-3">
            {pendingUsers.length > 0 ? (
              pendingUsers.slice(0, 3).map(u => (
                <div
                  key={u.id}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full" />
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {u.department} · {u.year} · {u.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => approveUser(u.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectUser(u.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-[11px]"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                All student registrations are approved!
              </div>
            )}
          </div>
        </div>

        {/* Flagged Content Queue */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white">Reported Content Queue</h2>
            </div>
            <Link to="/admin/reports" className="text-xs text-purple-400 hover:underline">
              Review ({pendingReports.length})
            </Link>
          </div>

          <div className="space-y-3">
            {pendingReports.length > 0 ? (
              pendingReports.slice(0, 3).map(r => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-400 uppercase text-[10px] tracking-wide font-mono">
                      Reason: {r.reason}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{r.createdAt}</span>
                  </div>
                  <div className="text-xs text-slate-200 line-clamp-1">"{r.targetTitle}"</div>
                  <div className="text-[11px] text-slate-400">
                    Reported user: {r.reportedUserName} by {r.reporterName}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No pending moderation flags.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Platform Health & Velocity Visualization */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Daily Doubt Resolution Velocity</h2>
            <p className="text-xs text-slate-400">Questions asked vs verified solutions resolved</p>
          </div>
          <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            Live Stream
          </span>
        </div>

        {/* CSS/SVG Bar Chart */}
        <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-800 font-mono text-[10px]">
          {[
            { day: 'Mon', doubts: 24, answers: 42 },
            { day: 'Tue', doubts: 32, answers: 56 },
            { day: 'Wed', doubts: 45, answers: 78 },
            { day: 'Thu', doubts: 38, answers: 64 },
            { day: 'Fri', doubts: 52, answers: 90 },
            { day: 'Sat', doubts: 68, answers: 110 },
            { day: 'Sun', doubts: 40, answers: 72 }
          ].map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1 h-32">
                <div
                  style={{ height: `${(bar.doubts / 110) * 100}%` }}
                  className="w-1/2 max-w-[14px] bg-indigo-500/60 group-hover:bg-indigo-400 rounded-t transition-all"
                  title={`${bar.doubts} Doubts asked`}
                />
                <div
                  style={{ height: `${(bar.answers / 110) * 100}%` }}
                  className="w-1/2 max-w-[14px] bg-purple-500/80 group-hover:bg-purple-400 rounded-t transition-all"
                  title={`${bar.answers} Answers posted`}
                />
              </div>
              <span className="text-slate-400">{bar.day}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-indigo-500/60" />
            <span>Questions Asked</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-purple-500/80" />
            <span>Answers Contributed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
