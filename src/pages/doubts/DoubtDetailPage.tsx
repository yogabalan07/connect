import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronUp,
  ChevronDown,
  Bookmark,
  Share2,
  Flag,
  CheckCircle2,
  Lock,
  MessageSquare,
  Paperclip,
  Send,
  Eye,
  ArrowLeft,
  Code2,
  Bold,
  Italic,
  List,
  Link2,
  AtSign,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Pencil,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { CodeBlock } from '../../components/doubts/CodeBlock';
import { ReportModal } from '../../components/modals/ReportModal';
import { ShareModal } from '../../components/modals/ShareModal';
import { canViewDoubt } from '../../services/doubtService';
import {
  canDeleteComment,
  canEditAnswer,
  canEditComment,
  useAnswersStore
} from '../../services/answerService';
import { useDoubts } from '../../hooks/useDoubts';
import { Answer, Comment } from '../../types';

/** Matches `@handle` in rendered copy, mirroring `utils/mentions.ts`. */
const MENTION_RENDER = /@([A-Za-z0-9_]{2,32})/g;

/** Highlights @handles so a mention reads as a mention, not as plain text. */
const MentionText: React.FC<{ text: string }> = ({ text }) => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RENDER)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span key={`${start}-${match[1]}`} className="font-semibold text-indigo-300">
        @{match[1]}
      </span>
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};

