import { useCallback } from 'react';
import { Message } from '../types';
import { useMessagesStore, messageService } from '../services/messageService';
import { userService } from '../services/userService';
import { useAuth } from './useAuth';

export function useMessages() {
  const state = useMessagesStore();
  const { currentUser } = useAuth();

  const sendMessage = useCallback(
    (receiverId: string, text: string, codeSnippet?: Message['codeSnippet']) => {
      if (!currentUser) return;
      const receiver = userService.getById(receiverId);
      if (!receiver) return;
      messageService.send(currentUser, receiver, text, codeSnippet);
    },
    [currentUser]
  );

  return {
    conversations: state.conversations,
    messages: state.messages,
    activeConversationId: state.activeConversationId,
    status: state.status,
    setActiveConversationId: messageService.setActiveConversation,
    sendMessage
  };
}
