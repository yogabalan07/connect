import React from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  UserCheck,
  AlertTriangle,
  FolderTree,
  Megaphone,
  History,
  BarChart3,
  Settings,
  ArrowLeft,
  GraduationCap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from '../ui/ThemeToggle';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, users, reports } = useApp();

  // The admin shell only renders behind RequireAdmin.
  if (!currentUser) return null;

  const pendingCount = users.filter(u => u.status === 'pending').length;
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

  const adminNav = [
    { to: '/admin', label: 'Control Center', icon: Shield, end: true },
    { to: '/admin/users', label: 'All Users', icon: Users },
    { to: '/admin/users/pending', label: 'Pending Approvals', icon: UserCheck, badge: pendingCount },
    { to: '/admin/doubts', label: 'Content Moderation', icon: AlertTriangle },
    { to: '/admin/reports', label: 'Report Queue', icon: AlertTriangle, badge: pendingReportsCount },
    { to: '/admin/categories', label: 'Academic Departments', icon: FolderTree },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/admin/analytics', label: 'Campus Analytics', icon: BarChart3 },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: History },
    { to: '/admin/settings', label: 'Admin Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Admin Header */}
      <header className="sticky top-0 z-30 w-full border-b border-purple-500/20 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/app"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Student App</span>
            </Link>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Admin Portal
                  <span className="text-[10px] font-mono font-normal uppercase bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded">
                    Staff Authority
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Connect · HOD Administration
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-purple-400/40"
              />
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-white">{currentUser.name}</div>
                <div className="text-[10px] text-purple-400 font-medium">Administrator</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-8">
        {/* Admin Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Administration
          </div>
          {adminNav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white font-mono">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </aside>

        {/* Dynamic Admin View */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

    </div>
  );
};
