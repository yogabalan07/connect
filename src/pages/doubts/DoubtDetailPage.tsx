import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { CodeBlock } from '../../components/doubts/CodeBlock';
import { ReportModal } from '../../components/modals/ReportModal';
import { ShareModal } from '../../components/modals/ShareModal';
import { Answer } from '../../types';

export const DoubtDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getDoubtById,
    getAnswersForDoubt,
    addAnswer,
    acceptAnswer,
    toggleVoteDoubt,
    toggleVoteAnswer,
    toggleBookmark,
    bookmarkedDoubtIds,
    addCommentToAnswer,
    currentUser,
    users
  } = useApp();

  const doubt = id ? getDoubtById(id) : undefined;
  const answers = id ? getAnswersForDoubt(id) : [];

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

  // Private doubt security check
  const isPrivate = doubt.visibility === 'private';
  const hasAccess =
    !isPrivate ||
    (doubt.allowedUserIds && doubt.allowedUserIds.includes(currentUser.id)) ||
    currentUser.role === 'admin' ||
    doubt.authorId === currentUser.id;

  const handleVoteQuestion = (type: 'up' | 'down') => {
    toggleVoteDoubt(doubt.id, type);
  };

  const handleAcceptAnswer = (answerId: string) => {
    acceptAnswer(doubt.id, answerId);
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
    addCommentToAnswer(answerId, text.trim());
    setCommentInputs(prev => ({ ...prev, [answerId]: '' }));
    setActiveCommentBox(null);
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorContent.trim()) return;
    setIsSubmitting(true);

    setTimeout(() => {
      addAnswer(
        doubt.id,
        editorContent.trim(),
        editorCode.trim() ? { language: editorLanguage, code: editorCode.trim() } : undefined
      );
      setEditorContent('');
      setEditorCode('');
      setShowCodeInput(false);
      setIsSubmitting(false);

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.7 }
      });
    }, 300);
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
                    src={doubt.author.avatar}
                    alt={doubt.author.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {doubt.author.name}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {doubt.author.department} · {doubt.author.year} Year
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
                      userName: doubt.author.name
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

        {answers.length > 0 ? (
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
                            src={ans.author.avatar}
                            alt={ans.author.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {ans.author.name}
                              </span>
                              {ans.author.role === 'mentor' && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                  Mentor
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {ans.author.department} · {ans.author.reputation} rep · {ans.createdAt}
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
                      </div>

                      {/* Content Prose */}
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

                      {/* Comments Thread */}
                      {ans.comments && ans.comments.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Clarification Comments ({ans.comments.length})
                          </span>
                          {ans.comments.map(c => (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                <span className="font-semibold text-slate-200">{c.authorName}</span>
                                <span>{c.createdAt}</span>
                              </div>
                              <p className="text-slate-300">{c.content}</p>
                            </div>
                          ))}
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
                              title: `Answer by ${ans.author.name}`,
                              userId: ans.authorId,
                              userName: ans.author.name
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
                  onClick={() => insertMarkdown('@Arun ')}
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
