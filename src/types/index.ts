export type Department = 'CSE' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL' | 'IT' | 'AIDS';
export type AcademicYear = '1st' | '2nd' | '3rd' | '4th' | 'Faculty' | 'Alumni';
export type UserRole = 'student' | 'mentor' | 'admin';

/**
 * Lifecycle of a campus account.
 * - pending:  registered, waiting for department admin approval
 * - active:   fully enabled
 * - rejected: application was denied (record is preserved for audit history)
 * - blocked:  temporarily restricted by moderation
 */
export type UserStatus = 'active' | 'pending' | 'rejected' | 'blocked';

export type DoubtPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  unlockedAt: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  coverImage?: string;
  department: Department;
  year: AcademicYear;
  section?: string;
  bio: string;
  skills: string[];
  role: UserRole;
  status: UserStatus;
  reputation: number;
  questionsCount: number;
  answersCount: number;
  acceptedCount: number;
  followersCount: number;
  followingCount: number;
  joinedDate: string;
  badges: Badge[];
  isOnline?: boolean;
}

export interface CodeSnippet {
  language: string;
  code: string;
}

export interface Attachment {
  name: string;
  type: 'image' | 'pdf' | 'code' | 'archive';
  url: string;
  size: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  /** Set when this comment is a reply to another comment (threading prep). */
  parentCommentId?: string;
  /** Handles mentioned in the comment body, e.g. ["priya_sundar"]. */
  mentions?: string[];
}

export interface Answer {
  id: string;
  doubtId: string;
  authorId: string;
  authorSnapshot: UserSnapshot;
  content: string;
  createdAt: string;
  updatedAt?: string;
  upvotes: number;
  downvotes: number;
  isAccepted: boolean;
  codeSnippet?: CodeSnippet;
  attachments?: Attachment[];
  comments: Comment[];
  mentions?: string[];
  userVote?: 'up' | 'down' | null;
}

export interface Doubt {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorSnapshot: UserSnapshot;
  createdAt: string;
  updatedAt?: string;
  category: string;
  subject: string;
  tags: string[];
  visibility: 'public' | 'private';
  allowedUserIds?: string[];
  priority?: DoubtPriority;
  upvotes: number;
  downvotes: number;
  views: number;
  answersCount: number;
  hasAcceptedAnswer: boolean;
  codeSnippet?: CodeSnippet;
  attachments?: Attachment[];
  mentions?: string[];
  isPinned?: boolean;
  userVote?: 'up' | 'down' | null;
  isBookmarked?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'answer' | 'accepted' | 'follow' | 'comment' | 'admin_approval' | 'announcement';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  senderAvatar?: string;
  senderName?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
  attachment?: {
    name: string;
    type: string;
    url: string;
    size?: string;
  };
  codeSnippet?: CodeSnippet;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message;
  unreadCount: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  domain: 'Programming' | 'Engineering' | 'Academics' | 'Career';
  questionsCount: number;
  status: 'active' | 'inactive';
}

export interface Tag {
  id: string;
  name: string;
  description: string;
  count: number;
  followersCount: number;
  isTrending?: boolean;
  isFollowing?: boolean;
}

export type ReportReason =
  | 'Spam'
  | 'Wrong information'
  | 'Abusive content'
  | 'Inappropriate content'
  | 'Harassment'
  | 'Duplicate question'
  | 'Other';

export interface Report {
  id: string;
  targetType: 'doubt' | 'answer' | 'user' | 'comment';
  targetId: string;
  targetTitle: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reason: ReportReason;
  description: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'urgent';
  targetAudience: 'all' | 'students' | 'mentors' | 'CSE' | 'ECE';
  createdAt: string;
  authorName: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'user' | 'doubt' | 'moderation' | 'system';
}

export interface UserStats {
  questionsAsked: number;
  answersGiven: number;
  acceptedAnswers: number;
  reputation: number;
  upvotesReceived: number;
}

/**
 * Denormalized author data embedded in content documents.
 * Mirrors the `users/{uid}` document so Firestore rules can validate
 * authorship without extra reads, and so content survives profile edits.
 */
export interface UserSnapshot {
  id: string;
  name: string;
  username: string;
  avatar: string;
  department: Department;
  year: AcademicYear;
  role: UserRole;
  reputation: number;
}

export function toUserSnapshot(user: User): UserSnapshot {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    department: user.department,
    year: user.year,
    role: user.role,
    reputation: user.reputation
  };
}

/**
 * Admin moderation settings singleton (`adminSettings/{singleton}` in Firestore).
 */
export interface AdminSettings {
  requireFacultyApproval: boolean;
  autoFlagSpamWords: boolean;
  allowedDomain: string;
  minRepToComment: number;
  updatedAt?: string;
}

export interface Warning {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  issuedBy: string;
  issuedAt: string;
}
