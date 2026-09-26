import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Lock,
  Globe,
  Upload,
  Code2,
  FileText,
  X,
  Search,
  Check,
  Send,
  Bold,
  Italic,
  List,
  Sparkles,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { CodeBlock } from '../../components/doubts/CodeBlock';
import { Attachment, DoubtPriority, User } from '../../types';

export const CreateDoubtPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const {
    categories,
    users,
    currentUser,
    createDoubt,
    updateDoubt,
    getDoubtById,
    addToast
  } = useApp();

  // Editing exists when the route carries a doubt id (/app/doubts/:id/edit).
  const editingDoubt = editId ? getDoubtById(editId) : undefined;
  const isEdit = Boolean(editingDoubt);
  const canEdit =
    Boolean(editingDoubt) &&
    Boolean(currentUser) &&
    (editingDoubt?.authorId === currentUser?.id || currentUser?.role === 'admin');

  const [title, setTitle] = useState(editingDoubt?.title ?? '');
  const [description, setDescription] = useState(editingDoubt?.description ?? '');
  const [category, setCategory] = useState(
    editingDoubt?.category || categories[0]?.name || 'Data Structures & Algorithms'
  );
  const [subject, setSubject] = useState(editingDoubt?.subject || 'Analysis of Algorithms');
  const [tagInput, setTagInput] = useState(
    editingDoubt ? editingDoubt.tags.join(', ') : 'DSA, C++'
  );
  const [priority, setPriority] = useState<DoubtPriority>(editingDoubt?.priority ?? 'normal');
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    editingDoubt?.visibility ?? 'public'
  );

  // Private doubt participants
  const [allowedUsers, setAllowedUsers] = useState<User[]>(() => {
    if (!currentUser) return [];
    if (!editingDoubt) return [currentUser];
    const ids = editingDoubt.allowedUserIds ?? [];
    return users.filter(u => ids.includes(u.id) || u.id === currentUser.id);
  });
  const [participantSearch, setParticipantSearch] = useState('');

  // Code snippet toggle
  const [hasCodeSnippet, setHasCodeSnippet] = useState(Boolean(editingDoubt?.codeSnippet));
  const [codeLanguage, setCodeLanguage] = useState(editingDoubt?.codeSnippet?.language ?? 'cpp');
  const [codeText, setCodeText] = useState(editingDoubt?.codeSnippet?.code ?? '');

  // Attachments mock
  const [attachments, setAttachments] = useState<{ name: string; size: string; type: Attachment['type'] }[]>(
    editingDoubt?.attachments?.map(a => ({ name: a.name, size: a.size, type: a.type })) ?? []
  );

  // Editor mode
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guarded route: only rendered for a signed-in, active user.
  if (!currentUser) return null;

  const characterCount = description.length;

  const handleToggleUser = (user: User) => {
    if (allowedUsers.some(u => u.id === user.id)) {
      setAllowedUsers(allowedUsers.filter(u => u.id !== user.id));
    } else {
      setAllowedUsers([...allowedUsers, user]);
    }
  };

  const handleAddMockFile = () => {
    const mockFiles = [
      { name: 'waveform_trace.png', size: '180 KB', type: 'image' as const },
      { name: 'circuit_schematic.pdf', size: '1.4 MB', type: 'pdf' as const },
      { name: 'memory_dump.txt', size: '42 KB', type: 'pdf' as const }
    ];
    const pick = mockFiles[attachments.length % mockFiles.length];
    setAttachments([...attachments, pick]);
    addToast(`Attached ${pick.name}`, 'info');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    const parsedTags = tagInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      subject,
      tags: parsedTags.length > 0 ? parsedTags : ['General'],
      visibility,
      priority,
      allowedUserIds: visibility === 'private' ? allowedUsers.map(u => u.id) : undefined,
      codeSnippet: hasCodeSnippet && codeText.trim() ? { language: codeLanguage, code: codeText.trim() } : undefined,
      attachments: attachments.map(a => ({ name: a.name, size: a.size, type: a.type, url: '#' }))
    };

    if (isEdit && editingDoubt) {
      updateDoubt(editingDoubt.id, payload);
      setIsSubmitting(false);
      navigate(`/app/doubts/${editingDoubt.id}`);
      return;
    }

    const newDoubtId = createDoubt(payload);
    setIsSubmitting(false);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    navigate(`/app/doubts/${newDoubtId}`);
  };

  const filteredUsers = users
    .filter(u => u.id !== currentUser.id && u.status === 'active')
    .filter(
      u =>
        u.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
        u.department.toLowerCase().includes(participantSearch.toLowerCase())
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isEdit ? 'Edit Academic Doubt' : 'Ask an Academic Doubt'}
            </h1>
            <p className="text-xs text-slate-400">
              {isEdit
                ? 'Update the question text, tags or visibility — your answer thread is kept.'
                : 'Get verified explanations and code solutions from peers & mentors'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'write' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'
            }`}
          >
            Live Preview
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {isEdit && !canEdit && (
          <div
            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Only the author or a campus admin can save changes to this question — you can still
              preview it here.
            </span>
          </div>
        )}
        {mode === 'write' ? (
          <div className="space-y-6">
            {/* Visibility Toggle Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block mb-3">
                Question Visibility
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    visibility === 'public'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 mt-0.5">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Public Campus Doubt</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Visible to all students, seniors, and departmental faculty.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    visibility === 'private'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">🔒 Private Doubt</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Confidential. Only invited peers, team members, and mentors can view.
                    </div>
                  </div>
                </button>
              </div>

              {/* Priority (drives feed ordering hints) */}
              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <label
                    htmlFor="doubt-priority"
                    className="text-xs font-semibold text-slate-300 block"
                  >
                    Priority
                  </label>
                  <select
                    id="doubt-priority"
                    value={priority}
                    onChange={e => setPriority(e.target.value as DoubtPriority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="low">Low - exploring / nice to know</option>
                    <option value="normal">Normal - blocking my progress</option>
                    <option value="high">High - lab submission today</option>
                    <option value="urgent">Urgent - exam in under 24h</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">
                  Urgent doubts are surfaced first to mentors on call.
                </p>
              </div>

              {/* Private Doubt User Selection Drawer */}
              {visibility === 'private' && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300">
                      Select people who can view and answer this doubt:
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {allowedUsers.length} selected
                    </span>
                  </div>

                  {/* Active tags of selected users */}
                  <div className="flex flex-wrap gap-1.5">
                    {allowedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
                      >
                        <img src={u.avatar} alt={u.name} className="w-4 h-4 rounded-full" />
                        <span>{u.name}</span>
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={() => handleToggleUser(u)}
                            className="text-slate-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* User Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={participantSearch}
                      onChange={e => setParticipantSearch(e.target.value)}
                      placeholder="Search seniors or classmates to invite..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Filtered users list */}
                  <div className="max-h-36 overflow-y-auto space-y-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                    {filteredUsers.slice(0, 6).map(u => {
                      const isSelected = allowedUsers.some(item => item.id === u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleToggleUser(u)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full" />
                            <span className="font-semibold text-slate-200">{u.name}</span>
                            <span className="text-[10px] text-slate-500">{u.department} · {u.year}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Title Field */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Question Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. How does Kalman Filter estimate state covariance matrix in noisy IMU sensor fusion?"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500">
                Be specific. Imagine asking another engineering student during a lab session.
              </p>
            </div>

            {/* Category & Subject selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Subject / Module</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Control Systems / OS Lab"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Description & Markdown Editor */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Detailed Description & Context
                </label>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {characterCount} characters
                </span>
              </div>

              {/* Formatting mini-bar */}
              <div className="flex items-center gap-1 p-1.5 rounded-t-xl bg-slate-950 border border-b-0 border-slate-800 text-slate-400">
                <button
                  type="button"
                  onClick={() => setDescription(prev => prev + '**bold text**')}
                  className="p-1 rounded hover:bg-slate-800"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDescription(prev => prev + '*italic text*')}
                  className="p-1 rounded hover:bg-slate-800"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDescription(prev => prev + '\n- Item 1\n- Item 2')}
                  className="p-1 rounded hover:bg-slate-800"
                  title="List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => setHasCodeSnippet(!hasCodeSnippet)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                    hasCodeSnippet ? 'bg-indigo-600/30 text-indigo-300' : 'hover:bg-slate-800'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Attach Code</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddMockFile}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs hover:bg-slate-800 ml-auto"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Attach File/Image</span>
                </button>
              </div>

              <textarea
                required
                rows={6}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you tried, the error message or theoretical formula you are struggling with, and expected behavior..."
                className="w-full p-4 rounded-b-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              {/* Optional Code block input */}
              {hasCodeSnippet && (
                <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Code Snippet</span>
                    <select
                      value={codeLanguage}
                      onChange={e => setCodeLanguage(e.target.value)}
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
                    rows={4}
                    value={codeText}
                    onChange={e => setCodeText(e.target.value)}
                    placeholder="// Paste your minimal reproducible code or algorithm snippet..."
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              {/* Attachments list */}
              {attachments.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{att.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({att.size})</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags Input */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="e.g. KalmanFilter, ESP32, FreeRTOS, Robotics"
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Add up to 5 relevant tags so seniors subscribed to those subjects receive notifications.
              </p>
            </div>
          </div>
        ) : (
          /* Live Preview Mode */
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
              <Sparkles className="w-4 h-4" />
              <span>Preview Mode: How peers will see your question</span>
            </div>

            <div className="pt-2">
              <h2 className="text-xl font-bold text-white leading-tight">
                {title || 'Untitled Academic Question'}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span className="text-indigo-400 font-medium">{category}</span>
                <span>/</span>
                <span>{subject}</span>
                <span>·</span>
                <span className="capitalize">{visibility} Doubt</span>
              </div>

              <div className="mt-4 text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {description || 'No description entered yet.'}
              </div>

              {hasCodeSnippet && codeText && (
                <div className="mt-3">
                  <CodeBlock code={codeText} language={codeLanguage} />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5 font-mono text-xs text-slate-400">
                {tagInput.split(',').map((t, i) => (
                  <span key={i}>#{t.trim()}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              addToast('Draft persistence arrives with the Firebase phase - this page keeps your text while you stay on it.', 'info');
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800"
          >
            Save Draft
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !description.trim() || (isEdit && !canEdit)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Post Doubt'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
