import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 antialiased text-center">
      <div className="max-w-md space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-white font-mono">404</h1>
        <h2 className="text-lg font-bold text-slate-200">Page or Question Not Found</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The requested route, doubt ID, or user profile does not exist or may have been deleted by moderators.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/app"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            <Home className="w-4 h-4" />
            <span>Campus Feed</span>
          </Link>
          <Link
            to="/"
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium"
          >
            Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
};
