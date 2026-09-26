import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Compass,
  HelpCircle,
  Bookmark,
  Users,
  FolderTree,
  Hash,
  Award,
  MessageSquare,
  Bell,
  Settings,
  Shield,
  LifeBuoy,
  PlusCircle,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const { currentUser, unreadNotificationsCount } = useApp();

  if (!currentUser) return null;

  const primaryLinks = [
    { to: '/app', label: 'Home Feed', icon: Home, end: true },
    { to: '/app/explore', label: 'Explore Doubts', icon: Compass },
    { to: '/app/my-doubts', label: 'My Doubts', icon: HelpCircle },
    { to: '/app/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { to: '/app/following', label: 'Following Feed', icon: Users },
    { to: '/app/categories', label: 'Categories', icon: FolderTree },
    { to: '/app/tags', label: 'Tags & Topics', icon: Hash },
    { to: '/app/community', label: 'Community', icon: Award },
    { to: '/app/reputation', label: 'Reputation & Badges', icon: Award },
    { to: '/app/messages', label: 'Direct Messages', icon: MessageSquare },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: unreadNotificationsCount }
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto pr-2 pb-8 text-slate-300">
      {/* Quick Action Button */}
      <div className="mb-4">
        <Link
          to="/app/create"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 active:scale-98 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Ask New Doubt</span>
        </Link>
      </div>

      {/* Primary Navigation */}
      <div className="space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Menu
        </div>
        {primaryLinks.map(link => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </div>
              {link.badge !== undefined && link.badge > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white font-mono">
                  {link.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </div>

      {/* Private doubts filter shortcut */}
      <div className="mt-4 pt-3 border-t border-slate-800/80">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Confidential
        </div>
        <NavLink
          to="/app/explore?visibility=private"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`
          }
        >
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Private Doubts</span>
        </NavLink>
      </div>

      {/* Bottom Area: Settings, Admin, Help */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          System
        </div>
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isActive
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </NavLink>

        {currentUser.role === 'admin' && (
          <Link
            to="/admin"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4" />
              <span>Admin Portal</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-500/20">
              Staff
            </span>
          </Link>
        )}

        <a
          href="#help"
          onClick={e => {
            e.preventDefault();
            alert('Campus Doubt Hub Help Center: Contact academic mentors or student welfare cell.');
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Guidelines & Help</span>
        </a>
      </div>

      {/* User Mini Card in Sidebar */}
      <div className="mt-6 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
        <img
          src={currentUser.avatar}
          alt={currentUser.name}
          className="w-9 h-9 rounded-full object-cover border border-slate-700"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {currentUser.department} · {currentUser.year} Year
          </div>
        </div>
      </div>
    </aside>
  );
};
