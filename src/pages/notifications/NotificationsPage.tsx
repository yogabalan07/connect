import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  MessageSquare,
  Users,
  ShieldAlert,
  Megaphone,
  AtSign,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const NotificationsPage: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const [filter, setFilter] = useState<'all' | 'unread' | 'answers' | 'mentions'>('all');

  let filtered = notifications;
  if (filter === 'unread') filtered = notifications.filter(n => !n.read);
  if (filter === 'answers') filtered = notifications.filter(n => n.type === 'answer' || n.type === 'accepted');
  if (filter === 'mentions') filtered = notifications.filter(n => n.type === 'mention');

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'answer':
        return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-sky-400" />;
      case 'follow':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Notification Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time updates regarding solutions, mentions, semester announcements, and follower activity
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 transition-colors self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4 text-indigo-400" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'unread' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('answers')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'answers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Solutions & Rep
        </button>
        <button
          onClick={() => setFilter('mentions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'mentions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          @Mentions
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map(notif => (
            <div
              key={notif.id}
              onClick={() => markNotificationRead(notif.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                notif.read
                  ? 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                  : 'bg-slate-900 border-indigo-500/30 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{notif.title}</span>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-xl">
                    {notif.message}
                  </p>
                  <div className="mt-2 text-[10px] font-mono text-slate-500">
                    {notif.timestamp}
                  </div>
                </div>
              </div>

              {notif.link && (
                <Link
                  to={notif.link}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors shrink-0"
                  title="Open Link"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ))
        ) : (
          <div className="p-16 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <Bell className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <span>No notifications in this view.</span>
          </div>
        )}
      </div>
    </div>
  );
};
