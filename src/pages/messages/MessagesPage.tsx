import React, { useMemo, useState } from 'react';
import {
  Search,
  Send,
  Code2,
  Smile,
  User as UserIcon,
  MessageSquarePlus,
  X,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CodeBlock } from '../../components/doubts/CodeBlock';

/**
 * Direct messaging.
 *
 * Threads come from `conversations/{a_b}` - one document per member pair -
 * so "start a conversation" is idempotent: picking the same peer twice
 * lands on the same thread. Message history is loaded when a thread is
 * opened and my own read cursor in `conversationReads/{a_b}_{uid}` advances
 * with it, which is what drives the unread badge on the left.
 *
 * There is deliberately no simulated typing indicator: presence and
 * keystrokes would need a realtime channel the rules do not model, and
 * showing somebody else's invented activity is worse than showing none.
 */
export const MessagesPage: React.FC = () => {
  const {
    conversations,
    messages,
    activeConversationId,
    sendMessage,
    startConversation,
    openConversation,
    users,
    currentUser,
    dataStatus
  } = useApp();

  const [messageText, setMessageText] = useState('');
  const [searchConv, setSearchConv] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const [sending, setSending] = useState(false);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConversationId) ?? conversations[0] ?? null,
    [conversations, activeConversationId]
  );

  const activeMessages = useMemo(
    () => (activeConv ? messages.filter(m => m.conversationId === activeConv.id) : []),
    [messages, activeConv]
  );

  const filteredConversations = useMemo(() => {
    const needle = searchConv.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(conv => {
      const peer = conv.participant;
      if (!peer) return conv.id.includes(needle);
      return (
        peer.name.toLowerCase().includes(needle) ||
        (peer.department ?? '').toLowerCase().includes(needle) ||
        (peer.username ?? '').toLowerCase().includes(needle)
      );
    });
  }, [conversations, searchConv]);

  const peerName = (name: string | undefined): string => name ?? 'Campus member';

  const candidateMembers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    const existing = new Set(
      conversations.flatMap(conv => conv.participants).filter(id => id !== currentUser?.id)
    );
    return users
      .filter(user => user.id !== currentUser?.id)
      .filter(user => user.status === 'approved')
      .filter(user => !existing.has(user.id))
      .filter(
        user =>
          !needle ||
          user.name.toLowerCase().includes(needle) ||
          (user.username ?? '').toLowerCase().includes(needle) ||
          (user.department ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 30);
  }, [users, memberSearch, conversations, currentUser]);

  if (!currentUser) return null;

  const openThread = async (peerId: string): Promise<void> => {
    setShowNewMessage(false);
    setMemberSearch('');
    try {
      await startConversation(peerId);
    } catch {
      // Already toasted by `AppContext.startConversation`.
    }
  };

  const handleSend = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!activeConv || sending) return;
    const text = messageText.trim();
    const snippet = codeSnippet.trim();
    if (!text && !snippet) return;

    const peerId = activeConv.participants.find(id => id !== currentUser.id);
    if (!peerId) return;

    setSending(true);
    try {
      await sendMessage(
        peerId,
        text,
        snippet ? { language: 'cpp', code: snippet } : undefined
      );
      setMessageText('');
      setCodeSnippet('');
      setShowCodeInput(false);
    } catch {
      // `sendMessage` already toasted the typed failure copy.
    } finally {
      setSending(false);
    }
  };

  const pickerOpen = showNewMessage || conversations.length === 0;

  return (
    <div className="h-[calc(100vh-8rem)] rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Left: Conversation List / Member Picker */}
      <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950/40">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">Direct Messages</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">{conversations.length}</span>
              <button
                type="button"
                onClick={() => setShowNewMessage(prev => !prev)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showNewMessage
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="New conversation"
                aria-label="New conversation"
              >
                {showNewMessage ? <X className="w-3.5 h-3.5" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={showNewMessage ? memberSearch : searchConv}
              onChange={e => (showNewMessage ? setMemberSearch(e.target.value) : setSearchConv(e.target.value))}
              placeholder={showNewMessage ? 'Search campus members...' : 'Search conversations...'}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {pickerOpen ? (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {candidateMembers.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-slate-500">
                {dataStatus === 'loading'
                  ? 'Loading campus directory...'
                  : memberSearch.trim()
                    ? 'No member matches that search.'
                    : 'You already have a conversation with every approved member.'}
              </div>
            ) : (
              candidateMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => void openThread(member.id)}
                  className="w-full p-3.5 flex items-center gap-3 text-left hover:bg-slate-900/60 transition-colors"
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-700"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-white truncate">{member.name}</span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {member.department}
                      {member.year ? ` · ${member.year}` : ''}
                    </span>
                  </span>
                  <Send className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-slate-500">No conversations yet.</div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = conv.id === activeConv?.id;
                const peer = conv.participant;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setShowNewMessage(false);
                      // `AppContext.openConversation` toasts the failure;
                      // swallowing here keeps the rejection off the console.
                      void openConversation(conv.id).catch(() => undefined);
                    }}
                    className={`w-full p-3.5 flex items-start gap-3 text-left transition-colors ${
                      isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={peer?.avatar}
                        alt={peerName(peer?.name)}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800"
                      />
                      {peer?.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {peerName(peer?.name)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {conv.lastMessage?.timestamp || ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {peer ? `${peer.department} (${peer.year})` : 'Member'}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 truncate leading-snug">
                        {conv.lastMessage?.text || 'No messages yet'}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="mt-1 shrink-0 min-w-4 h-4 px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right: Active Chat Window */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-slate-900/50">
          {/* Chat Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={activeConv.participant?.avatar}
                  alt={peerName(activeConv.participant?.name)}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800"
                />
                {activeConv.participant?.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {peerName(activeConv.participant?.name)}
                  </span>
                  {activeConv.participant?.role === 'mentor' && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                      Mentor
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {activeConv.participant
                    ? `${activeConv.participant.department}${
                        activeConv.participant.skills?.length
                          ? ` · ${activeConv.participant.skills.slice(0, 2).join(', ')}`
                          : ''
                      }`
                    : 'Profile unavailable'}
                </div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {activeMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-slate-500 text-xs">
                <UserIcon className="w-5 h-5" />
                <p>No messages yet. Say hello.</p>
              </div>
            )}

            {activeMessages.map(msg => {
              const isMine = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-md sm:max-w-lg p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMine
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-md'
                        : 'bg-slate-800/90 text-slate-100 rounded-bl-xs border border-slate-700/60'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    {msg.codeSnippet && (
                      <div className="mt-2 text-left">
                        <CodeBlock
                          code={msg.codeSnippet.code}
                          language={msg.codeSnippet.language}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={e => void handleSend(e)}
            className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/70 space-y-2"
          >
            {showCodeInput && (
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                  <span>Attach Code Block</span>
                  <button
                    type="button"
                    onClick={() => setShowCodeInput(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={codeSnippet}
                  onChange={e => setCodeSnippet(e.target.value)}
                  placeholder="// Paste C++ or Python code snippet..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCodeInput(prev => !prev)}
                className={`p-2 rounded-xl transition-colors ${
                  showCodeInput
                    ? 'bg-indigo-600/30 text-indigo-300'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Attach Code"
              >
                <Code2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMessageText(prev => `${prev} 💡 `)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Add Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder={`Message ${peerName(activeConv.participant?.name)}...`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={(!messageText.trim() && !codeSnippet.trim()) || sending}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all active:scale-95 shadow-md shadow-indigo-600/20"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 text-xs text-slate-400">
          <AlertTriangle className="w-4 h-4 text-slate-500" />
          <p>Pick a campus member on the left to start a conversation.</p>
        </div>
      )}
    </div>
  );
};
