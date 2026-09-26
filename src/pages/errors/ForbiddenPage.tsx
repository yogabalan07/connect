import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const ForbiddenPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 antialiased text-center">
      <div className="max-w-md space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-white font-mono">403</h1>
        <h2 className="text-lg font-bold text-slate-200">Access Restricted</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          You do not have administrative clearance to access this faculty management area.
        </p>
        <div className="pt-2">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student App</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
