import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const PendingApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { switchDevPersona } = useAuth();

  const handleInstantApproveDemo = () => {
    // DEV-only: switch the mock session to an admin so the approval queue can
    // be reviewed. Removed from production builds along with the button below.
    try {
      switchDevPersona('admin');
      navigate('/admin/users/pending');
    } catch {
      /* dev-only helper unavailable in production builds */
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased text-slate-100">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Verification Pending
          </span>
          <h1 className="mt-3 text-2xl font-bold text-white tracking-tight">
            Waiting for Admin Approval
          </h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Your college student account application has been submitted to your Department Administrator (<strong className="text-slate-200">Dr. Ramesh Kumar, HOD</strong>).
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Roll number & college email verified</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Department & section allocated</span>
          </div>
          <div className="flex items-center gap-2 text-amber-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Faculty approval in review queue</span>
          </div>
        </div>

        {/* DEV-ONLY fast-track (hidden in production builds) */}
        {import.meta.env.DEV && (
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-dashed border-purple-500/40 text-xs">
            <div className="font-semibold text-purple-300 mb-1">Development Only:</div>
            <p className="text-[11px] text-slate-400 mb-2.5">
              Switch the local mock session to Dr. Ramesh Kumar (Admin) to review and approve newly
              registered students in real time. No passwords involved.
            </p>
            <button
              type="button"
              onClick={handleInstantApproveDemo}
              className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Admin Approval Queue</span>
            </button>
          </div>
        )}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2">
          <Link to="/login" className="text-indigo-400 hover:underline">
            Back to Sign In
          </Link>
          <span>·</span>
          <Link to="/" className="hover:text-white transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
};
