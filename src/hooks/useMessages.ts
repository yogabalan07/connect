import { useCallback } from 'react';
import { Message } from '../types';
import { useMessagesStore, messageService } from '../services/messageService';
import { userService } from '../services/userService';
import { ServiceError } from '../lib/errors';
import { useAuth } from './useAuth';

export function useMessages() {
  const state = useMessagesStore();
  const { currentUser } = useAuth();

  /**
   * Sends one message, creating the thread first when it does not exist.
   *
   * The peer is looked up in the local directory purely for the display
   * name - the recipient is still pinned to `receiverId` by
   * `firestore.rules`, so a stale card can never redirect a message.
   */
  const sendMessage = useCallback(
    async (
      receiverId: string,
      text: string,
      codeSnippet?: Message['codeSnippet']
    ): Promise<void> => {
      if (!currentUser) throw new ServiceError('auth/required', 'Sign in to send messages.');
      const receiver = userService.getById(receiverId);
      if (!receiver) {
        throw new ServiceError('user/not-found', 'That member is no longer available.');
      }
      await messageService.send(currentUser, receiver, text, codeSnippet);
    },
    [currentUser]
  );

  /** Opens (or reuses) the thread with a peer and selects it. */
  const startConversation = useCallback(async (peerId: string): Promise<void> => {
    await messageService.startConversation(peerId);
  }, []);

  /** Selects an existing thread, loads its history and advances my cursor. */
  const openConversation = useCallback(async (conversationId: string): Promise<void> => {
    await messageService.open(conversationId);
  }, []);

  return {
    conversations: state.conversations,
    messages: state.messages,
    activeConversationId: state.activeConversationId,
    status: state.status,
    setActiveConversationId: messageService.setActiveConversation,
    sendMessage,
    startConversation,
    openConversation
  };
}
