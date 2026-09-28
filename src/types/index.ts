export type Department = 'CSE' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL' | 'IT' | 'AIDS';
export type AcademicYear = '1st' | '2nd' | '3rd' | '4th' | 'Faculty' | 'Alumni';
export type UserRole = 'student' | 'mentor' | 'admin';

/**
 * Lifecycle of a campus account.
 * - pending:  registered, waiting for department admin approval
 * - approved: fully enabled (unblocked)
 * - rejected: application was denied (record is preserved for audit history)
 * - blocked:  temporarily restricted by moderation
 */
export type UserStatus = 'approved' | 'pending' | 'rejected' | 'blocked';

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
  /** Optional public links shown on the profile. Owner-editable only. */
  github?: string;
  linkedin?: string;
  website?: string;
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
  /** Set only by an edit; absent while the comment is untouched. */
  updatedAt?: string;
  /** Set when this comment is a reply to another comment (threading prep). */
  parentCommentId?: string;
  /** Handles mentioned in the comment body, e.g. ["priya_sundar"]. */
  mentions?: string[];
  /**
   * Structured mention reference: the Firebase UIDs `mentions[]` resolved to.
   * Handles are display data; these IDs are the only thing a notification
   * fan-out is allowed to act on, so an unresolvable `@handle` can never
   * address a user that is not in the directory.
   */
  mentionIds?: string[];
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
  /** `mentions[]` resolved to real user IDs (see `resolveMentions`). */
  mentionIds?: string[];
  userVote?: 'up' | 'down' | null;
}

/**
 * One line of a member's reputation ledger.
 *
 * `reputationEvents` is the ONLY source the app derives reputation from: the
 * stored `delta` is validated by `firestore.rules` against the document the
 * event claims to reward (the doubt, the answer, the accepted answer or the
 * voter's own `votes/{…}` document), so a client can never mint points.
 */
export type ReputationEventType = 'question' | 'answer' | 'accepted' | 'vote';

export interface ReputationEvent {
  /**
   * Deterministic id, so an event can only ever exist once:
   * `question_{doubtId}_{uid}` · `answer_{doubtId}_{answerId}_{uid}` ·
   * `accepted_{answerId}_{uid}` · `vote_{targetId}_{voterUid}`.
   */
  id: string;
  /** The member the points belong to - never the writer of a vote event. */
  userId: string;
  type: ReputationEventType;
  /** Signed point adjustment; the exact value is pinned by the rules. */
  delta: number;
  /** The document the reward is derived from (doubt id / answer id). */
  sourceId: string;
  /** Owning doubt for `answer` / `accepted` / `answer` votes; else `''`. */
  doubtId: string;
  /** For `vote` events: the member who cast the vote. */
  voterId?: string;
  /** For `vote` events: `1` (up) or `-1` (down). */
  value?: number;
  /** For `accepted` events: the doubt author who accepted the answer. */
  actorId?: string;
  /** For `vote` events: `''` on a milestone, `'doubt'` / `'answer'` otherwise. */
  targetType?: string;
  /** For `vote` events: the doubt or answer that was voted on. */
  targetId?: string;
  createdAtMs: number;
}

/** A follow edge: `follows/{targetUserId}_{followerUid}`. */
export interface Follow {
  id: string;
  /** The member doing the following (the document owner). */
  userId: string;
  /** The member being followed. */
  targetUserId: string;
  createdAtMs: number;
}

/**
 * Badge catalogue entry (`badges/{badgeId}`, admin-managed).
 *
 * `kind` decides who may award `userBadges/{uid}_{badgeId}`:
 * `self` badges are claimed by the member and proved by the rules against a
 * real document; `threshold` badges can only be granted by a moderator,
 * because Firestore rules cannot count a collection.
 */
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  kind: 'self' | 'threshold';
  /** For `threshold` badges: the reputation needed to earn it. */
  threshold?: number;
}

/** One badge actually held by a member (`userBadges/{uid}_{badgeId}`). */
export interface UserBadge {
  id: string;
  uid: string;
  badgeId: string;
  /** The document that proves the criterion was met. */
  sourceId: string;
  doubtId?: string;
  awardedAtMs: number;
}

/**
 * Aggregated, fully derived profile numbers.
 *
 * Every field is computed from Firestore aggregations at read time and is
 * NEVER written back to `users/{uid}` - `firestore.rules` refuses any client
 * write to those keys, which is what stops a self-declared score.
 */
export interface ProfileStats {
  userId: string;
  reputation: number;
  questionsCount: number;
  answersCount: number;
  acceptedCount: number;
  followersCount: number;
  followingCount: number;
  badges: Badge[];
  /** Wall-clock ms of the last computation (cache freshness). */
  computedAtMs: number;
}

/** A row in a member's public activity timeline. */
export interface ActivityItem {
  id: string;
  kind: 'question' | 'answer' | 'accepted' | 'follow' | 'badge' | 'reputation';
  title: string;
  detail: string;
  link?: string;
  createdAtMs: number;
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
  /** `mentions[]` resolved to real user IDs (see `resolveMentions`). */
  mentionIds?: string[];
  isPinned?: boolean;
  userVote?: 'up' | 'down' | null;
  isBookmarked?: boolean;
  /**
   * Persisted bookkeeping (adapter-owned, never set by a form).
   * Id of the answer created/deleted in the same atomic write as the last
   * `answersCount` change — `firestore.rules` uses it to prove the counter
   * only ever moves together with a real answer document.
   */
  lastAnswerId?: string | null;
  /**
   * Persisted bookkeeping: the accepted answer id, or null. `hasAcceptedAnswer`
   * must always agree with it; the rules reject any doubt/answer pair that
   * does not, which is how "one accepted answer per doubt" is enforced.
   */
  acceptedAnswerId?: string | null;
}