export const DoubtDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getDoubtById,
    getAnswersForDoubt,
    loadAnswersForDoubt,
    addAnswer,
    acceptAnswer,
    toggleVoteDoubt,
    toggleVoteAnswer,
    toggleBookmark,
    bookmarkedDoubtIds,
    getDoubtComments,
    addCommentToDoubt,
    addCommentToAnswer,
    updateComment,
    deleteComment,
    updateAnswer,
    deleteAnswer,
    currentUser,
    users
  } = useApp();
  const { status: doubtsStatus, incrementViews, reload } = useDoubts();

  const doubt = id ? getDoubtById(id) : undefined;
  const answers = id ? getAnswersForDoubt(id) : [];
  const doubtComments = id ? getDoubtComments(id) : [];

  // Store lifecycle for this doubt's answers (skeleton / retry copy).
  const { status: answersStatus } = useAnswersStore();

  // Local editor state
  const [editorContent, setEditorContent] = useState('');
  const [editorCode, setEditorCode] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('cpp');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment input per answer
  const [commentInputs, setCommentInputs] = useState<{ [answerId: string]: string }>({});
  const [activeCommentBox, setActiveCommentBox] = useState<string | null>(null);

  // Doubt-level clarification thread (one box, keyed by the question itself)
  const [showDoubtCommentBox, setShowDoubtCommentBox] = useState(false);
  const [doubtCommentText, setDoubtCommentText] = useState('');

  // Inline comment editing, shared by the question and answer threads
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Modals
  const [showReport, setShowReport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'doubt' | 'answer';
    id: string;
    title: string;
    userId: string;
    userName: string;
  } | null>(null);

  // In-place answer editing
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerText, setEditAnswerText] = useState('');
  const [editAnswerCode, setEditAnswerCode] = useState('');

  // Declared before every early return so the hook order never changes.
  useEffect(() => {
    if (!id || !currentUser) return;
    void loadAnswersForDoubt(id);
  }, [id, currentUser, loadAnswersForDoubt]);

  useEffect(() => {
    if (!id || !doubt || doubtsStatus !== 'ready') return;
    incrementViews(id);
    // `doubt.id` is the identity that decides "a different doubt was opened";
    // the surrounding object changes on every optimistic counter update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, doubt?.id, doubtsStatus]);

  // Guarded route: only rendered for a signed-in, active user.
  if (!currentUser) return null;

  if (doubtsStatus === 'loading') {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4" role="status" aria-busy="true">
        <div className="h-6 w-2/3 rounded bg-slate-800 animate-pulse" />
        <div className="h-3 w-full rounded bg-slate-800/80 animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-slate-800/80 animate-pulse" />
        <span className="sr-only">Loading question…</span>
      </div>
    );
  }

  if (doubtsStatus === 'error') {
    return (
      <div className="p-10 text-center rounded-2xl bg-slate-900/60 border border-rose-500/30 space-y-3" role="alert">
        <h2 className="text-base font-bold text-white">We could not load this question</h2>
        <p className="text-xs text-slate-400">Campus services are unreachable right now. Check your connection and try again.</p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!doubt) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
        <h2 className="text-base font-bold text-white">Doubt not found</h2>
        <p className="mt-1 text-xs text-slate-400">The requested question might have been removed or relocated.</p>
        <Link to="/app" className="mt-4 inline-block text-xs font-semibold text-indigo-400 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isBookmarked = bookmarkedDoubtIds.includes(doubt.id);
  const isQuestionAuthor = currentUser.id === doubt.authorId || currentUser.role === 'admin';
  const isPrivate = doubt.visibility === 'private';

  // Private doubt check (deny by default — same rule as the feed filter).
  const hasAccess = canViewDoubt(doubt, currentUser);

  if (!hasAccess) {
    // Restricted: reveal nothing about the question itself.
    return (
      <div className="p-10 text-center rounded-2xl bg-slate-900/60 border border-amber-500/30 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-white">Private question</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          This question is shared with a limited participant list. You are not on it, so its title,
          description, code and answers stay hidden.
        </p>
        <p className="text-[11px] text-slate-500">
          Ask the author or a campus mentor to invite you if you need access.
        </p>
        <Link
          to="/app/explore"
          className="inline-block mt-2 text-xs font-semibold text-indigo-400 hover:underline"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const handleVoteQuestion = (type: 'up' | 'down') => {
    void toggleVoteDoubt(doubt.id, type);
  };

  const handleAcceptAnswer = (answerId: string) => {
    void acceptAnswer(doubt.id, answerId);
    // Subtle confetti trigger
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleCommentSubmit = (answerId: string) => {
    const text = commentInputs[answerId];
    if (!text || !text.trim()) return;
    void addCommentToAnswer(answerId, text.trim());
    setCommentInputs(prev => ({ ...prev, [answerId]: '' }));
    setActiveCommentBox(null);
  };

  const handleDoubtCommentSubmit = () => {
    const text = doubtCommentText;
    if (!text.trim()) return;
    void addCommentToDoubt(doubt.id, text.trim());
    setDoubtCommentText('');
    setShowDoubtCommentBox(false);
  };

  const startEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  };

  const saveEditComment = () => {
    if (!editingCommentId || !editCommentText.trim()) return;
    void updateComment(editingCommentId, editCommentText.trim());
    setEditingCommentId(null);
  };

  const removeComment = (comment: Comment) => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    void deleteComment(comment.id);
  };

  /**
   * One comment row, used by the question thread and every answer thread.
   * Both edit and delete are author-or-admin, matching the rules.
   */
  const renderComment = (comment: Comment) => {
    const editing = editingCommentId === comment.id;
    return (
      <div
        key={comment.id}
        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300"
      >
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 gap-2">
          <span className="font-semibold text-slate-200">{comment.authorName}</span>
          <span className="flex items-center gap-2 shrink-0">
            <span>{comment.updatedAt ? `edited ${comment.updatedAt}` : comment.createdAt}</span>
            {canEditComment(comment, currentUser) && (
              <button
                type="button"
                onClick={() => startEditComment(comment)}
                className="text-slate-500 hover:text-indigo-400 transition-colors"
                title="Edit comment"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {canDeleteComment(comment, currentUser) && (
              <button
                type="button"
                onClick={() => removeComment(comment)}
                className="text-slate-500 hover:text-rose-400 transition-colors"
                title="Delete comment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </span>
        </div>

        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editCommentText}
              onChange={e => setEditCommentText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEditComment();
                if (e.key === 'Escape') setEditingCommentId(null);
              }}
              autoFocus
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCommentId(null)}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditComment}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-300">
            <MentionText text={comment.content} />
          </p>
        )}
      </div>
    );
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorContent.trim()) return;
    setIsSubmitting(true);

    try {
      await addAnswer(
        doubt.id,
        editorContent.trim(),
        editorCode.trim() ? { language: editorLanguage, code: editorCode.trim() } : undefined
      );
      setEditorContent('');
      setEditorCode('');
      setShowCodeInput(false);

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.7 }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertMarkdown = (syntax: string) => {
    setEditorContent(prev => prev + syntax);
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Doubts</span>
        </button>
      </div>

      {/* Private Doubt Banner */}
      {isPrivate && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-200">
                🔒 Confidential Private Discussion
              </div>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Only invited project participants and mentors have access to view and reply to this technical doubt.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-amber-400/80 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 shrink-0">
            {doubt.allowedUserIds?.length || 2} Participants
          </div>
        </div>
      )}

      {/* Main Question Card */}
      <article className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-sm text-slate-100">
        <div className="flex items-start gap-4">
          {/* Vertical Vote Widget */}
          <div className="flex flex-col items-center bg-slate-950/70 rounded-xl p-1.5 border border-slate-800 shrink-0">
            <button
              onClick={() => handleVoteQuestion('up')}
              className={`p-1.5 rounded-lg transition-colors ${
                doubt.userVote === 'up'
                  ? 'text-indigo-400 bg-indigo-500/20'
                  : 'text-slate-400 hover:text-indigo-300'
              }`}
              title="Upvote"
              aria-label="Upvote"
            >
              <ChevronUp className="w-6 h-6 stroke-[2.5]" />
            </button>
            <span className="text-sm font-bold font-mono tabular-nums my-1">
              {doubt.upvotes - doubt.downvotes}
            </span>
            <button
              onClick={() => handleVoteQuestion('down')}
              className={`p-1.5 rounded-lg transition-colors ${
                doubt.userVote === 'down'
                  ? 'text-rose-400 bg-rose-500/20'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
              title="Downvote"
              aria-label="Downvote"
            >
              <ChevronDown className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Question Details */}
          <div className="flex-1 min-w-0">
            {/* Header info */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Link to={`/app/users/${doubt.authorId}`} className="flex items-center gap-2 group">
                  <img
                    src={doubt.authorSnapshot.avatar}
                    alt={doubt.authorSnapshot.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {doubt.authorSnapshot.name}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {doubt.authorSnapshot.department} · {doubt.authorSnapshot.year} Year
                    </div>
                  </div>
                </Link>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-xs text-slate-400">{doubt.createdAt}</span>
              </div>

              {/* Status / Badges */}
              <div className="flex items-center gap-2">
                {doubt.hasAcceptedAnswer && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Solved</span>
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight">
              {doubt.title}
            </h1>

            {/* Unboxed Metadata & Category */}
            <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
              <span className="text-indigo-400 font-medium">{doubt.category}</span>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <span className="text-slate-400">{doubt.subject}</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-400 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span className="tabular-nums">{doubt.views} views</span>
              </span>
            </div>

            {/* Question Body */}
            <div className="mt-5 text-sm text-slate-200 leading-relaxed space-y-4">
              <p className="whitespace-pre-line">{doubt.description}</p>
            </div>

            {/* Code Snippet if present */}
            {doubt.codeSnippet && (
              <div className="mt-4">
                <CodeBlock
                  code={doubt.codeSnippet.code}
                  language={doubt.codeSnippet.language}
                />
              </div>
            )}

            {/* Attachments if present */}
            {doubt.attachments && doubt.attachments.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Attachments ({doubt.attachments.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {doubt.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-mono text-[11px] truncate max-w-[140px]">{att.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({att.size})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="mt-5 flex items-center gap-2 flex-wrap">
              {doubt.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/app/explore?tag=${tag}`}
                  className="font-mono text-xs text-slate-400 hover:text-indigo-300 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-medium text-slate-300">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span>{answers.length} Solutions</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isQuestionAuthor && (
                  <Link
                    to={`/app/doubts/${doubt.id}/edit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title="Edit question"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>
                )}

                <button
                  onClick={() => toggleBookmark(doubt.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    isBookmarked
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                  <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
                </button>

                <button
                  onClick={() => setShowShare(true)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setReportTarget({
                      type: 'doubt',
                      id: doubt.id,
                      title: doubt.title,
                      userId: doubt.authorId,
                      userName: doubt.authorSnapshot.name
                    });
                    setShowReport(true);
                  }}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 transition-colors"
                  title="Report question"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Question-level clarification thread */}
      <section className="rounded-3xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Clarifications on this question ({doubtComments.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowDoubtCommentBox(open => !open)}
            className="text-xs text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{showDoubtCommentBox ? 'Close' : 'Add clarification'}</span>
          </button>
        </div>

        {doubtComments.length > 0 ? (
          <div className="space-y-2">{doubtComments.map(renderComment)}</div>
        ) : (
          <p className="text-xs text-slate-500">
            Nothing here yet. Use this thread to ask the author for detail before a solution is
            written.
          </p>
        )}

        {showDoubtCommentBox && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={doubtCommentText}
              onChange={e => setDoubtCommentText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleDoubtCommentSubmit();
              }}
              placeholder="Ask a concise clarification on the question..."
              autoFocus
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleDoubtCommentSubmit}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Send
            </button>
          </div>
        )}
      </section>

      {/* Answers Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Community Solutions</span>
            <span className="text-xs font-mono font-normal text-slate-400">
              ({answers.length})
            </span>
          </h2>
          {doubt.hasAcceptedAnswer && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified by Author</span>
            </span>
          )}
        </div>

        {answersStatus === 'loading' ? (
          <div className="space-y-3" role="status" aria-busy="true">
            <div className="h-24 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            <div className="h-24 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            <span className="sr-only">Loading solutions…</span>
          </div>
        ) : answersStatus === 'error' ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-rose-500/30" role="alert">
            <p className="text-xs text-slate-400">
              We could not load the solutions for this question. Refresh the page to try again.
            </p>
          </div>
        ) : answers.length > 0 ? (
          <div className="space-y-4">
            {answers.map(ans => {
              const isAccepted = ans.isAccepted;
              return (
                <div
                  key={ans.id}
                  className={`rounded-3xl p-5 sm:p-6 transition-all text-slate-100 ${
                    isAccepted
                      ? 'bg-slate-900 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                      : 'bg-slate-900/80 border border-slate-800/80'
                  }`}
                >
                  {/* Accepted Solution Banner */}
                  {isAccepted && (
                    <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Accepted Solution</span>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Vertical Answer Vote */}
                    <div className="flex flex-col items-center bg-slate-950/60 rounded-xl p-1 border border-slate-800 shrink-0">
                      <button
                        onClick={() => toggleVoteAnswer(ans.id, 'up')}
                        className={`p-1 rounded-lg transition-colors ${
                          ans.userVote === 'up'
                            ? 'text-indigo-400 bg-indigo-500/20'
                            : 'text-slate-400 hover:text-indigo-300'
                        }`}
                      >
                        <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                      </button>
                      <span className="text-xs font-bold font-mono tabular-nums my-0.5">
                        {ans.upvotes - ans.downvotes}
                      </span>
                      <button
                        onClick={() => toggleVoteAnswer(ans.id, 'down')}
                        className={`p-1 rounded-lg transition-colors ${
                          ans.userVote === 'down'
                            ? 'text-rose-400 bg-rose-500/20'
                            : 'text-slate-400 hover:text-rose-300'
                        }`}
                      >
                        <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Answer content */}
                    <div className="flex-1 min-w-0">
                      {/* Author Header */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <Link to={`/app/users/${ans.authorId}`} className="flex items-center gap-2.5 group">
                          <img
                            src={ans.authorSnapshot.avatar}
                            alt={ans.authorSnapshot.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {ans.authorSnapshot.name}
                              </span>
                              {ans.authorSnapshot.role === 'mentor' && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                  Mentor
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {ans.authorSnapshot.department} · {ans.authorSnapshot.reputation} rep · {ans.createdAt}
                            </div>
                          </div>
                        </Link>

                        {/* Accept Button (Author / Admin Only) */}
                        {isQuestionAuthor && (
                          <button
                            onClick={() => handleAcceptAnswer(ans.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              isAccepted
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-300 border border-slate-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isAccepted ? 'Accepted' : 'Mark as Accepted'}</span>
                          </button>
                        )}

                        {/* Edit / Delete (answer author or admin) */}
                        {canEditAnswer(ans, currentUser) && editingAnswerId !== ans.id && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAnswerId(ans.id);
                                setEditAnswerText(ans.content);
                                setEditAnswerCode(ans.codeSnippet?.code ?? '');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Delete this answer permanently?')) {
                                  deleteAnswer(ans.id);
                                }
                              }}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                              title="Delete answer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content Prose (or inline editor) */}
                      {editingAnswerId === ans.id ? (
                        <div className="space-y-2">
                          <label htmlFor={`edit-answer-${ans.id}`} className="sr-only">
                            Answer text
                          </label>
                          <textarea
                            id={`edit-answer-${ans.id}`}
                            rows={6}
                            value={editAnswerText}
                            onChange={e => setEditAnswerText(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <label
                            htmlFor={`edit-answer-code-${ans.id}`}
                            className="text-[11px] font-semibold text-slate-400 block"
                          >
                            Code snippet (optional)
                          </label>
                          <textarea
                            id={`edit-answer-code-${ans.id}`}
                            rows={4}
                            value={editAnswerCode}
                            onChange={e => setEditAnswerCode(e.target.value)}
                            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingAnswerId(null)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!editAnswerText.trim()) return;
                                updateAnswer(ans.id, {
                                  content: editAnswerText.trim(),
                                  codeSnippet: editAnswerCode.trim()
                                    ? {
                                        language: ans.codeSnippet?.language ?? 'cpp',
                                        code: editAnswerCode.trim()
                                      }
                                    : undefined
                                });
                                setEditingAnswerId(null);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                            >
                              Save changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line space-y-2">
                            {ans.content}
                          </div>

                          {/* Code Block if any */}
                          {ans.codeSnippet && (
                            <div className="mt-3">
                              <CodeBlock
                                code={ans.codeSnippet.code}
                                language={ans.codeSnippet.language}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {/* Comments Thread */}
                      {ans.comments && ans.comments.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Clarification Comments ({ans.comments.length})
                          </span>
                          {ans.comments.map(renderComment)}
                        </div>
                      )}

                      {/* Add comment input */}
                      <div className="mt-3 flex items-center justify-between">
                        <button
                          onClick={() =>
                            setActiveCommentBox(activeCommentBox === ans.id ? null : ans.id)
                          }
                          className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Add clarification comment</span>
                        </button>

                        <button
                          onClick={() => {
                            setReportTarget({
                              type: 'answer',
                              id: ans.id,
                              title: `Answer by ${ans.authorSnapshot.name}`,
                              userId: ans.authorId,
                              userName: ans.authorSnapshot.name
                            });
                            setShowReport(true);
                          }}
                          className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          Report
                        </button>
                      </div>

                      {activeCommentBox === ans.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={commentInputs[ans.id] || ''}
                            onChange={e =>
                              setCommentInputs({ ...commentInputs, [ans.id]: e.target.value })
                            }
                            placeholder="Write a concise clarification comment..."
                            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleCommentSubmit(ans.id)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                          >
                            Send
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <p className="text-xs text-slate-400">
              No solutions submitted yet. Be the first senior or peer to answer!
            </p>
          </div>
        )}
      </section>

      {/* Answer Editor Section */}
      <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Contribute Your Solution</h3>
              <p className="text-xs text-slate-400">
                Help fellow students master this topic. High quality answers earn +15 reputation!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setEditorMode('write')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                editorMode === 'write' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('preview')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                editorMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        <form onSubmit={handleAnswerSubmit} className="space-y-4">
          {editorMode === 'write' ? (
            <div>
              {/* Editor Formatting Toolbar */}
              <div className="flex items-center gap-1 p-1.5 rounded-t-xl bg-slate-950 border border-b-0 border-slate-800 text-slate-400">
                <button
                  type="button"
                  onClick={() => insertMarkdown('**bold**')}
                  className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('*italic*')}
                  className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('`code`')}
                  className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
                  title="Inline Code"
                >
                  <Code2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('\n- Point 1\n- Point 2\n')}
                  className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('@')}
                  className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
                  title="Tag User"
                >
                  <AtSign className="w-3.5 h-3.5" />
                </button>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => setShowCodeInput(!showCodeInput)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                    showCodeInput ? 'bg-indigo-600/30 text-indigo-300' : 'hover:bg-slate-800'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Attach Code Block</span>
                </button>
              </div>

              <textarea
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                required
                rows={5}
                placeholder="Explain the theoretical intuition, root cause, or step-by-step mathematical reasoning..."
                className="w-full p-4 rounded-b-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              {/* Optional Code block input */}
              {showCodeInput && (
                <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Code Snippet</span>
                    <select
                      value={editorLanguage}
                      onChange={e => setEditorLanguage(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300"
                    >
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="sql">SQL</option>
                      <option value="verilog">Verilog</option>
                    </select>
                  </div>
                  <textarea
                    value={editorCode}
                    onChange={e => setEditorCode(e.target.value)}
                    rows={4}
                    placeholder="// Paste clean formatted code here..."
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 min-h-[140px] text-xs sm:text-sm text-slate-200">
              {editorContent ? (
                <div>
                  <div className="whitespace-pre-line leading-relaxed">{editorContent}</div>
                  {editorCode && (
                    <CodeBlock code={editorCode} language={editorLanguage} />
                  )}
                </div>
              ) : (
                <span className="text-slate-500 italic">Preview will appear here once you type your solution.</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              Posting as <strong className="text-white">{currentUser.name}</strong> ({currentUser.department})
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !editorContent.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Posting...' : 'Submit Answer'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Modals */}
      {reportTarget && (
        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetTitle={reportTarget.title}
          reportedUserId={reportTarget.userId}
          reportedUserName={reportTarget.userName}
        />
      )}

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title={doubt.title}
        url={`/app/doubts/${doubt.id}`}
      />
    </div>
  );
};
