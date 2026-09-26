import React, { useState } from 'react';
import { Shield, Save, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminSettingsPage: React.FC = () => {
  const { addToast } = useApp();
  const [requireFacultyApproval, setRequireFacultyApproval] = useState(true);
  const [autoFlagSpamWords, setAutoFlagSpamWords] = useState(true);
  const [allowedDomain, setAllowedDomain] = useState('college.edu');
  const [minRepToComment, setMinRepToComment] = useState('0');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addToast('Admin moderation policies updated.', 'success');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Moderation Policies</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure registration gating, academic integrity rules, and automated filtering
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 text-xs text-slate-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="font-semibold text-white">Require Department Admin Approval for New Students</div>
              <div className="text-[11px] text-slate-400">All registrations are held in Pending queue until verified</div>
            </div>
            <input
              type="checkbox"
              checked={requireFacultyApproval}
              onChange={e => setRequireFacultyApproval(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600"
            />
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="font-semibold text-white">Automated Homework / Assignment Solicitation Shield</div>
              <div className="text-[11px] text-slate-400">Flags external WhatsApp links, exam paper dumps, and paid assignments</div>
            </div>
            <input
              type="checkbox"
              checked={autoFlagSpamWords}
              onChange={e => setAutoFlagSpamWords(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600"
            />
          </div>

          <div className="pb-4 border-b border-slate-800 space-y-2">
            <label className="font-semibold text-white block">Allowed University Email Domain</label>
            <input
              type="text"
              value={allowedDomain}
              onChange={e => setAllowedDomain(e.target.value)}
              placeholder="e.g. college.edu"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
            />
            <span className="text-[10px] text-slate-500 block">Only emails ending in this domain can register as students.</span>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-white block">Minimum Reputation for Answering Doubts</label>
            <input
              type="number"
              value={minRepToComment}
              onChange={e => setMinRepToComment(e.target.value)}
              className="w-32 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none font-mono"
            />
            <span className="text-[10px] text-slate-500 block">Default is 0 (all enrolled students can participate).</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Policies</span>
          </button>
        </div>
      </form>
    </div>
  );
};
