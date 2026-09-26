import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GraduationCap, Lock, Mail, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, addToast } = useApp();

  const [email, setEmail] = useState('student@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const res = login(email, password);
      setIsLoading(false);
      if (res.success) {
        navigate('/app');
      } else {
        setError(res.message || 'Login failed.');
      }
    }, 400);
  };

  const handleQuickDemo = (type: 'student' | 'admin') => {
    if (type === 'student') {
      setEmail('student@example.com');
      setPassword('password123');
    } else {
      setEmail('admin@example.com');
      setPassword('admin123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100 antialiased">
      {/* Left Column: Animated Platform Illustration */}
      <div className="w-full md:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 border-r border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Campus Doubt Hub
            </span>
          </Link>

          <div className="mt-16 max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4">
              <span>Semester 2026 Academic Portal</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Connect with department mentors and master your curriculum.
            </h2>
            <p className="mt-4 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Verify difficult algorithm proofs, debug embedded firmware, and collaborate privately with capstone teams.
            </p>
          </div>
        </div>

        {/* Floating Card Mock */}
        <div className="my-12 p-5 rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-xl backdrop-blur-md max-w-sm relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">Recent Campus Activity</span>
          </div>
          <div className="text-xs text-slate-300 font-medium">
            "Priya Sundaram accepted answer on FreeRTOS SPI priority inversion"
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            Verified by HOD Dr. Ramesh Kumar
          </div>
        </div>

        <div className="text-xs text-slate-500 relative z-10">
          © 2026 Campus Doubt Hub. Official College Knowledge Community.
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="w-full md:w-1/2 p-8 sm:p-12 lg:p-16 flex items-center justify-center bg-slate-950">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Sign In to your Account
            </h1>
            <p className="mt-1.5 text-xs text-slate-400">
              Enter your college email credentials to access the doubt community
            </p>
          </div>

          {/* Quick Demo Fill Buttons */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
            <div className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>One-Click Demo Accounts</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('student')}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-[11px] font-medium text-slate-300 border border-slate-700 transition-colors"
              >
                Student Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('admin')}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 text-[11px] font-medium text-purple-300 border border-purple-800/60 transition-colors"
              >
                Admin Demo
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                College Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-indigo-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Verifying...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-semibold text-slate-500">
              <span className="bg-slate-950 px-2">or connect with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              login('student@example.com', 'password123');
              navigate('/app');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with College Google Workspace</span>
          </button>

          <div className="pt-2 text-center text-xs text-slate-400">
            Don't have an account yet?{' '}
            <Link to="/register" className="text-indigo-400 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
