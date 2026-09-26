import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  Doubt,
  Answer,
  Notification,
  Message,
  Conversation,
  Category,
  Tag,
  Report,
  Announcement,
  AuditLog,
  Comment
} from '../types';
import { mockUsers, currentUserMock, mentorUserMock, adminUserMock } from '../data/mockUsers';
import { allMockDoubts } from '../data/mockDoubts';
import { mockAnswers } from '../data/mockAnswers';
import { mockNotifications } from '../data/mockNotifications';
import { mockConversations, mockMessages } from '../data/mockMessages';
import { mockCategories } from '../data/mockCategories';
import { mockTags } from '../data/mockTags';
import { mockReports, mockAnnouncements, mockAuditLogs } from '../data/mockAdminData';

export interface ToastItem {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

interface AppContextType {
  // Auth & User
  currentUser: User;
  setCurrentUser: (user: User) => void;
  switchRole: (role: 'student' | 'mentor' | 'admin') => void;
  users: User[];
  isAuthenticated: boolean;
  login: (email: string, pass: string) => { success: boolean; message?: string };
  logout: () => void;
  registerUser: (userData: Partial<User>) => void;
  updateUserProfile: (data: Partial<User>) => void;

  // Doubts
  doubts: Doubt[];
  getDoubtById: (id: string) => Doubt | undefined;
  createDoubt: (doubt: Omit<Doubt, 'id' | 'createdAt' | 'author' | 'authorId' | 'upvotes' | 'downvotes' | 'views' | 'answersCount' | 'hasAcceptedAnswer'>) => string;
  deleteDoubt: (id: string) => void;
  toggleVoteDoubt: (id: string, type: 'up' | 'down') => void;
  toggleBookmark: (id: string) => void;
  bookmarkedDoubtIds: string[];

  // Answers & Comments
  answers: Answer[];
  getAnswersForDoubt: (doubtId: string) => Answer[];
  addAnswer: (doubtId: string, content: string, codeSnippet?: { language: string; code: string }) => void;
  acceptAnswer: (doubtId: string, answerId: string) => void;
  toggleVoteAnswer: (answerId: string, type: 'up' | 'down') => void;
  addCommentToAnswer: (answerId: string, text: string) => void;

  // Social & Follow
  followingUserIds: string[];
  toggleFollowUser: (userId: string) => void;

  // Notifications
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: number;

