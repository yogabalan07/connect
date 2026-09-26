import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReportReason } from '../../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'doubt' | 'answer' | 'user' | 'comment';
  targetId: string;
  targetTitle: string;
  reportedUserId: string;
  reportedUserName: string;
}

const REASONS: ReportReason[] = [
  'Spam',
  'Wrong information',
  'Abusive content',
  'Inappropriate content',
  'Harassment',
  'Duplicate question',
  'Other'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  reportedUserId,
  reportedUserName
}) => {
  const { createReport } = useApp();
  const [reason, setReason] = useState<ReportReason>('Wrong information');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes the dialog, focus lands on it when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = description.trim();
    if (reason === 'Other' && trimmed.length < 10) {
      setError('Please describe the issue (at least 10 characters) when choosing "Other".');
      return;
    }
    if (trimmed.length > 1000) {
      setError('Report description must be 1000 characters or fewer.');
      return;
    }

    setIsSubmitting(true);
    const created = await createReport({
      targetType,
      targetId,
      targetTitle,
      reportedUserId,
      reportedUserName,
      reason,
      description: trimmed
    });
    setIsSubmitting(false);

    if (created) {
      setDescription('');
      onClose();
    } else {
      setError('The report could not be filed. See the toast for details.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-slate-100 z-10 focus:outline-none"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="report-modal-title" className="text-base font-semibold text-white">
                    Report Content
                  </h3>
                  <p className="text-xs text-slate-400">Helps keep the college forum academic &amp; safe</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close report dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">Target</span>
                <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300">
                  <span className="font-semibold text-slate-200 capitalize">{targetType}: </span>
                  <span className="text-slate-300 line-clamp-1">{targetTitle}</span>
                  <div className="mt-1 text-[11px] text-slate-400">Author: {reportedUserName}</div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Reason for Report
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map(r => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setReason(r)}
                      aria-pressed={reason === r}
                      className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                        reason === r
                          ? 'border-rose-500/60 bg-rose-500/15 text-rose-200 shadow-sm'
                          : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="report-description"
                  className="text-xs font-semibold text-slate-300 block mb-1.5"
                >
                  Detailed Explanation {reason === 'Other' ? '(required)' : '(optional)'}
                </label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Provide context or links to clarify the issue..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-medium"
                >
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-md disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
