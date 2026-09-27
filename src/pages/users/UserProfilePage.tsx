import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Users,
  UserPlus,
  UserCheck,
  Calendar,
  Sparkles,
  Bookmark
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DoubtCard } from '../../components/cards/DoubtCard';
import { absoluteDate, relativeTime } from '../../lib/time';
import { profileService } from '../../services';
import type { ActivityItem, ProfileStats } from '../../types';

type ProfileTab = 'overview' | 'questions' | 'answers' | 'accepted' | 'activity' | 'badges';

/**
 * A member's public profile.
 *
 * Every number in the stats bar comes from `profileService.getProfileStats`,
 * which derives it from `reputationEvents`, `follows` and `userBadges` at
 * read time. `users/{uid}` is only consulted for identity fields - the
 * declared `questionsCount` / `followersCount` / `badges` on that document
 * are deliberately never written by the client, so rendering them would
 * show a number nothing can prove.
 */
export const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { users, currentUser, doubts, answers, followingUserIds, toggleFollowUser } = useApp();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  const profileUser = users.find(u => u.id === id) ?? currentUser;
  const isSelf = Boolean(currentUser && profileUser && currentUser.id === profileUser.id);
  const isFollowing = Boolean(profileUser && followingUserIds.includes(profileUser.id));

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setActivity(null);
    const uid = profileUser?.id;
    if (!uid) return () => undefined;
    profileService
      .getProfileStats(uid)
      .then(next => {
        if (!cancelled) setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    profileService
      .getProfileActivity(uid, 30)
      .then(next => {
        if (!cancelled) setActivity(next);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      });
    return () => {
      cancelled = true;
    };
    // `isFollowing` stands in for "the edge set changed" so a follow or an
    // unfollow re-derives the counts without a page reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUser?.id, isFollowing]);

  // Guarded route: only rendered for a signed-in, active user.
  if (!currentUser || !profileUser) return null;

  const userQuestions = doubts.filter(d => d.authorId === profileUser.id);
  const userAnswers = answers.filter(a => a.authorId === profileUser.id);
  const acceptedAnswers = userAnswers.filter(a => a.isAccepted);

  const shown = {
    questions: stats?.questionsCount ?? profileUser.questionsCount,
    answers: stats?.answersCount ?? profileUser.answersCount,
    accepted: stats?.acceptedCount ?? profileUser.acceptedCount,
    reputation: stats?.reputation ?? profileUser.reputation,
    followers: stats?.followersCount ?? profileUser.followersCount,
    following: stats?.followingCount ?? 0
  };
  const badges = stats?.badges ?? profileUser.badges ?? [];

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        {/* Cover Image */}
        <div className="h-44 sm:h-52 w-full relative bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 overflow-hidden">
          {profileUser.coverImage ? (
            <img
              src={profileUser.coverImage}
              alt="Cover"
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-900 to-slate-900" />
          )}
        </div>

        {/* Profile Info Row */}
        <div className="p-6 sm:p-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-6">
            <div className="flex items-end gap-4">
              <div className="relative">
                <img
                  src={profileUser.avatar}
                  alt={profileUser.name}
                  className="w-24 sm:w-32 h-24 sm:h-32 rounded-3xl object-cover border-4 border-slate-900 shadow-2xl bg-slate-800"
                />
                {profileUser.isOnline && (
                  <span className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-emerald-400 ring-4 ring-slate-900" />
                )}
              </div>
              <div className="mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {profileUser.name}
                  </h1>
                  {profileUser.role === 'mentor' && (
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      Mentor
                    </span>
                  )}
                  {profileUser.role === 'admin' && (
                    <span className="text-xs font-semibold text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      Department Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  @{profileUser.username} · {profileUser.department} ({profileUser.year} Year)
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              {!isSelf ? (
                <>
                  <button
                    onClick={() => toggleFollowUser(profileUser.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                      isFollowing
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Follow Student</span>
                      </>
                    )}
                  </button>

                  <Link
                    to="/app/messages"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                  </Link>
                </>
              ) : (
                <Link
                  to="/app/settings"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  Edit Profile
                </Link>
              )}
            </div>
          </div>

          {/* Bio & Skills */}
          <div className="max-w-2xl space-y-3">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {profileUser.bio}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
                Skills:
              </span>
              {profileUser.skills.map(s => (
                <span
                  key={s}
                  className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {profileUser.joinedDate}</span>
              </span>
            </div>

            {(profileUser.github || profileUser.linkedin || profileUser.website) && (
              <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1">
                {profileUser.github && (
                  <a
                    href={`https://${profileUser.github.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-slate-400 hover:text-indigo-300 font-mono"
                  >
                    {profileUser.github}
                  </a>
                )}
                {profileUser.linkedin && (
                  <a
                    href={`https://${profileUser.linkedin.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-slate-400 hover:text-indigo-300 font-mono"
                  >
                    {profileUser.linkedin}
                  </a>
                )}
                {profileUser.website && (
                  <a
                    href={`https://${profileUser.website.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-slate-400 hover:text-indigo-300 font-mono"
                  >
                    {profileUser.website}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-lg font-bold text-white font-mono tabular-nums">
                {shown.questions}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Questions</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-lg font-bold text-white font-mono tabular-nums">
                {shown.answers}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Answers</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
                {shown.accepted}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Accepted</div>
            </div>

            <Link
              to="/app/reputation"
              className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors block"
            >
              <div className="text-lg font-bold text-amber-400 font-mono tabular-nums">
                {shown.reputation}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Reputation</div>
            </Link>

            <Link
              to={`/app/users/${profileUser.id}/followers`}
              className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors block"
            >
              <div className="text-lg font-bold text-indigo-400 font-mono tabular-nums">
                {shown.followers}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Followers</div>
            </Link>

            <Link
              to={`/app/users/${profileUser.id}/following`}
              className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors block"
            >
              <div className="text-lg font-bold text-slate-300 font-mono tabular-nums">
                {shown.following}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Following</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'questions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Questions ({userQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab('answers')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'answers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Answers Given ({userAnswers.length})
        </button>
        <button
          onClick={() => setActiveTab('accepted')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'accepted' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Accepted Solutions ({acceptedAnswers.length})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'activity' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'badges' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Badges ({badges.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Badges Section */}
            {badges.length > 0 && (
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Academic Honors & Badges</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {badges.map(b => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{b.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{b.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Questions preview */}
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Recent Questions</h3>
              {userQuestions.length > 0 ? (
                <div className="space-y-3">
                  {userQuestions.slice(0, 3).map(d => (
                    <DoubtCard key={d.id} doubt={d} />
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
                  No questions asked yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            {userQuestions.length > 0 ? (
              userQuestions.map(d => <DoubtCard key={d.id} doubt={d} />)
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
                No questions asked yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'answers' && (
          <div className="space-y-4">
            {userAnswers.length > 0 ? (
              userAnswers.map(a => (
                <div key={a.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Answered {a.createdAt}</span>
                    <span className="font-mono text-emerald-400">▲ {a.upvotes} upvotes</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-3">{a.content}</p>
                  <Link to={`/app/doubts/${a.doubtId}`} className="text-xs text-indigo-400 hover:underline inline-block pt-1">
                    View full discussion →
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
                No answers contributed yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'accepted' && (
          <div className="space-y-4">
            {acceptedAnswers.length > 0 ? (
              acceptedAnswers.map(a => (
                <div key={a.id} className="p-5 rounded-2xl bg-slate-900/80 border-2 border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs text-emerald-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accepted by Question Author</span>
                    </span>
                    <span className="font-mono">▲ {a.upvotes}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-3">{a.content}</p>
                  <Link to={`/app/doubts/${a.doubtId}`} className="text-xs text-indigo-400 hover:underline inline-block pt-1">
                    Open solved thread →
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
                No accepted answers yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-4">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Recent Activity</span>
            </h3>
            {activity === null ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading activity…</div>
            ) : activity.length > 0 ? (
              <ol className="space-y-3">
                {activity.map(item => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <span className="mt-0.5 shrink-0 text-indigo-400">
                      <Activity className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.detail}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-slate-500 font-mono">
                      {relativeTime(item.createdAtMs)}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-950 border border-dashed border-slate-800">
                Nothing to show yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Badges Held</span>
            </h3>
            {badges.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {badges.map(b => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <Award className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{b.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">
                          {b.tier}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{b.description}</div>
                      <div className="text-[10px] text-slate-600 font-mono mt-1">
                        {absoluteDate(Date.parse(b.unlockedAt))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-950 border border-dashed border-slate-800">
                No badges yet - ask a question, post an answer or get one accepted to earn the
                first ones.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
