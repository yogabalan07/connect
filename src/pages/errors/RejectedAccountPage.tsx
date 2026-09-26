import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserX, Mail, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const RejectedAccountPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 antialiased text-center">
      <div className="max-w-md w-full space-y-5 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <UserX className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-white">Registration Not Approved</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          A department admin reviewed your registration
          {currentUser ? ` (${currentUser.email})` : ''} and it was not approved for this campus
          hub. Your record is kept for audit purposes — you can appeal the decision or re-register
          with a different department email.
        </p>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2 text-left">
          <Mail className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" aria-hidden="true" />
          <span>
            To appeal, contact your Department Academic Office with your registration email and a
            short explanation.
          </span>
        </div>
        <div className="pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign out</span>
          </button>
          <Link
            to="/login"
            className="text-xs text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
