import { Announcement, AuditLog, Report } from '../types';

export const mockReports: Report[] = [
  {
    id: 'rep-1',
    targetType: 'doubt',
    targetId: 'doubt-19',
    targetTitle: 'Commercial assignment solving request posted in doubt body',
    reporterId: 'user-2',
    reporterName: 'Priya Sundaram',
    reportedUserId: 'user-19',
    reportedUserName: 'Deepak SPAM',
    reason: 'Spam',
    description: 'User posted an external paid WhatsApp group link offering paid homework and assignment completion.',
    status: 'pending',
    createdAt: '3 hours ago'
  },
  {
    id: 'rep-2',
    targetType: 'answer',
    targetId: 'ans-gen-12',
    targetTitle: 'Inaccurate formula for capacitive reactance calculation',
    reporterId: 'user-10',
    reporterName: 'Vikram Aditya',
    reportedUserId: 'user-25',
    reportedUserName: 'Tarun Patel',
    reason: 'Wrong information',
    description: 'The formula written has an erroneous constant factor that will confuse students preparing for tomorrow’s mid-sem exam.',
    status: 'pending',
    createdAt: '1 day ago'
  },
  {
    id: 'rep-3',
    targetType: 'user',
    targetId: 'user-19',
    targetTitle: 'Profile containing spam promotional links',
    reporterId: 'user-1',
    reporterName: 'Rahul Sharma',
    reportedUserId: 'user-19',
    reportedUserName: 'Deepak SPAM',
    reason: 'Spam',
    description: 'Account was mass messaging 1st year students with unapproved course links.',
    status: 'resolved',
    createdAt: '3 days ago'
  },
  {
    id: 'rep-4',
    targetType: 'comment',
    targetId: 'c-gen-8',
    targetTitle: 'Aggressive comment under placement discussion',
    reporterId: 'user-11',
    reporterName: 'Ananya Iyer',
    reportedUserId: 'user-12',
    reportedUserName: 'Rohit Verma',
    reason: 'Inappropriate content',
    description: 'Dismissive behavior towards a junior asking a foundational question.',
    status: 'dismissed',
    createdAt: '1 week ago'
  }
];

export const mockAnnouncements: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Mid-Semester Examination Doubts Clearing Sprint',
    content: 'All departmental senior mentors and teaching assistants are requested to be active between 6 PM to 10 PM daily to help juniors with exam doubts in DSA, OS, and Digital Electronics.',
    priority: 'urgent',
    targetAudience: 'all',
    createdAt: 'Sep 25, 2026',
    authorName: 'Dr. Ramesh Kumar (HOD CSE)',
    isActive: true
  },
  {
    id: 'ann-2',
    title: 'Campus Hackathon 2025: Team Formation & Mentorship Matching',
    content: 'Smart India Hackathon campus round registrations close this Sunday. You can use the #Hackathons category to find teammates across CSE, ECE, and Mechanical departments.',
    priority: 'normal',
    targetAudience: 'students',
    createdAt: 'Sep 22, 2026',
    authorName: 'Campus Innovation Cell',
    isActive: true
  },
  {
    id: 'ann-3',
    title: 'Strict Academic Integrity Policy regarding Exam Dumps',
    content: 'Sharing proprietary copyrighted question papers or commercial assignment answers is strictly prohibited and results in immediate account suspension.',
    priority: 'low',
    targetAudience: 'all',
    createdAt: 'Sep 15, 2026',
    authorName: 'Academic Integrity Board',
    isActive: true
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    actor: 'Dr. Ramesh Kumar (Admin)',
    action: 'Approved student account',
    target: 'Ananya Iyer (1st Year CSE)',
    timestamp: '10 mins ago',
    type: 'user'
  },
  {
    id: 'log-2',
    actor: 'Dr. Ramesh Kumar (Admin)',
    action: 'Blocked spammer account',
    target: 'Deepak SPAM (user-19)',
    timestamp: '2 hours ago',
    type: 'moderation'
  },
  {
    id: 'log-3',
    actor: 'Rahul Sharma',
    action: 'Posted new doubt',
    target: 'Kalman Filter in robotics IMU sensor fusion',
    timestamp: '2 hours ago',
    type: 'doubt'
  },
  {
    id: 'log-4',
    actor: 'Priya Sundaram',
    action: 'Answered doubt',
    target: 'Kalman Filter state covariance derivation',
    timestamp: '1 hour ago',
    type: 'doubt'
  },
  {
    id: 'log-5',
    actor: 'Ananya Iyer',
    action: 'Accepted answer',
    target: 'C pointer 2D array memory allocation',
    timestamp: '4 hours ago',
    type: 'doubt'
  },
  {
    id: 'log-6',
    actor: 'Dr. Ramesh Kumar (Admin)',
    action: 'Created academic category',
    target: 'Cloud Computing & DevOps',
    timestamp: '1 day ago',
    type: 'system'
  },
  {
    id: 'log-7',
    actor: 'Priya Sundaram',
    action: 'Reported spam content',
    target: 'External paid assignment link in Doubt #19',
    timestamp: '1 day ago',
    type: 'moderation'
  },
  {
    id: 'log-8',
    actor: 'Dr. Ramesh Kumar (Admin)',
    action: 'Published campus announcement',
    target: 'Mid-Semester Doubts Clearing Sprint',
    timestamp: '2 days ago',
    type: 'system'
  }
];
