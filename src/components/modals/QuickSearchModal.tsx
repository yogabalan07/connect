import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, HelpCircle, User as UserIcon, Hash, Folder, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { doubts, users, tags, categories } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredDoubts = doubts
    .filter(d => d.title.toLowerCase().includes(query.toLowerCase()) || d.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
    .slice(0, 4);

  const filteredUsers = users
    .filter(u => u.name.toLowerCase().includes(query.toLowerCase()) || u.skills.some(s => s.toLowerCase().includes(query.toLowerCase())))
    .slice(0, 3);

  const filteredTags = tags
    .filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4);

  const filteredCats = categories
    .filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 3);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden z-10 text-slate-100"
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/50">
              <Search className="w-5 h-5 text-indigo-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search doubts, users, tags, subjects..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                ESC
              </span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {/* Doubts Section */}
              {filteredDoubts.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Questions</span>
                  </div>
                  <div className="space-y-1.5">
                    {filteredDoubts.map(d => (
                      <button
                        key={d.id}
                        onClick={() => handleSelect(`/app/doubts/${d.id}`)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 text-left transition-colors group"
                      >
                        <div className="flex-1 pr-3">
                          <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 line-clamp-1">
                            {d.title}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{d.author.name}</span>
                            <span>·</span>
                            <span>{d.category}</span>
                            <span>·</span>
                            <span>{d.answersCount} answers</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Section */}
              {filteredUsers.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Students & Mentors</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelect(`/app/users/${u.id}`)}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800/80 text-left transition-colors border border-slate-800"
                      >
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate">{u.name}</div>
                          <div className="text-[10px] text-slate-400">{u.department} · {u.year}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Section */}
              {filteredTags.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredTags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelect(`/app/explore?tag=${t.name}`)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 border border-slate-700 text-xs font-mono text-slate-300 transition-colors"
                      >
                        #{t.name} ({t.count})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories Section */}
              {filteredCats.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-sky-400" />
                    <span>Categories</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredCats.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(`/app/explore?category=${encodeURIComponent(c.name)}`)}
                        className="p-2.5 rounded-xl hover:bg-slate-800/80 border border-slate-800/70 text-left transition-colors"
                      >
                        <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.questionsCount} doubts</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredDoubts.length === 0 && filteredUsers.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No matching doubts or users found for "{query}".
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
