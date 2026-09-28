import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, X, Copy, Check, MessageSquare, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, title, url }) => {
  const { addToast } = useApp();
  const [copied, setCopied] = useState(false);

  const fullUrl = window.location.origin + url;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    addToast('Link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCampus = () => {
    const text = `Hey, check this question on Connect: "${title}" - ${fullUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
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
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 text-slate-100 z-10"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="share-modal-title" className="text-base font-semibold text-white">
                    Share Doubt
                  </h3>
                  <p className="text-xs text-slate-400">Collaborate with peers or senior study groups</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close share dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-300 font-medium line-clamp-2">"{title}"</p>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  type="text"
                  readOnly
                  value={fullUrl}
                  aria-label="Shareable link to this doubt"
                  className="bg-transparent text-xs text-slate-300 flex-1 px-2 focus:outline-none truncate font-mono"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shrink-0 active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Share via
                </span>
                <button
                  onClick={handleShareCampus}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-colors text-xs font-medium"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Share to College WhatsApp Group</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
