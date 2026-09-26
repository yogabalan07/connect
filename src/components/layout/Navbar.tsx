import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Search,
  PlusCircle,
  Bell,
  MessageSquare,
  Shield,
  User as UserIcon,
  LogOut,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { RoleSwitcher } from '../ui/RoleSwitcher';
import { QuickSearchModal } from '../modals/QuickSearchModal';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, unreadNotificationsCount, logout } = useApp();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-6">
            <Link to="/app" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  Campus Doubt Hub
                </span>
                <span className="text-[10px] font-medium text-slate-400 tracking-wide uppercase">
                  Academic Community
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Search Bar Affordance */}
          <div className="flex-1 max-w-lg hidden md:block">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-300 transition-all shadow-inner group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                <span>Search doubts, users, topics...</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-slate-400">
                <span>⌘K</span>
              </div>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5">
            {/* Quick Demo Role Switcher */}
            <RoleSwitcher />

            {/* Ask Doubt CTA Button */}
            <Link
              to="/app/create"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Ask Doubt</span>
            </Link>

            {/* Mobile Search Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Notifications */}
            <Link
              to="/app/notifications"
              className="relative p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-950">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>

            {/* Messages */}
            <Link
              to="/app/messages"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              aria-label="Direct Messages"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800/80 transition-colors"
                aria-label="User profile menu"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {isUserMenuOpen && (
                <div
                  onClick={() => setIsUserMenuOpen(false)}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-40 text-slate-200"
                >
                  <div className="px-4 py-2 border-b border-slate-800">
                    <div className="text-xs font-bold text-white">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {currentUser.department} · {currentUser.year} Year
                    </div>
                    <div className="text-[11px] text-indigo-400 font-mono mt-0.5">
                      {currentUser.reputation} Reputation
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to={`/app/users/${currentUser.id}`}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-800 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </Link>

                    <Link
                      to="/app/settings"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Account Settings</span>
                    </Link>

                    {currentUser.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs text-purple-400 hover:bg-purple-500/10 font-medium transition-colors"
                      >
                        <Shield className="w-4 h-4 text-purple-400" />
                        <span>Admin Control Center</span>
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        navigate('/login');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
