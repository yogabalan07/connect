import React, { useState } from 'react';
import { Megaphone, Plus, Calendar, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminAnnouncementsPage: React.FC = () => {
  const { announcements, createAnnouncement, addToast } = useApp();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'urgent'>('normal');
  const [targetAudience, setTargetAudience] = useState<'all' | 'students' | 'mentors' | 'CSE' | 'ECE'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    createAnnouncement({
      title: title.trim(),
      content: content.trim(),
      priority,
      targetAudience
    });

    setTitle('');
    setContent('');
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Campus Announcements</h1>
          <p className="text-xs text-slate-400 mt-1">
            Broadcast official notices, hackathon schedules, and exam doubt-clearing sessions
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Broadcast</span>
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-slate-900 border border-purple-500/30 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-400" />
              <span>Create Official Notice</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Announcement Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Mid-Semester Doubt Clearing Sprint"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                >
                  <option value="low">Low Notice</option>
                  <option value="normal">Standard</option>
                  <option value="urgent">Urgent / Important</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Audience</label>
                <select
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
                >
                  <option value="all">Entire College</option>
                  <option value="students">Students Only</option>
                  <option value="mentors">Mentors Only</option>
                  <option value="CSE">CSE Department</option>
                  <option value="ECE">ECE Department</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Content Details</label>
            <textarea
              rows={3}
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Include timings, affected departments, and action required from students..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold"
            >
              Publish Notice
            </button>
          </div>
        </form>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map(ann => (
          <div
            key={ann.id}
            className={`p-6 rounded-3xl border transition-all text-xs text-slate-200 ${
              ann.priority === 'urgent'
                ? 'bg-rose-950/20 border-rose-500/30'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${
                    ann.priority === 'urgent'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {ann.priority} Priority
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-400 font-mono">Audience: {ann.targetAudience}</span>
              </div>
              <span className="text-slate-500 font-mono">{ann.createdAt}</span>
            </div>

            <h3 className="text-base font-bold text-white mb-2">{ann.title}</h3>
            <p className="text-slate-300 leading-relaxed max-w-3xl">{ann.content}</p>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>Published by {ann.authorName}</span>
              <span className="text-emerald-400 font-semibold">Active Broadcast</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
