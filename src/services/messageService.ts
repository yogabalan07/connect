import { Conversation, Message, User } from '../types';
import { createStore, LoadStatus, useStore } from '../lib/store';
import { ServiceError } from '../lib/errors';

interface MessageState {
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;
  status: LoadStatus;
  error?: string;
}

const store = createStore<MessageState>({
  conversations: [],
  messages: [],
  activeConversationId: null,
  status: 'loading'
});

export const messageService = {
  store,

  bootstrap(): void {
    store.set(prev => ({ ...prev, status: 'ready' }));
  },

  setActiveConversation(id: string | null): void {
    store.set(prev => ({ ...prev, activeConversationId: id }));
  },

  send(sender: User, receiver: User, text: string, codeSnippet?: Message['codeSnippet']): Message {
    const trimmed = text.trim();
    if (!trimmed) throw new ServiceError('message/invalid', 'A message cannot be empty.');

    const state = store.get();
    const existing = state.conversations.find(c => c.participant.id === receiver.id);
    const conversationId = existing ? existing.id : `conv-${Date.now()}`;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: sender.id,
      receiverId: receiver.id,
      text: trimmed,
      timestamp: 'Just now',
      read: true,
      codeSnippet
    };

    store.set(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      activeConversationId: conversationId,
      conversations: existing
        ? prev.conversations.map(c =>
            c.id === conversationId ? { ...c, lastMessage: newMessage } : c
          )
        : [
            {
              id: conversationId,
              participant: receiver,
              lastMessage: newMessage,
              unreadCount: 0
            } as Conversation,
            ...prev.conversations
          ]
    }));

    return newMessage;
  }
};

export function useMessagesStore(): MessageState {
  return useStore(store);
}