export interface Notification {
  id: string;
  /** The member the inbox belongs to - never the person who caused the event. */
  userId: string;
  /**
   * The member who caused the event. Required on write: `firestore.rules`
   * pins it to `request.auth.uid`, so no one can raise an event that
   * impersonates somebody else.
   */
  senderId: string;
  /**
   * Event kinds. `badge` and `reputation` are the only two that may be
   * addressed to the member who caused them (an award you give yourself a
   * notification about); every other kind requires `userId != senderId`.
   */
  type:
    | 'mention'
    | 'answer'
    | 'accepted'
    | 'follow'
    | 'comment'
    | 'admin_approval'
    | 'announcement'
    | 'badge'
    | 'reputation';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  /**
   * The document that justifies a `badge` or `reputation` event: the
   * `userBadges/{uid}_{badgeId}` row, or the `reputationEvents/{id}` row.
   * `firestore.rules` requires it and re-reads that document, so a member
   * cannot congratulate themselves on an award they were never granted.
   */
  sourceId?: string;
  senderAvatar?: string;
  senderName?: string;
  /**
   * `client` = raised by the app from the browser; `server` = raised by a
   * trusted backend (Cloud Functions / Admin SDK). Clients may only ever
   * write `client`, which the rules enforce, so a future server-generated
   * event is distinguishable from a self-asserted one.
   */
  source?: 'client' | 'server';
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  /** Derived from `createdAtMs` when the thread is read (relative time). */
  timestamp: string;
  /** Epoch ms of the write - the field `firestore.rules` validates. */
  createdAtMs: number;
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
  /** Document id - the two participant uids joined by `_`. */
  id: string;
  /**
   * The two Firebase UIDs in ascending order - literally the document id
   * (`conversations/{a_b}`). There is exactly one document per member pair,
   * which is what makes a duplicate conversation structurally impossible.
   */
  participants: string[];
  /**
   * The peer, resolved from the user directory. `null` only while that
   * member is not in the directory (a deleted or not-yet-loaded profile);
   * the thread itself still renders.
   */
  participant: User | null;
  lastMessage: Message | null;
  /**
   * Derived, never stored: `1` when the peer wrote after my own read cursor
   * (`conversationReads/{a_b}_{uid}.lastReadAtMs`), otherwise `0`. Nothing a
   * client can write moves it - my cursor is my own document and theirs is
   * theirs.
   */
  unreadCount: number;
  /** `conversation.lastMessageAtMs`. */
  lastMessageAtMs: number;
  /** My own read cursor for this thread (0 when never opened). */
  lastReadAtMs: number;
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

/**
 * A moderation case (`reports/{reportId}`).
 *
 * The document id is `{targetType}_{targetId}_{reporterId}`, so one member
 * can only ever report a given target once - `firestore.rules` rebuilds the
 * same id on create, which is how duplicate reports are refused outright.
 */
export interface Report {
  id: string;
  targetType: 'doubt' | 'answer' | 'user' | 'comment';
  targetId: string;
  targetTitle: string;
  /** Pinned to `request.auth.uid` by the rules - never form input. */
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reason: ReportReason;
  description: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAtMs: number;
  /** Set when a moderator closes (or reopens) the case. */
  resolvedAtMs?: number;
  /** The moderator who decided - always `request.auth.uid` in the rules. */
  resolvedById?: string;
  resolutionNote?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'urgent';
  targetAudience: 'all' | 'students' | 'mentors' | 'CSE' | 'ECE';
  /** The admin who published it; frozen by the rules. */
  authorId: string;
  authorName: string;
  createdAtMs: number;
  /** Derived from `createdAtMs` for display. */
  createdAt: string;
  isActive: boolean;
}

/**
 * One row of the append-only moderation trail (`auditLogs/{logId}`).
 *
 * `actorId` is pinned to the caller on write, so nobody can file a decision
 * under another member's name; `update` is refused outright by the rules.
 */
export interface AuditLog {
  id: string;
  actorId: string;
  /** Display name captured when the action happened. */
  actor: string;
  action: string;
  target: string;
  createdAtMs: number;
  /** Derived from `createdAtMs` for display. */
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
 *
 * Read and write are both moderator-only in `firestore.rules`, and the four
 * policy values are range/type checked there - the client's validation is
 * for good error copy, never for security.
 */
export interface AdminSettings {
  requireFacultyApproval: boolean;
  autoFlagSpamWords: boolean;
  allowedDomain: string;
  minRepToComment: number;
  updatedAtMs?: number;
  /** The admin who last saved the policy (`request.auth.uid` in rules). */
  updatedBy?: string;
  /** Derived from `updatedAtMs` for display. */
  updatedAt?: string;
}

/** A formal academic warning (`warnings/{warningId}`, moderator-issued). */
export interface Warning {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  issuedById: string;
  issuedByName: string;
  createdAtMs: number;
  /** Derived from `createdAtMs` for display. */
  issuedAt: string;
}
