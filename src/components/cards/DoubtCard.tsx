import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Bookmark,
  Share2,
  CheckCircle2,
  Lock,
  Eye,
  MoreVertical,
  Flag,
  Trash2,
  Pencil,
  AlertTriangle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Doubt } from '../../types';
import { useApp } from '../../context/AppContext';
import { ReportModal } from '../modals/ReportModal';
import { ShareModal } from '../modals/ShareModal';

interface DoubtCardProps {
  doubt: Doubt;
  onTagClick?: (tag: string) => void;
  showDelete?: boolean;
}

export const DoubtCard: React.FC<DoubtCardProps> = ({ doubt, onTagClick, showDelete = false }) => {
  const navigate = useNavigate();
  const { toggleVoteDoubt, toggleBookmark, bookmarkedDoubtIds, deleteDoubt, currentUser } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Cards only ever render inside the authenticated app shell.
  if (!currentUser) return null;

  const isBookmarked = bookmarkedDoubtIds.includes(doubt.id);
  const isAuthor = currentUser.id === doubt.authorId || currentUser.role === 'admin';

  const handleVote = (e: React.MouseEvent, type: 'up' | 'down') => {
    e.stopPropagation();
    e.preventDefault();
    toggleVoteDoubt(doubt.id, type);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleBookmark(doubt.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowShare(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm('Are you sure you want to delete this doubt?')) {
      deleteDoubt(doubt.id);
    }
  };

  return (
    <>
      <motion.article
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className="group relative rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 p-5 shadow-sm hover:shadow-md transition-all text-slate-100"
      >
        <div className="flex items-start gap-4">
          {/* Vertical Vote Control */}
          <div className="flex flex-col items-center bg-slate-950/60 rounded-xl p-1 border border-slate-800/70 shrink-0">
            <button
              onClick={e => handleVote(e, 'up')}
              className={`p-1.5 rounded-lg transition-all ${
                doubt.userVote === 'up'
                  ? 'text-indigo-400 bg-indigo-500/20 scale-105'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800'
              }`}
              title="Upvote solution"
              aria-label="Upvote"
            >
              <ChevronUp className="w-5 h-5 stroke-[2.5]" />
            </button>
            <span
              className={`text-xs font-semibold font-mono tabular-nums my-0.5 ${
                doubt.userVote === 'up'
                  ? 'text-indigo-400'
                  : doubt.userVote === 'down'
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {doubt.upvotes - doubt.downvotes}
            </span>
            <button
              onClick={e => handleVote(e, 'down')}
              className={`p-1.5 rounded-lg transition-all ${
                doubt.userVote === 'down'
                  ? 'text-rose-400 bg-rose-500/20 scale-105'
                  : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800'
              }`}
              title="Downvote"
              aria-label="Downvote"
            >
              <ChevronDown className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Main Card Body */}
          <div className="flex-1 min-w-0">
            {/* Header: Author info & clean unboxed metadata */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Link
                  to={`/app/users/${doubt.authorId}`}
                  className="flex items-center gap-2 group/author"
                  onClick={e => e.stopPropagation()}
                >
                  <img
                    src={doubt.authorSnapshot.avatar}
                    alt={doubt.authorSnapshot.name}
                    className="w-7 h-7 rounded-full object-cover border border-slate-700/80 group-hover/author:border-indigo-400 transition-colors"
                  />
                  <span className="text-xs font-semibold text-slate-200 group-hover/author:text-indigo-300 transition-colors">
                    {doubt.authorSnapshot.name}
                  </span>
                </Link>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>{doubt.authorSnapshot.department}</span>
                  <span aria-hidden="true">·</span>
                  <span>{doubt.authorSnapshot.year} Year</span>
                  <span aria-hidden="true">·</span>
                  <span>{doubt.createdAt}</span>
                </div>
              </div>

              {/* Status Indicators & Menu */}
              <div className="flex items-center gap-2">
                {doubt.visibility === 'private' ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    <Lock className="w-3 h-3" />
                    <span>Private Doubt</span>
                  </span>
                ) : null}

                {doubt.hasAcceptedAnswer && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Solved</span>
                  </span>
                )}

                {(doubt.priority === 'high' || doubt.priority === 'urgent') && (
                  <span
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      doubt.priority === 'urgent'
                        ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    <span className="capitalize">{doubt.priority}</span>
                  </span>
                )}

                <div className="relative">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowMenu(!showMenu);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    aria-label="Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showMenu && (
                    <div
                      onClick={e => e.stopPropagation()}
                      className="absolute right-0 mt-1 w-36 rounded-xl bg-slate-900 border border-slate-700/80 shadow-xl py-1 z-20"
                    >
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowReport(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-rose-400 text-left transition-colors"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Report</span>
                      </button>
                      {isAuthor && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            navigate(`/app/doubts/${doubt.id}/edit`);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-indigo-300 text-left transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      {(isAuthor || showDelete) && (
                        <button
                          onClick={handleDelete}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 text-left transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Title & Preview */}
            <Link to={`/app/doubts/${doubt.id}`} className="block group/link">
              <h2 className="text-base font-bold text-white group-hover/link:text-indigo-300 transition-colors leading-snug tracking-tight">
                {doubt.title}
              </h2>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed line-clamp-2">
                {doubt.description}
              </p>
            </Link>

            {/* Category and Tags */}
            <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-indigo-400 font-medium hover:underline cursor-pointer" onClick={() => navigate(`/app/explore?category=${encodeURIComponent(doubt.category)}`)}>
                {doubt.category}
              </span>
              <span className="text-slate-600" aria-hidden="true">/</span>
              {doubt.tags.map(tag => (
                <button
                  key={tag}
                  onClick={e => {
                    e.stopPropagation();
                    if (onTagClick) onTagClick(tag);
                    else navigate(`/app/explore?tag=${tag}`);
                  }}
                  className="font-mono text-[11px] text-slate-400 hover:text-indigo-300 hover:underline transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>

            {/* Footer Stats & Actions */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <Link
                  to={`/app/doubts/${doubt.id}`}
                  className="flex items-center gap-1.5 hover:text-indigo-300 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-300 tabular-nums">{doubt.answersCount}</span>
                  <span className="hidden sm:inline">answers</span>
                </Link>

                <div className="flex items-center gap-1.5 text-slate-400">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span className="tabular-nums">{doubt.views}</span>
                  <span className="hidden sm:inline">views</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleBookmark}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isBookmarked
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                  aria-label="Bookmark"
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={handleShare}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Share Question"
                  aria-label="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.article>

      {/* Modals */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="doubt"
        targetId={doubt.id}
        targetTitle={doubt.title}
        reportedUserId={doubt.authorId}
        reportedUserName={doubt.authorSnapshot.name}
      />

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title={doubt.title}
        url={`/app/doubts/${doubt.id}`}
      />
    </>
  );
};
