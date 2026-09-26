import React from 'react';
import { UserCheck, Check, X, ShieldCheck, Mail, Calendar, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';

export const AdminPendingUsersPage: React.FC = () => {
  const { users, approveUser, rejectUser } = useApp();

  const pendingList = users.filter(u => u.status === 'pending');

  const handleApprove = (userId: string) => {
    approveUser(userId);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pending User Requests</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review and grant posting access to newly registered engineering students
          </p>
        </div>
        <div className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
          {pendingList.length} Pending Approval
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingList.length > 0 ? (
          pendingList.map(u => (
            <div
              key={u.id}
              className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-purple-500/30 transition-all shadow-sm"
            >
              <div className="flex items-start gap-3.5">
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white truncate">{u.name}</h3>
                    <span className="text-[10px] font-mono font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Needs Review
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{u.email}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
                    <span className="font-semibold text-indigo-400">{u.department}</span>
                    <span className="text-slate-600">·</span>
                    <span>{u.year} Year (Sec {u.section || 'A'})</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {u.skills.map(s => (
                      <span
                        key={s}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Applied {u.joinedDate}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => rejectUser(u.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => handleApprove(u.id)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Student</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 p-16 text-center text-xs text-slate-400 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm font-bold text-white">No pending verification requests</div>
            <p className="text-slate-400 max-w-sm mx-auto">
              All registered students have been vetted and approved to ask and answer doubts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
