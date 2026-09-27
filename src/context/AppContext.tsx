import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AdminSettings,
  Announcement,
  AuditLog,
  Answer,
  Category,
  Conversation,
  Doubt,
  Message,
  Notification,
  Report,
  ReportReason,
  Tag,
  User
} from '../types';
import { LoadStatus, useStore } from '../lib/store';
import { toastStore, ToastItem } from '../lib/toastStore';
import { ServiceError, errorMessage } from '../lib/errors';
import { extractMentions } from '../utils/mentions';
import { bootstrapServices } from '../services';
import {
  adminService,
  answerService,
  catalogService,
  doubtService,
  notificationService,
  socialService
} from '../services';
import { userService, type EditableProfilePatch } from '../services/userService';
import { reportService } from '../services/reportService';
import { useAuth } from '../hooks/useAuth';
import { useUsers } from '../hooks/useUsers';
import { useDoubts } from '../hooks/useDoubts';
import { useNotifications } from '../hooks/useNotifications';
import { useMessages } from '../hooks/useMessages';
import { useAdmin } from '../hooks/useAdmin';
import { CreateDoubtInput, UpdateDoubtInput } from '../services/doubtService';

// Load the mock adapter before the first render. The Firebase adapter will
// keep stores in `loading` until its first snapshot arrives.
bootstrapServices();

export interface ToastItemOut extends ToastItem {}

interface AppContextType {
  // Session (mirrors AuthContext so existing pages keep working)
  currentUser: User | null;

  // Data
  users: User[];
  doubts: Doubt[];
  answers: Answer[];
  categories: Category[];
  tags: Tag[];
  notifications: Notification[];
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;
  followingUserIds: string[];
  bookmarkedDoubtIds: string[];
  reports: Report[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  adminSettings: AdminSettings;
  dataStatus: LoadStatus;

  // Doubts
  getDoubtById: (id: string) => Doubt | undefined;
  createDoubt: (input: CreateDoubtInput) => string;
  updateDoubt: (id: string, patch: UpdateDoubtInput) => void;
  deleteDoubt: (id: string) => void;
  toggleVoteDoubt: (id: string, type: 'up' | 'down') => void;
  toggleBookmark: (id: string) => void;

  // Answers & comments
  getAnswersForDoubt: (doubtId: string) => Answer[];
  addAnswer: (doubtId: string, content: string, codeSnippet?: Answer['codeSnippet']) => void;
  updateAnswer: (answerId: string, patch: { content?: string; codeSnippet?: Answer['codeSnippet'] }) => void;
  deleteAnswer: (answerId: string) => void;
  acceptAnswer: (doubtId: string, answerId: string) => void;
  toggleVoteAnswer: (answerId: string, type: 'up' | 'down') => void;
  addCommentToAnswer: (answerId: string, text: string, parentCommentId?: string) => void;

  // Social
  toggleFollowUser: (userId: string) => void;
  toggleFollowTag: (tagId: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: number;

  // Messaging
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (receiverId: string, text: string, codeSnippet?: Message['codeSnippet']) => void;

  // Profile
  updateUserProfile: (data: EditableProfilePatch) => void;

  // Admin & moderation
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  dismissReport: (reportId: string) => void;
  resolveReport: (reportId: string, actionTaken: string) => void;
  deleteReportedContent: (reportId: string) => Promise<void>;
  issueWarning: (userId: string, userName: string, reason: string) => Promise<void>;
  createReport: (input: {
    targetType: Report['targetType'];
    targetId: string;
    targetTitle: string;
    reportedUserId: string;
    reportedUserName: string;
    reason: ReportReason;
    description: string;
  }) => Promise<boolean>;
  saveAdminSettings: (patch: Partial<AdminSettings>) => Promise<boolean>;
  createAnnouncement: (ann: Omit<Announcement, 'id' | 'createdAt' | 'authorName' | 'isActive'>) => void;
  createCategory: (cat: Omit<Category, 'id' | 'questionsCount'>) => void;
  deleteCategory: (catId: string) => void;

  // Toasts
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastItem['type']) => void;
  removeToast: (id: string) => void;

  // Theme
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { users } = useUsers();
  const { doubts, getDoubtById } = useDoubts();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    status: notificationsStatus
  } = useNotifications();
  const {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    sendMessage: sendMessageInternal,
    status: messagesStatus
  } = useMessages();
  const admin = useAdmin();

