import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AdminSettings,
  Announcement,
  AuditLog,
  Answer,
  Category,
  Comment,
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
import { mentionsFor } from '../utils/mentions';
import { bootstrapServices } from '../services';
import {
  adminService,
  answerService,
  badgeService,
  catalogService,
  doubtService,
  notificationService,
  profileService,
  reputationService,
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

// Start every service read before the first render. Stores stay in `loading`
// until the adapter answers its first read.
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
  createDoubt: (input: CreateDoubtInput) => Promise<string>;
  updateDoubt: (id: string, patch: UpdateDoubtInput) => Promise<void>;
  deleteDoubt: (id: string) => Promise<void>;
  toggleVoteDoubt: (id: string, type: 'up' | 'down') => Promise<void>;
  toggleBookmark: (id: string) => Promise<void>;

  // Answers & comments
  getAnswersForDoubt: (doubtId: string) => Answer[];
  loadAnswersForDoubt: (doubtId: string) => Promise<void>;
  addAnswer: (doubtId: string, content: string, codeSnippet?: Answer['codeSnippet']) => Promise<void>;
  updateAnswer: (answerId: string, patch: { content?: string; codeSnippet?: Answer['codeSnippet'] }) => Promise<void>;
  deleteAnswer: (answerId: string) => Promise<void>;
  acceptAnswer: (doubtId: string, answerId: string) => Promise<void>;
  toggleVoteAnswer: (answerId: string, type: 'up' | 'down') => Promise<void>;
  getDoubtComments: (doubtId: string) => Comment[];
  addCommentToDoubt: (doubtId: string, text: string, parentCommentId?: string) => Promise<void>;
  addCommentToAnswer: (answerId: string, text: string, parentCommentId?: string) => Promise<void>;
  /** Edit and delete are author-or-admin (see `canEditComment`). */
  updateComment: (commentId: string, text: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;

  // Social
  toggleFollowUser: (userId: string) => Promise<void>;
  toggleFollowTag: (tagId: string) => Promise<void>;

  // Notifications
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  unreadNotificationsCount: number;

  // Messaging
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (receiverId: string, text: string, codeSnippet?: Message['codeSnippet']) => void;

  // Profile
  updateUserProfile: (data: EditableProfilePatch) => Promise<void>;

  // Admin & moderation
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
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
  createCategory: (cat: Omit<Category, 'id' | 'questionsCount'>) => Promise<void>;
  deleteCategory: (catId: string) => Promise<void>;

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
  const { doubts, getDoubtById, status: doubtsStatus } = useDoubts();
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

  /**
   * Same contract as `run`, for operations that persist (profile edits,
   * approvals): the success toast fires only once Firestore accepted the
   * write, and any typed failure leaves as a toast instead of an unhandled
   * rejection.
   */
  const runAsync = useCallback(
    async (action: (user: User) => Promise<unknown>): Promise<void> => {
      if (!currentUser) {
        toastStore.add('You must be signed in to do that.', 'error');
        return;
      }
      try {
        await action(currentUser);
      } catch (error) {
        toastStore.add(errorMessage(error), 'error');
      }
    },
    [currentUser]
  );

  /**
   * Notification fan-out runs after the write that caused it has already
   * committed, so a refused or offline delivery must not roll the user's
   * toast back into an error - the content is there either way.
   */
  const bestEffort = useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    try {
      await task();
    } catch {
      /* delivery is best-effort; the audit trail still shows the action */
    }
  }, []);

  /**
   * Reputation and badge bookkeeping runs *after* the content that earns
   * them has already committed, so a refusal there must not turn a
   * successful post into an error - but it must not be silent either, or
   * the number the member is looking at would simply be wrong.
   */
  const bookIfPossible = useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    try {
      await task();
    } catch (error) {
      toastStore.add(`Posted, but the reward could not be booked: ${errorMessage(error)}`, 'info');
    }
  }, []);

  // ---------------------------------------------------------------- Doubts
  const createDoubt = useCallback(
    async (input: CreateDoubtInput): Promise<string> => {
      try {
        const user = requireUser();
        const mentions = mentionsFor(input.description, userService.getUsers());
        const doubt = await doubtService.create(user, {
          ...input,
          mentions: mentions.handles,
          mentionIds: mentions.ids
        });
        userService.adjustStats(user.id, { questionsCount: 1 });
        await catalogService.adjustQuestionCount(doubt.category, 1);
        logDoubtAction(user, doubt.title, doubt.visibility);
        await bestEffort(() =>
          notificationService.notifyMentions(
            mentions.ids,
            user,
            `/app/doubts/${doubt.id}`,
            input.description
          )
        );
        await bookIfPossible(async () => {
          await reputationService.record({ type: 'question', doubtId: doubt.id, userId: user.id });
          await badgeService.claimFirstDoubt(doubt.id, user.id);
          profileService.invalidateProfile(user.id);
        });
        toastStore.add('Your doubt was posted to the campus hub!', 'success');
        return doubt.id;
      } catch (error) {
        toastStore.add(errorMessage(error), 'error');
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const updateDoubt = useCallback(
    async (id: string, patch: UpdateDoubtInput): Promise<void> => {
      await runAsync(async user => {
        await doubtService.update(id, user, patch);
        logDoubtAction(user, patch.title ?? id, patch.visibility ?? 'public', true);
        toastStore.add('Your doubt has been updated.', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const deleteDoubt = useCallback(
    async (id: string): Promise<void> => {
      await runAsync(async user => {
        const target = doubtService.getById(id);
        await doubtService.remove(id);
        answerService.removeForDoubt(id);
        if (target) await catalogService.adjustQuestionCount(target.category, -1);
        logAudit(user, 'Deleted question', target ? target.title : id, 'doubt');
        toastStore.add('Question deleted.', 'info');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const toggleVoteDoubt = useCallback(async (id: string, type: 'up' | 'down'): Promise<void> => {
    try {
      await doubtService.vote(id, type);
    } catch (error) {
      toastStore.add(errorMessage(error), 'error');
    }
  }, []);

  const toggleBookmark = useCallback(async (id: string): Promise<void> => {
    try {
      const bookmarked = await socialService.toggleBookmark(id);
      toastStore.add(
        bookmarked ? 'Doubt saved to your Bookmarks!' : 'Removed from bookmarks',
        bookmarked ? 'success' : 'info'
      );
    } catch (error) {
      toastStore.add(errorMessage(error), 'error');
    }
  }, []);

  // --------------------------------------------------------------- Answers
  const getAnswersForDoubt = useCallback((doubtId: string): Answer[] => {
    return answerService.getForDoubt(doubtId);
  }, []);

  /** Fetches a doubt's answers + comments from Firestore (detail page). */
  const loadAnswersForDoubt = useCallback(async (doubtId: string): Promise<void> => {
    await answerService.loadForDoubt(doubtId);
  }, []);

  const addAnswer = useCallback(
    (doubtId: string, content: string, codeSnippet?: Answer['codeSnippet']) =>
      runAsync(async user => {
        const doubt = doubtService.getById(doubtId);
        const mentions = mentionsFor(content, userService.getUsers());
        const created = await answerService.add(
          doubtId,
          user,
          content,
          codeSnippet,
          mentions.handles,
          mentions.ids
        );
        userService.adjustStats(user.id, { answersCount: 1 });

        if (doubt) {
          await bestEffort(() =>
            notificationService.notifyNewAnswer(doubt.authorId, user, doubtId, doubt.title)
          );
        }
        await bestEffort(() =>
          notificationService.notifyMentions(mentions.ids, user, `/app/doubts/${doubtId}`, content)
        );
        await bookIfPossible(async () => {
          await reputationService.record({
            type: 'answer',
            doubtId,
            answerId: created.id,
            userId: user.id
          });
          await badgeService.claimFirstAnswer(user.id, doubtId, created.id);
          profileService.invalidateProfile(user.id);
        });

        toastStore.add('Your solution has been submitted!', 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const updateAnswer = useCallback(
    (answerId: string, patch: { content?: string; codeSnippet?: Answer['codeSnippet'] }) =>
      runAsync(async user => {
        await answerService.update(answerId, user, patch);
        toastStore.add('Answer updated.', 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const deleteAnswer = useCallback(
    (answerId: string) =>
      runAsync(async user => {
        const removed = await answerService.remove(answerId, user);
        logAudit(user, 'Deleted answer', removed.id, 'doubt');
        toastStore.add('Answer deleted.', 'info');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const acceptAnswer = useCallback(
    (doubtId: string, answerId: string) =>
      runAsync(async user => {
        const isNowAccepted = await answerService.setAccepted(doubtId, answerId);
        const answer = answerService.getAll().find(a => a.id === answerId);

        if (isNowAccepted && answer) {
          userService.adjustStats(answer.authorId, { acceptedCount: 1 });
          await bestEffort(() =>
            notificationService.notifyAcceptedAnswer(answer.authorId, user, doubtId)
          );
          await bookIfPossible(async () => {
            const event = await reputationService.record({
              type: 'accepted',
              doubtId,
              answerId,
              userId: answer.authorId,
              actorId: user.id
            });
            if (event) await badgeService.claimFirstAccepted(answer.authorId, event.id);
            profileService.invalidateProfile(answer.authorId);
          });
          toastStore.add('Marked as Accepted Answer! (+15 Reputation awarded)', 'success');
        } else {
          // Un-accepting does not claw the +15 back (no ledger delete rule)
          // and does not lower the derived count either - the profile and
          // the score stay consistent with what was already proven.
          toastStore.add('Unmarked accepted answer.', 'info');
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const toggleVoteAnswer = useCallback(async (answerId: string, type: 'up' | 'down'): Promise<void> => {
    try {
      await answerService.vote(answerId, type);
    } catch (error) {
      toastStore.add(errorMessage(error), 'error');
    }
  }, []);

  const getDoubtComments = useCallback(
    (doubtId: string): Comment[] => answerService.getDoubtComments(doubtId),
    []
  );

  const addCommentToDoubt = useCallback(
    (doubtId: string, text: string, parentCommentId?: string) =>
      runAsync(async user => {
        const doubt = doubtService.getById(doubtId);
        const mentions = mentionsFor(text, userService.getUsers());
        const created = await answerService.addDoubtComment(
          doubtId,
          user,
          text,
          parentCommentId,
          mentions.handles,
          mentions.ids
        );
        if (doubt) {
          await bestEffort(() =>
            notificationService.notifyComment(doubt.authorId, user, doubtId, doubt.title, text, false)
          );
        }
        await bestEffort(() =>
          notificationService.notifyMentions(mentions.ids, user, `/app/doubts/${doubtId}`, text)
        );
        await bookIfPossible(async () => {
          await badgeService.claimFirstComment(user.id, doubtId, created.id);
          profileService.invalidateProfile(user.id);
        });
        toastStore.add('Comment published.', 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const addCommentToAnswer = useCallback(
    (answerId: string, text: string, parentCommentId?: string) =>
      runAsync(async user => {
        const answer = answerService.getAll().find(a => a.id === answerId);
        const doubt = answer ? doubtService.getById(answer.doubtId) : null;
        const mentions = mentionsFor(text, userService.getUsers());
        const created = await answerService.addComment(
          answerId,
          user,
          text,
          parentCommentId,
          mentions.handles,
          mentions.ids
        );

        if (doubt) {
          // The asker and the answerer both own this thread, minus the
          // commenter themselves (`notify` drops self-addressed events).
          const audience = Array.from(
            new Set([doubt.authorId, answer ? answer.authorId : ''].filter(Boolean))
          );
          for (const recipientId of audience) {
            await bestEffort(() =>
              notificationService.notifyComment(recipientId, user, doubt.id, doubt.title, text, true)
            );
          }
          await bestEffort(() =>
            notificationService.notifyMentions(mentions.ids, user, `/app/doubts/${doubt.id}`, text)
          );
        }
        await bookIfPossible(async () => {
          await badgeService.claimFirstComment(user.id, created.doubtId, created.id);
          profileService.invalidateProfile(user.id);
        });
        toastStore.add('Comment published.', 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const updateComment = useCallback(
    (commentId: string, text: string) =>
      runAsync(async user => {
        await answerService.updateComment(commentId, user, text);
        toastStore.add('Comment updated.', 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const deleteComment = useCallback(
    (commentId: string) =>
      runAsync(async user => {
        await answerService.removeComment(commentId, user);
        toastStore.add('Comment deleted.', 'info');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  // ---------------------------------------------------------------- Social
  const toggleFollowUser = useCallback(
    (userId: string) =>
      runAsync(async user => {
        const target = userService.getById(userId);
        const nowFollowing = await socialService.toggleFollow(userId);
        userService.adjustStats(userId, { followersCount: nowFollowing ? 1 : -1 });
        profileService.invalidateProfile(userId);

        if (nowFollowing && target) {
          await bestEffort(() =>
            notificationService.notifyFollow(
              target.id,
              user,
              `${user.department}, ${user.year} Year`
            )
          );
        }

        toastStore.add(
          nowFollowing ? `Now following ${target ? target.name : 'user'}!` : `Unfollowed ${target ? target.name : 'user'}.`,
          nowFollowing ? 'success' : 'info'
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, runAsync]
  );

  const toggleFollowTag = useCallback(
    async (tagId: string): Promise<void> => {
      try {
        const { following, tag } = await catalogService.toggleFollowTag(requireUser().id, tagId);
        if (tag) {
          toastStore.add(
            following ? `Subscribed to #${tag.name}` : `Unsubscribed from #${tag.name}`,
            'info'
          );
        }
      } catch (error) {
        toastStore.add(errorMessage(error), 'error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  // ---------------------------------------------------------- Notifications
  const markNotificationRead = useCallback(
    async (id: string): Promise<void> => {
      try {
        await markRead(id);
      } catch (error) {
        toastStore.add(errorMessage(error), 'error');
      }
    },
    [markRead]
  );

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    try {
      await markAllRead();
      toastStore.add('All notifications marked as read', 'info');
    } catch (error) {
      toastStore.add(errorMessage(error), 'error');
    }
  }, [markAllRead]);

  // --------------------------------------------------------------- Profile
  const updateUserProfile = useCallback(
    (data: EditableProfilePatch): Promise<void> =>
      runAsync(async user => {
        await userService.updateUserProfile(user.id, data);
        toastStore.add('Profile updated successfully!', 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runAsync]
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
    async (userId: string): Promise<void> => {
      const target = userService.getById(userId);
      await runAsync(async actor => {
        await admin.approveUser(userId);
        await bestEffort(() => notificationService.notifyAdminApproval(userId, actor, 'approved'));
        toastStore.add(`Account for ${target ? target.name : 'User'} has been approved!`, 'success');
      });
    },
    [admin, runAsync, bestEffort]
  );

  const rejectUser = useCallback(
    async (userId: string): Promise<void> => {
      const target = userService.getById(userId);
      await runAsync(async actor => {
        await admin.rejectUser(userId);
        await bestEffort(() => notificationService.notifyAdminApproval(userId, actor, 'rejected'));
        toastStore.add(
          `Registration for ${target ? target.name : 'User'} rejected — the record is kept as "rejected".`,
          'info'
        );
      });
    },
    [admin, runAsync, bestEffort]
  );

  const blockUser = useCallback(
    async (userId: string): Promise<void> => {
      const target = userService.getById(userId);
      await runAsync(async () => {
        await admin.blockUser(userId);
        toastStore.add(`User ${target ? target.name : 'User'} has been blocked.`, 'warning');
      });
    },
    [admin, runAsync]
  );

  const unblockUser = useCallback(
    async (userId: string): Promise<void> => {
      const target = userService.getById(userId);
      await runAsync(async () => {
        await admin.unblockUser(userId);
        toastStore.add(`User ${target ? target.name : 'User'} has been unblocked.`, 'success');
      });
    },
    [admin, runAsync]
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
      void runAsync(async user => {
        const created = admin.createAnnouncement(ann);
        const approved = userService.getUsers().filter(u => u.status === 'approved');
        await bestEffort(() =>
          notificationService.notifyAnnouncement(
            approved.map(member => member.id),
            user,
            created.title,
            created.content
          )
        );
        toastStore.add('Campus announcement broadcasted!', 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, admin, runAsync]
  );

  const createCategory = useCallback(
    async (cat: Omit<Category, 'id' | 'questionsCount'>): Promise<void> => {
      await runAsync(async () => {
        const created = await catalogService.createCategory(cat);
        toastStore.add(`Academic category "${created.name}" created!`, 'success');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runAsync]
  );

  const deleteCategory = useCallback(
    async (catId: string): Promise<void> => {
      await runAsync(async () => {
        await catalogService.deleteCategory(catId);
        toastStore.add('Category removed.', 'info');
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runAsync]
  );

  // -------------------------------------------------------------- Messages
  const sendMessage = useCallback(
    (receiverId: string, text: string, codeSnippet?: Message['codeSnippet']) => {
      sendMessageInternal(receiverId, text, codeSnippet);
    },
    [sendMessageInternal]
  );

  const dataStatus = useMemo<LoadStatus>(() => {
    const statuses: LoadStatus[] = [
      doubtsStatus,
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
  }, [
    doubtsStatus,
    answersState.status,
    socialState.status,
    catalogState.status,
    notificationsStatus,
    messagesStatus,
    admin.status
  ]);

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
      loadAnswersForDoubt,
      addAnswer,
      updateAnswer,
      deleteAnswer,
      acceptAnswer,
      toggleVoteAnswer,
      getDoubtComments,
      addCommentToDoubt,
      addCommentToAnswer,
      updateComment,
      deleteComment,
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
      loadAnswersForDoubt,
      addAnswer,
      updateAnswer,
      deleteAnswer,
      acceptAnswer,
      toggleVoteAnswer,
      getDoubtComments,
      addCommentToDoubt,
      addCommentToAnswer,
      updateComment,
      deleteComment,
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
