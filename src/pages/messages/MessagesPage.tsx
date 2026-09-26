import React, { useState } from 'react';
import {
  Search,
  Send,
  Paperclip,
  Code2,
  Smile,
  CheckCheck,
  MoreVertical,
  User as UserIcon,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CodeBlock } from '../../components/doubts/CodeBlock';

export const MessagesPage: React.FC = () => {
  const { conversations, messages, activeConversationId, setActiveConversationId, sendMessage, currentUser } = useApp();

  const [messageText, setMessageText] = useState('');
  const [searchConv, setSearchConv] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  if (!currentUser) return null;

  const activeConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeMessages = messages.filter(m => m.conversationId === activeConv?.id);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !codeSnippet.trim()) return;

    if (activeConv) {
      sendMessage(
        activeConv.participant.id,
        messageText.trim(),
        codeSnippet.trim() ? { language: 'cpp', code: codeSnippet.trim() } : undefined
      );
      setMessageText('');
      setCodeSnippet('');
      setShowCodeInput(false);

      // Simulate senior reply typing indicator for realistic feel
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }, 1000);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.participant.name.toLowerCase().includes(searchConv.toLowerCase()) ||
    c.participant.department.toLowerCase().includes(searchConv.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] rounded-3xl bg-slate-900/90 border border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Left: Conversation List */}
      <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950/40">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">Direct Messages</h2>
            <span className="text-[11px] font-mono text-slate-400">
              {conversations.length} Active
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchConv}
              onChange={e => setSearchConv(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredConversations.map(conv => {
            const isSelected = conv.id === activeConv?.id;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full p-3.5 flex items-start gap-3 text-left transition-colors ${
                  isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="relative">
                  <img
                    src={conv.participant.avatar}
                    alt={conv.participant.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />
                  {conv.participant.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">
                      {conv.participant.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {conv.lastMessage?.timestamp || 'Recent'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {conv.participant.department} ({conv.participant.year})
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 truncate leading-snug">
                    {conv.lastMessage?.text || 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Active Chat Window */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-slate-900/50">
          {/* Chat Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={activeConv.participant.avatar}
                  alt={activeConv.participant.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                {activeConv.participant.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {activeConv.participant.name}
                  </span>
                  {activeConv.participant.role === 'mentor' && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                      Mentor
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {activeConv.participant.department} · {activeConv.participant.skills.slice(0, 2).join(', ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                <span>{activeConv.participant.name} is typing a response...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSend}
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
                onClick={() => setShowCodeInput(!showCodeInput)}
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
                onClick={() => setMessageText(prev => prev + ' 💡 ')}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Add Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder={`Message ${activeConv.participant.name}...`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={!messageText.trim() && !codeSnippet.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all active:scale-95 shadow-md shadow-indigo-600/20"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
          Select a student or senior from the left to start a conversation.
        </div>
      )}
    </div>
  );
};