  const answersState = useStore(answerService.store);
  const socialState = useStore(socialService.store);
  const catalogState = useStore(catalogService.store);
  const toasts = useStore(toastStore.store);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ch_theme') !== 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    root.classList.toggle('light', !isDarkMode);
    root.style.colorScheme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('ch_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => setIsDarkMode(prev => !prev), []);

  const addToast = useCallback(
    (message: string, type: ToastItem['type'] = 'success') => toastStore.add(message, type),
    []
  );
  const removeToast = useCallback((id: string) => toastStore.remove(id), []);

  const requireUser = (): User => {
    if (!currentUser) {
      throw new ServiceError('auth/required', 'You must be signed in to do that.');
    }
    return currentUser;
  };

  const run = useCallback(
    (action: (user: User) => void) => {
      if (!currentUser) {
        toastStore.add('You must be signed in to do that.', 'error');
        return;
      }
      try {
        action(currentUser);
      } catch (error) {
        toastStore.add(errorMessage(error), 'error');
      }
    },
    [currentUser]
  );

  // ---------------------------------------------------------------- Doubts
  const createDoubt = useCallback(
    (input: CreateDoubtInput): string => {
      const user = requireUser();
      const doubt = doubtService.create(user, {
        ...input,
        mentions: extractMentions(input.description)
      });
      userService.adjustStats(user.id, { questionsCount: 1, reputation: 5 });
      catalogService.adjustQuestionCount(doubt.category, 1);
      logDoubtAction(user, doubt.title, doubt.visibility);
      toastStore.add('Your doubt was posted to the campus hub!', 'success');
      return doubt.id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const updateDoubt = useCallback(
    (id: string, patch: UpdateDoubtInput) => {
      run(user => {
        doubtService.update(id, user, patch);
        logDoubtAction(user, patch.title ?? id, patch.visibility ?? 'public', true);
        toastStore.add('Your doubt has been updated.', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const deleteDoubt = useCallback(
    (id: string) => {
      run(user => {
        const target = doubtService.getById(id);
        doubtService.remove(id);
        answerService.removeForDoubt(id);
        if (target) catalogService.adjustQuestionCount(target.category, -1);
        logAudit(user, 'Deleted question', target ? target.title : id, 'doubt');
        toastStore.add('Question deleted.', 'info');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const toggleVoteDoubt = useCallback((id: string, type: 'up' | 'down') => {
    doubtService.vote(id, type);
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    const bookmarked = socialService.toggleBookmark(id);
    toastStore.add(
      bookmarked ? 'Doubt saved to your Bookmarks!' : 'Removed from bookmarks',
      bookmarked ? 'success' : 'info'
    );
  }, []);

  // --------------------------------------------------------------- Answers
  const getAnswersForDoubt = useCallback((doubtId: string): Answer[] => {
    return answerService.getForDoubt(doubtId);
  }, []);

  const addAnswer = useCallback(
    (doubtId: string, content: string, codeSnippet?: Answer['codeSnippet']) => {
      run(user => {
        const doubt = doubtService.getById(doubtId);
        answerService.add(doubtId, user, content, codeSnippet, extractMentions(content));
        doubtService.setAnswersCount(doubtId, 1);
        userService.adjustStats(user.id, { answersCount: 1, reputation: 10 });

        if (doubt && doubt.authorId !== user.id) {
          notificationService.push({
            userId: doubt.authorId,
            type: 'answer',
            title: 'New Solution on your Question',
            message: `${user.name} posted an answer to: "${doubt.title.slice(0, 50)}..."`,
            timestamp: 'Just now',
            read: false,
            link: `/app/doubts/${doubtId}`,
            senderName: user.name,
            senderAvatar: user.avatar
          });
        }

        toastStore.add('Your solution has been submitted!', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const updateAnswer = useCallback(
    (answerId: string, patch: { content?: string; codeSnippet?: Answer['codeSnippet'] }) => {
      run(user => {
        answerService.update(answerId, user, patch);
        toastStore.add('Answer updated.', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const deleteAnswer = useCallback(
    (answerId: string) => {
      run(user => {
        const removed = answerService.remove(answerId, user);
        doubtService.setAnswersCount(removed.doubtId, -1);
        userService.adjustStats(user.id, { answersCount: -1 });
        toastStore.add('Answer deleted.', 'info');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const acceptAnswer = useCallback(
    (doubtId: string, answerId: string) => {
      run(user => {
        const isNowAccepted = answerService.setAccepted(doubtId, answerId);
        doubtService.setAccepted(doubtId, isNowAccepted);
        const answer = answerService.getAll().find(a => a.id === answerId);

        if (isNowAccepted && answer) {
          userService.adjustStats(answer.authorId, { reputation: 15, acceptedCount: 1 });
          if (answer.authorId !== user.id) {
            notificationService.push({
              userId: answer.authorId,
              type: 'accepted',
              title: 'Answer Accepted! (+15 Rep)',
              message: `${user.name} marked your answer as the accepted solution!`,
              timestamp: 'Just now',
              read: false,
              link: `/app/doubts/${doubtId}`,
              senderName: user.name,
              senderAvatar: user.avatar
            });
          }
          toastStore.add('Marked as Accepted Answer! (+15 Reputation awarded)', 'success');
        } else {
          toastStore.add('Unmarked accepted answer.', 'info');
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const toggleVoteAnswer = useCallback((answerId: string, type: 'up' | 'down') => {
    answerService.vote(answerId, type);
  }, []);

  const addCommentToAnswer = useCallback(
    (answerId: string, text: string, parentCommentId?: string) => {
      run(user => {
        answerService.addComment(answerId, user, text, parentCommentId, extractMentions(text));
        toastStore.add('Comment published.', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  // ---------------------------------------------------------------- Social
  const toggleFollowUser = useCallback(
    (userId: string) => {
      run(user => {
        const target = userService.getById(userId);
        const nowFollowing = socialService.toggleFollow(userId);
        userService.adjustStats(userId, { followersCount: nowFollowing ? 1 : -1 });

        if (nowFollowing && target) {
          notificationService.push({
            userId: target.id,
            type: 'follow',
            title: 'New Follower',
            message: `${user.name} (${user.department}, ${user.year} Year) started following you.`,
            timestamp: 'Just now',
            read: false,
            link: `/app/users/${user.id}`,
            senderName: user.name,
            senderAvatar: user.avatar
          });
        }

        toastStore.add(
          nowFollowing ? `Now following ${target ? target.name : 'user'}!` : `Unfollowed ${target ? target.name : 'user'}.`,
          nowFollowing ? 'success' : 'info'
        );
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const toggleFollowTag = useCallback((tagId: string) => {
    const { following, tag } = catalogService.toggleFollowTag(tagId);
    if (tag) {
      toastStore.add(
        following ? `Subscribed to #${tag.name}` : `Unsubscribed from #${tag.name}`,
        'info'
      );
    }
  }, []);

  // ---------------------------------------------------------- Notifications
  const markNotificationRead = useCallback((id: string) => markRead(id), [markRead]);

  const markAllNotificationsRead = useCallback(() => {
    markAllRead();
    toastStore.add('All notifications marked as read', 'info');
  }, [markAllRead]);

  // --------------------------------------------------------------- Profile
  const updateUserProfile = useCallback(
    (data: EditableProfilePatch) => {
      run(user => {
        userService.updateProfile(user.id, data);
        toastStore.add('Profile updated successfully!', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  // ---------------------------------------------------------------- Admin
  const withToast = useCallback(
    (action: () => void, message: string, type: ToastItem['type'] = 'success') => {
      run(() => {
        action();
        toastStore.add(message, type);
      });
    },
    [run]
  );

  const approveUser = useCallback(
    (userId: string) => {
      const target = userService.getById(userId);
      withToast(
        () => admin.approveUser(userId),
        `Account for ${target ? target.name : 'User'} has been approved!`
      );
    },
    [admin, withToast]
  );

  const rejectUser = useCallback(
    (userId: string) => {
      const target = userService.getById(userId);
      withToast(
        () => admin.rejectUser(userId),
        `Registration for ${target ? target.name : 'User'} rejected — the record is kept as "rejected".`,
        'info'
      );
    },
    [admin, withToast]
  );

  const blockUser = useCallback(
    (userId: string) => {
      const target = userService.getById(userId);
      withToast(
        () => admin.blockUser(userId),
        `User ${target ? target.name : 'User'} has been blocked.`,
        'warning'
      );
    },
    [admin, withToast]
  );

  const unblockUser = useCallback(
    (userId: string) => {
      const target = userService.getById(userId);
      withToast(
        () => admin.unblockUser(userId),
        `User ${target ? target.name : 'User'} has been unblocked.`
      );
    },
    [admin, withToast]
  );

  const dismissReport = useCallback(
    (reportId: string) => {
      withToast(() => admin.dismissReport(reportId), 'Report dismissed without action.', 'info');
    },
    [admin, withToast]
  );

  const resolveReport = useCallback(
    (reportId: string, actionTaken: string) => {
      withToast(() => admin.resolveReport(reportId, actionTaken), `Report resolved: ${actionTaken}`);
    },
    [admin, withToast]
  );

  const deleteReportedContent = useCallback(
    async (reportId: string) => {
      const result = await admin.deleteReportedContent(reportId);
      if (result.ok) {
        toastStore.add('Reported content removed from the campus forum.', 'success');
      } else {
        toastStore.add(result.message, 'error');
      }
    },
    [admin]
  );

  const issueWarning = useCallback(
    async (userId: string, userName: string, reason: string) => {
      const result = await admin.issueWarning(userId, userName, reason);
      if (result.ok) {
        toastStore.add(`Academic warning recorded for ${userName}.`, 'warning');
      } else {
        toastStore.add(result.message, 'error');
      }
    },
    [admin]
  );

  const createReport = useCallback(
    async (input: {
      targetType: Report['targetType'];
      targetId: string;
      targetTitle: string;
      reportedUserId: string;
      reportedUserName: string;
      reason: ReportReason;
      description: string;
    }): Promise<boolean> => {
      if (!currentUser) {
        toastStore.add('Sign in to report content.', 'error');
        return false;
      }
      const user = currentUser;
      const result = await reportService.createReport({
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        reporter: user,
        reportedUserId: input.reportedUserId,
        reportedUserName: input.reportedUserName,
        reason: input.reason,
        description: input.description
      });

      if (result.ok) {
        logAudit(user, `Filed report (${input.reason})`, input.targetTitle, 'moderation');
        toastStore.add(
          'Report queued for campus moderation (stored locally until Firebase is connected).',
          'info'
        );
        return true;
      }
      toastStore.add(result.message, 'error');
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const saveAdminSettings = useCallback(
    async (patch: Partial<AdminSettings>): Promise<boolean> => {
      const result = await admin.saveAdminSettings(patch);
      if (result.ok) {
        toastStore.add('Moderation policies saved to this session (Firestore persistence comes next).', 'success');
        return true;
      }
      toastStore.add(result.message, 'error');
      return false;
    },
    [admin]
  );

  const createAnnouncement = useCallback(
    (ann: Omit<Announcement, 'id' | 'createdAt' | 'authorName' | 'isActive'>) => {
      run(user => {
        const created = admin.createAnnouncement(ann);
        userService.getUsers().filter(u => u.status === 'active').forEach(u => {
          notificationService.push({
            userId: u.id,
            type: 'announcement',
            title: `Campus Announcement: ${created.title}`,
            message: created.content,
            timestamp: 'Just now',
            read: false,
            senderName: created.authorName
          });
        });
        toastStore.add('Campus announcement broadcasted!', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, admin]
  );

  const createCategory = useCallback(
    (cat: Omit<Category, 'id' | 'questionsCount'>) => {
      run(() => {
        const created = catalogService.createCategory(cat);
        toastStore.add(`Academic category "${created.name}" created!`, 'success');
      });
    },
    []
  );

  const deleteCategory = useCallback((catId: string) => {
    run(() => {
      catalogService.deleteCategory(catId);
      toastStore.add('Category removed.', 'info');
    });
  }, []);

  // -------------------------------------------------------------- Messages
  const sendMessage = useCallback(
    (receiverId: string, text: string, codeSnippet?: Message['codeSnippet']) => {
      sendMessageInternal(receiverId, text, codeSnippet);
    },
    [sendMessageInternal]
  );

  const dataStatus = useMemo<LoadStatus>(() => {
    const statuses: LoadStatus[] = [
      answersState.status,
      socialState.status,
      catalogState.status,
      notificationsStatus,
      messagesStatus,
      admin.status
    ];
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.every(s => s === 'ready')) return 'ready';
    return 'loading';
  }, [answersState.status, socialState.status, catalogState.status, notificationsStatus, messagesStatus, admin.status]);

  const value = useMemo<AppContextType>(
    () => ({
      currentUser,
      users,
      doubts,
      answers: answersState.answers,
      categories: catalogState.categories,
      tags: catalogState.tags,
      notifications,
      conversations,
      messages,
      activeConversationId,
      followingUserIds: socialState.followingUserIds,
      bookmarkedDoubtIds: socialState.bookmarkedDoubtIds,
      reports: admin.reports,
      announcements: admin.announcements,
      auditLogs: admin.auditLogs,
      adminSettings: admin.adminSettings,
      dataStatus,
      getDoubtById,
      createDoubt,
      updateDoubt,
      deleteDoubt,
      toggleVoteDoubt,
      toggleBookmark,
      getAnswersForDoubt,
      addAnswer,
      updateAnswer,
      deleteAnswer,
      acceptAnswer,
      toggleVoteAnswer,
      addCommentToAnswer,
      toggleFollowUser,
      toggleFollowTag,
      markNotificationRead,
      markAllNotificationsRead,
      unreadNotificationsCount: unreadCount,
      setActiveConversationId,
      sendMessage,
      updateUserProfile,
      approveUser,
      rejectUser,
      blockUser,
      unblockUser,
      dismissReport,
      resolveReport,
      deleteReportedContent,
      issueWarning,
      createReport,
      saveAdminSettings,
      createAnnouncement,
      createCategory,
      deleteCategory,
      toasts,
      addToast,
      removeToast,
      isDarkMode,
      toggleTheme
    }),
    [
      currentUser,
      users,
      doubts,
      answersState,
      catalogState,
      notifications,
      conversations,
      messages,
      activeConversationId,
      socialState,
      admin,
      dataStatus,
      getDoubtById,
      createDoubt,
      updateDoubt,
      deleteDoubt,
      toggleVoteDoubt,
      toggleBookmark,
      getAnswersForDoubt,
      addAnswer,
      updateAnswer,
      deleteAnswer,
      acceptAnswer,
      toggleVoteAnswer,
      addCommentToAnswer,
      toggleFollowUser,
      toggleFollowTag,
      markNotificationRead,
      markAllNotificationsRead,
      unreadCount,
      setActiveConversationId,
      sendMessage,
      updateUserProfile,
      approveUser,
      rejectUser,
      blockUser,
      unblockUser,
      dismissReport,
      resolveReport,
      deleteReportedContent,
      issueWarning,
      createReport,
      saveAdminSettings,
      createAnnouncement,
      createCategory,
      deleteCategory,
      toasts,
      addToast,
      removeToast,
      isDarkMode,
      toggleTheme
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/** Audit helpers (module-level so component callbacks stay stable). */
function logAudit(user: User, action: string, target: string, type: AuditLog['type']): void {
  adminService.logAudit({ actor: user.name, action, target, timestamp: 'Just now', type });
}

function logDoubtAction(
  user: User,
  target: string,
  visibility: 'public' | 'private',
  edited = false
): void {
  const action = edited
    ? 'Edited question'
    : visibility === 'private'
    ? 'Created 🔒 Private Doubt'
    : 'Posted new Doubt';
  logAudit(user, action, target, 'doubt');
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
