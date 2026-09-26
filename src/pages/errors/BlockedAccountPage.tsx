import React from 'react';
import { Link } from 'react-router-dom';
import { UserX, Mail, HelpCircle } from 'lucide-react';

export const BlockedAccountPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 antialiased text-center">
      <div className="max-w-md space-y-5 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <UserX className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Account Restricted</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your campus account has been temporarily suspended due to reports of commercial spam, unapproved external links, or violation of student honor code.
        </p>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
          To file an appeal, contact your Department Academic Integrity Council with your student ID.
        </div>
        <div className="pt-2">
          <Link
            to="/login"
            className="text-xs text-indigo-400 hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
