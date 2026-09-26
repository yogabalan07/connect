import React, { useState } from 'react';
import {
  User,
  Shield,
  Bell,
  Lock,
  Moon,
  Sun,
  Save,
  Check,
  Smartphone,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SettingsPage: React.FC = () => {
  const { currentUser, updateUserProfile, isDarkMode, toggleTheme, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'privacy' | 'notifications' | 'appearance'>('profile');

  // Profile fields
  const [name, setName] = useState(currentUser?.name ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [skills, setSkills] = useState(currentUser?.skills.join(', ') ?? '');
  const [section, setSection] = useState(currentUser?.section || 'A');

  // Privacy states
  const [messagePrivacy, setMessagePrivacy] = useState<'everyone' | 'following' | 'mentors'>('everyone');
  const [tagPrivacy, setTagPrivacy] = useState<'everyone' | 'department'>('everyone');
  const [followPrivacy, setFollowPrivacy] = useState<'public' | 'require_approval'>('public');

  // Notification toggles
  const [notifAnswers, setNotifAnswers] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifFollowers, setNotifFollowers] = useState(true);
  const [notifAnnounce, setNotifAnnounce] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name,
      bio,
      section,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean)
    });
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & Community Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your student profile, privacy visibility, and alert preferences
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'profile', label: 'Profile Info' },
          { id: 'privacy', label: 'Privacy & Mentions' },
          { id: 'notifications', label: 'Notification Rules' },
          { id: 'appearance', label: 'Appearance' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Profile Info */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
          <h2 className="text-base font-bold text-white">Student Profile Information</h2>

          <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700"
            />
            <div>
              <div className="text-xs font-semibold text-white">Profile Photo</div>
              <div className="text-[11px] text-slate-400">Synced from university ID register</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Department</label>
              <input
                type="text"
                disabled
                value={`${currentUser.department} (${currentUser.year} Year)`}
                className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Academic Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Technical Interests & Skills (comma separated)
            </label>
            <input
              type="text"
              value={skills}
              onChange={e => setSkills(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Privacy */}
      {activeTab === 'privacy' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
          <h2 className="text-base font-bold text-white">Community Privacy & Visibility</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Who can send you direct messages?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'everyone', label: 'Any Campus Student' },
                  { id: 'following', label: 'People I Follow' },
                  { id: 'mentors', label: 'Senior Mentors & Staff Only' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMessagePrivacy(opt.id as any);
                      addToast('Privacy rule updated.', 'info');
                    }}
                    className={`p-3 rounded-xl border text-xs text-left transition-colors ${
                      messagePrivacy === opt.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Who can tag you with @username?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'everyone', label: 'All Community Members' },
                  { id: 'department', label: 'My Department Classmates Only' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTagPrivacy(opt.id as any);
                      addToast('Tagging preference saved.', 'info');
                    }}
                    className={`p-3 rounded-xl border text-xs text-left transition-colors ${
                      tagPrivacy === opt.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">Alert Preferences</h2>

          <div className="space-y-3 divide-y divide-slate-800/80">
            {[
              {
                title: 'New Solutions & Answers',
                desc: 'Notify when someone answers your posted academic doubt.',
                state: notifAnswers,
                setter: setNotifAnswers
              },
              {
                title: '@Mentions in Discussions',
                desc: 'Notify when a classmate or mentor tags you in a question.',
                state: notifMentions,
                setter: setNotifMentions
              },
              {
                title: 'New Followers',
                desc: 'Alert when other students start following your contributions.',
                state: notifFollowers,
                setter: setNotifFollowers
              },
              {
                title: 'Campus Administrative Announcements',
                desc: 'Official updates from faculty and academic council.',
                state: notifAnnounce,
                setter: setNotifAnnounce
              }
            ].map((item, idx) => (
              <div key={idx} className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{item.title}</div>
                  <div className="text-[11px] text-slate-400">{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={item.state}
                  onChange={e => {
                    item.setter(e.target.checked);
                    addToast('Notification preferences updated.', 'info');
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Appearance */}
      {activeTab === 'appearance' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">Theme & Display</h2>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <button
              onClick={() => {
                if (!isDarkMode) toggleTheme();
              }}
              className={`p-4 rounded-2xl border text-center transition-all ${
                isDarkMode
                  ? 'border-indigo-500 bg-indigo-600/15 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-6 h-6 mx-auto mb-2 text-indigo-400" />
              <div className="text-xs font-bold">Dark Campus Mode</div>
              <div className="text-[10px] text-slate-400 mt-1">High contrast slate theme</div>
            </button>

            <button
              onClick={() => {
                if (isDarkMode) toggleTheme();
              }}
              className={`p-4 rounded-2xl border text-center transition-all ${
                !isDarkMode
                  ? 'border-indigo-500 bg-indigo-600/15 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <div className="text-xs font-bold">Light Campus Mode</div>
              <div className="text-[10px] text-slate-400 mt-1">Daytime reading theme</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