  // Messages
  conversations: Conversation[];
  messages: Message[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (receiverId: string, text: string, codeSnippet?: { language: string; code: string }) => void;

  // Categories & Tags
  categories: Category[];
  tags: Tag[];
  toggleFollowTag: (tagId: string) => void;

  // Admin Features
  reports: Report[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  dismissReport: (reportId: string) => void;
  resolveReport: (reportId: string, actionTaken: string) => void;
  deleteReportedContent: (reportId: string) => void;
  createAnnouncement: (ann: Omit<Announcement, 'id' | 'createdAt' | 'authorName' | 'isActive'>) => void;
  createCategory: (cat: Omit<Category, 'id' | 'questionsCount'>) => void;
  deleteCategory: (catId: string) => void;

  // Toast System
  toasts: ToastItem[];
  addToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;

  // Theme
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ch_theme') !== 'light';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ch_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ch_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // Users & Auth
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('ch_current_user_role');
    if (saved === 'mentor') return mentorUserMock;
    if (saved === 'admin') return adminUserMock;
    return currentUserMock;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  // Doubts state
  const [doubts, setDoubts] = useState<Doubt[]>(allMockDoubts);
  const [bookmarkedDoubtIds, setBookmarkedDoubtIds] = useState<string[]>(['doubt-1', 'doubt-5', 'doubt-10']);

  // Answers state
  const [answers, setAnswers] = useState<Answer[]>(mockAnswers);

  // Following user IDs
  const [followingUserIds, setFollowingUserIds] = useState<string[]>(['user-2', 'user-6', 'user-15']);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  // Messages & conversations
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [activeConversationId, setActiveConversationId] = useState<string | null>('conv-1');

  // Categories & Tags
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [tags, setTags] = useState<Tag[]>(mockTags);

  // Admin Data
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [announcements, setAnnouncements] = useState<Announcement[]>(mockAnnouncements);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Role switching
  const switchRole = (role: 'student' | 'mentor' | 'admin') => {
    localStorage.setItem('ch_current_user_role', role);
    if (role === 'student') {
      setCurrentUser(currentUserMock);
      addToast('Switched to Student mode (Rahul Sharma)', 'info');
    } else if (role === 'mentor') {
      setCurrentUser(mentorUserMock);
      addToast('Switched to Senior Mentor mode (Priya Sundaram)', 'info');
    } else {
      setCurrentUser(adminUserMock);
      addToast('Switched to Admin Portal (Dr. Ramesh Kumar)', 'info');
    }
  };

  const login = (email: string, pass: string): { success: boolean; message?: string } => {
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      return { success: false, message: 'No registered campus account with this email.' };
    }
    if (found.status === 'blocked') {
      return { success: false, message: 'Your account has been restricted by campus moderation.' };
    }
    if (found.status === 'pending') {
      return { success: false, message: 'Your registration is currently pending Department Admin approval.' };
    }
    if (pass !== 'password123' && pass !== 'admin123' && pass.length < 4) {
      return { success: false, message: 'Invalid credentials. (Hint: use password123)' };
    }
    setCurrentUser(found);
    setIsAuthenticated(true);
    addToast(`Welcome back, ${found.name}!`, 'success');
    return { success: true };
  };

  const logout = () => {
    setIsAuthenticated(false);
    addToast('You have been safely logged out.', 'info');
  };

  const registerUser = (userData: Partial<User>) => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userData.name || 'New Student',
      username: userData.username || `student_${Date.now().toString().slice(-4)}`,
      email: userData.email || 'student@campus.edu',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      department: userData.department || 'CSE',
      year: userData.year || '1st',
      section: userData.section || 'A',
      bio: userData.bio || 'Aspiring engineering student exploring academics and tech doubts.',
      skills: userData.skills || ['C', 'Mathematics'],
      role: 'student',
      status: 'pending', // Waiting for admin approval!
      reputation: 0,
      questionsCount: 0,
      answersCount: 0,
      acceptedCount: 0,
      followersCount: 0,
      followingCount: 0,
      joinedDate: 'Just now',
      badges: []
    };
    setUsers(prev => [newUser, ...prev]);
    // Log in audit
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      actor: newUser.name,
      action: 'Submitted student registration',
      target: `${newUser.department} (${newUser.year} Year)`,
      timestamp: 'Just now',
      type: 'user'
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const updateUserProfile = (data: Partial<User>) => {
    setCurrentUser(prev => ({ ...prev, ...data }));
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, ...data } : u));
    addToast('Profile updated successfully!', 'success');
  };

  // Doubt actions
  const getDoubtById = (id: string) => doubts.find(d => d.id === id);

  const createDoubt = (doubtData: Omit<Doubt, 'id' | 'createdAt' | 'author' | 'authorId' | 'upvotes' | 'downvotes' | 'views' | 'answersCount' | 'hasAcceptedAnswer'>): string => {
    const newId = `doubt-${Date.now()}`;
    const newDoubt: Doubt = {
      ...doubtData,
      id: newId,
      createdAt: 'Just now',
      authorId: currentUser.id,
      author: currentUser,
      upvotes: 1,
      downvotes: 0,
      views: 1,
      answersCount: 0,
      hasAcceptedAnswer: false,
      userVote: 'up'
    };

    setDoubts(prev => [newDoubt, ...prev]);
    setCurrentUser(prev => ({
      ...prev,
      questionsCount: prev.questionsCount + 1,
      reputation: prev.reputation + 5
    }));

    // Update categories
    setCategories(prev => prev.map(c => c.name === newDoubt.category ? { ...c, questionsCount: c.questionsCount + 1 } : c));

    // Audit log
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        actor: currentUser.name,
        action: newDoubt.visibility === 'private' ? 'Created 🔒 Private Doubt' : 'Posted new Doubt',
        target: newDoubt.title,
        timestamp: 'Just now',
        type: 'doubt'
      },
      ...prev
    ]);

    addToast('Your doubt was posted to the campus hub!', 'success');
    return newId;
  };

  const deleteDoubt = (id: string) => {
    const target = doubts.find(d => d.id === id);
    setDoubts(prev => prev.filter(d => d.id !== id));
    setAnswers(prev => prev.filter(a => a.doubtId !== id));
    addToast('Question deleted.', 'info');
    if (target) {
      setAuditLogs(prev => [
        {
          id: `log-${Date.now()}`,
          actor: currentUser.name,
          action: 'Deleted question',
          target: target.title,
          timestamp: 'Just now',
          type: 'doubt'
        },
        ...prev
      ]);
    }
  };

  const toggleVoteDoubt = (id: string, type: 'up' | 'down') => {
    setDoubts(prev => prev.map(d => {
      if (d.id !== id) return d;
      const currentVote = d.userVote;
      let newVote: 'up' | 'down' | null = type;
      let upDelta = 0;
      let downDelta = 0;

      if (currentVote === type) {
        // Toggle off
        newVote = null;
        if (type === 'up') upDelta = -1;
        if (type === 'down') downDelta = -1;
      } else if (currentVote === null || currentVote === undefined) {
        if (type === 'up') upDelta = 1;
        if (type === 'down') downDelta = 1;
      } else {
        // Switching vote
        if (type === 'up') {
          upDelta = 1;
          downDelta = -1;
        } else {
          upDelta = -1;
          downDelta = 1;
        }
      }

      return {
        ...d,
        upvotes: Math.max(0, d.upvotes + upDelta),
        downvotes: Math.max(0, d.downvotes + downDelta),
        userVote: newVote
      };
    }));
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedDoubtIds(prev => {
      const exists = prev.includes(id);
      if (exists) {
        addToast('Removed from bookmarks', 'info');
        return prev.filter(item => item !== id);
      } else {
        addToast('Doubt saved to your Bookmarks!', 'success');
        return [...prev, id];
      }
    });
  };

  // Answers
  const getAnswersForDoubt = (doubtId: string) => {
    return answers
      .filter(a => a.doubtId === doubtId)
      .sort((a, b) => (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0) || b.upvotes - a.upvotes);
  };

  const addAnswer = (doubtId: string, content: string, codeSnippet?: { language: string; code: string }) => {
    const newAnswer: Answer = {
      id: `ans-${Date.now()}`,
      doubtId,
      authorId: currentUser.id,
      author: currentUser,
      content,
      createdAt: 'Just now',
      upvotes: 0,
      downvotes: 0,
      isAccepted: false,
      codeSnippet,
      comments: []
    };

    setAnswers(prev => [...prev, newAnswer]);
    setDoubts(prev => prev.map(d => d.id === doubtId ? { ...d, answersCount: d.answersCount + 1 } : d));
    setCurrentUser(prev => ({
      ...prev,
      answersCount: prev.answersCount + 1,
      reputation: prev.reputation + 10
    }));

    // Trigger notification to author of doubt
    const targetDoubt = doubts.find(d => d.id === doubtId);
    if (targetDoubt && targetDoubt.authorId !== currentUser.id) {
      const newNotif: Notification = {
        id: `notif-${Date.now()}`,
        userId: targetDoubt.authorId,
        type: 'answer',
        title: 'New Solution on your Question',
        message: `${currentUser.name} posted an answer to: "${targetDoubt.title.slice(0, 50)}..."`,
        timestamp: 'Just now',
        read: false,
        link: `/app/doubts/${doubtId}`,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar
      };
      setNotifications(prev => [newNotif, ...prev]);
    }

    addToast('Your solution has been submitted!', 'success');
  };

  const acceptAnswer = (doubtId: string, answerId: string) => {
    setAnswers(prev => prev.map(a => {
      if (a.doubtId !== doubtId) return a;
      return {
        ...a,
        isAccepted: a.id === answerId ? !a.isAccepted : false
      };
    }));

    const isNowAccepted = answers.find(a => a.id === answerId)?.isAccepted !== true;

    setDoubts(prev => prev.map(d => {
      if (d.id !== doubtId) return d;
      return { ...d, hasAcceptedAnswer: isNowAccepted };
    }));

    if (isNowAccepted) {
      const targetAns = answers.find(a => a.id === answerId);
      if (targetAns) {
        // Boost reputation of answer author
        setUsers(prev => prev.map(u => u.id === targetAns.authorId ? {
          ...u,
          reputation: u.reputation + 15,
          acceptedCount: u.acceptedCount + 1
        } : u));

        // Send notification
        const newNotif: Notification = {
          id: `notif-${Date.now()}`,
          userId: targetAns.authorId,
          type: 'accepted',
          title: 'Answer Accepted! (+15 Rep)',
          message: `${currentUser.name} marked your answer as the accepted solution!`,
          timestamp: 'Just now',
          read: false,
          link: `/app/doubts/${doubtId}`,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar
        };
        setNotifications(prev => [newNotif, ...prev]);
      }
      addToast('Marked as Accepted Answer! (+15 Reputation awarded)', 'success');
    } else {
      addToast('Unmarked accepted answer.', 'info');
    }
  };

  const toggleVoteAnswer = (answerId: string, type: 'up' | 'down') => {
    setAnswers(prev => prev.map(a => {
      if (a.id !== answerId) return a;
      const currentVote = a.userVote;
      let newVote: 'up' | 'down' | null = type;
      let upDelta = 0;
      let downDelta = 0;

      if (currentVote === type) {
        newVote = null;
        if (type === 'up') upDelta = -1;
        if (type === 'down') downDelta = -1;
      } else if (currentVote === null || currentVote === undefined) {
        if (type === 'up') upDelta = 1;
        if (type === 'down') downDelta = 1;
      } else {
        if (type === 'up') {
          upDelta = 1;
          downDelta = -1;
        } else {
          upDelta = -1;
          downDelta = 1;
        }
      }

      return {
        ...a,
        upvotes: Math.max(0, a.upvotes + upDelta),
        downvotes: Math.max(0, a.downvotes + downDelta),
        userVote: newVote
      };
    }));
  };

  const addCommentToAnswer = (answerId: string, text: string) => {
    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      content: text,
      createdAt: 'Just now'
    };

    setAnswers(prev => prev.map(a => {
      if (a.id !== answerId) return a;
      return { ...a, comments: [...a.comments, newComment] };
    }));
    addToast('Comment published.', 'success');
  };

  // Follow system
  const toggleFollowUser = (userId: string) => {
    setFollowingUserIds(prev => {
      const exists = prev.includes(userId);
      const targetUser = users.find(u => u.id === userId);
      if (exists) {
        addToast(`Unfollowed ${targetUser?.name || 'user'}.`, 'info');
        setUsers(uList => uList.map(u => u.id === userId ? { ...u, followersCount: Math.max(0, u.followersCount - 1) } : u));
        return prev.filter(id => id !== userId);
      } else {
        addToast(`Now following ${targetUser?.name || 'user'}!`, 'success');
        setUsers(uList => uList.map(u => u.id === userId ? { ...u, followersCount: u.followersCount + 1 } : u));
        // Notification
        if (targetUser) {
          const newNotif: Notification = {
            id: `notif-${Date.now()}`,
            userId: targetUser.id,
            type: 'follow',
            title: 'New Follower',
            message: `${currentUser.name} (${currentUser.department}, ${currentUser.year} Year) started following you.`,
            timestamp: 'Just now',
            read: false,
            link: `/app/users/${currentUser.id}`,
            senderName: currentUser.name,
            senderAvatar: currentUser.avatar
          };
          setNotifications(nList => [newNotif, ...nList]);
        }
        return [...prev, userId];
      }
    });
  };

  // Notifications
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    addToast('All notifications marked as read', 'info');
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // Messaging
  const sendMessage = (receiverId: string, text: string, codeSnippet?: { language: string; code: string }) => {
    const receiver = users.find(u => u.id === receiverId) || mentorUserMock;
    let conv = conversations.find(c => c.participant.id === receiverId);
    let convId = conv ? conv.id : `conv-${Date.now()}`;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: convId,
      senderId: currentUser.id,
      receiverId,
      text,
      timestamp: 'Just now',
      read: true,
      codeSnippet
    };

    setMessages(prev => [...prev, newMsg]);

    if (!conv) {
      const newConv: Conversation = {
        id: convId,
        participant: receiver,
        lastMessage: newMsg,
        unreadCount: 0
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(convId);
    } else {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, lastMessage: newMsg } : c));
    }
  };

  // Tags
  const toggleFollowTag = (tagId: string) => {
    setTags(prev => prev.map(t => {
      if (t.id !== tagId) return t;
      const willFollow = !t.isFollowing;
      addToast(willFollow ? `Subscribed to #${t.name}` : `Unsubscribed from #${t.name}`, 'info');
      return {
        ...t,
        isFollowing: willFollow,
        followersCount: willFollow ? t.followersCount + 1 : Math.max(0, t.followersCount - 1)
      };
    }));
  };

  // Admin Actions
  const approveUser = (userId: string) => {
    const userToApprove = users.find(u => u.id === userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    addToast(`Account for ${userToApprove?.name || 'User'} has been approved!`, 'success');
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        actor: currentUser.name,
        action: 'Approved student account',
        target: userToApprove ? `${userToApprove.name} (${userToApprove.department})` : userId,
        timestamp: 'Just now',
        type: 'user'
      },
      ...prev
    ]);
  };

  const rejectUser = (userId: string) => {
    const userToReject = users.find(u => u.id === userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    addToast(`Registration for ${userToReject?.name || 'User'} rejected.`, 'info');
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        actor: currentUser.name,
        action: 'Rejected student registration',
        target: userToReject?.email || userId,
        timestamp: 'Just now',
        type: 'user'
      },
      ...prev
    ]);
  };

  const blockUser = (userId: string) => {
    const userToBlock = users.find(u => u.id === userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'blocked' } : u));
    addToast(`User ${userToBlock?.name || 'User'} has been blocked.`, 'warning');
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        actor: currentUser.name,
        action: 'Blocked student account',
        target: userToBlock?.name || userId,
        timestamp: 'Just now',
        type: 'moderation'
      },
      ...prev
    ]);
  };

  const unblockUser = (userId: string) => {
    const userToUnblock = users.find(u => u.id === userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    addToast(`User ${userToUnblock?.name || 'User'} has been unblocked.`, 'success');
  };

  const dismissReport = (reportId: string) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
    addToast('Report dismissed without action.', 'info');
  };

  const resolveReport = (reportId: string, actionTaken: string) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    addToast(`Report resolved: ${actionTaken}`, 'success');
  };

  const deleteReportedContent = (reportId: string) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    if (report.targetType === 'doubt') {
      deleteDoubt(report.targetId);
    } else if (report.targetType === 'answer') {
      setAnswers(prev => prev.filter(a => a.id !== report.targetId));
    }
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    addToast('Reported content removed from the campus forum.', 'success');
  };

  const createAnnouncement = (ann: Omit<Announcement, 'id' | 'createdAt' | 'authorName' | 'isActive'>) => {
    const newAnn: Announcement = {
      ...ann,
      id: `ann-${Date.now()}`,
      createdAt: 'Today',
      authorName: currentUser.name,
      isActive: true
    };
    setAnnouncements(prev => [newAnn, ...prev]);
    // Also push a system notification
    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      userId: 'user-1',
      type: 'announcement',
      title: `Campus Announcement: ${newAnn.title}`,
      message: newAnn.content,
      timestamp: 'Just now',
      read: false,
      senderName: currentUser.name
    };
    setNotifications(prev => [newNotif, ...prev]);
    addToast('Campus announcement broadcasted!', 'success');
  };

  const createCategory = (cat: Omit<Category, 'id' | 'questionsCount'>) => {
    const newCat: Category = {
      ...cat,
      id: `cat-${Date.now()}`,
      questionsCount: 0
    };
    setCategories(prev => [...prev, newCat]);
    addToast(`Academic category "${newCat.name}" created!`, 'success');
  };

  const deleteCategory = (catId: string) => {
    setCategories(prev => prev.filter(c => c.id !== catId));
    addToast('Category removed.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchRole,
        users,
        isAuthenticated,
        login,
        logout,
        registerUser,
        updateUserProfile,
        doubts,
        getDoubtById,
        createDoubt,
        deleteDoubt,
        toggleVoteDoubt,
        toggleBookmark,
        bookmarkedDoubtIds,
        answers,
        getAnswersForDoubt,
        addAnswer,
        acceptAnswer,
        toggleVoteAnswer,
        addCommentToAnswer,
        followingUserIds,
        toggleFollowUser,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        unreadNotificationsCount,
        conversations,
        messages,
        activeConversationId,
        setActiveConversationId,
        sendMessage,
        categories,
        tags,
        toggleFollowTag,
        reports,
        announcements,
        auditLogs,
        approveUser,
        rejectUser,
        blockUser,
        unblockUser,
        dismissReport,
        resolveReport,
        deleteReportedContent,
        createAnnouncement,
        createCategory,
        deleteCategory,
        toasts,
        addToast,
        removeToast,
        isDarkMode,
        toggleTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
