import { Conversation, Message } from '../types';
import { mockUsers } from './mockUsers';

export const mockMessages: Message[] = [
  // Conversation 1: Rahul Sharma & Priya Sundaram
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-2', // Priya
    receiverId: 'user-1', // Rahul
    text: 'Hey Rahul! Saw your question on the Kalman Filter implementation for the line-follower robot.',
    timestamp: '10:15 AM',
    read: true
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'user-1', // Rahul
    receiverId: 'user-2', // Priya
    text: 'Yes Priya! The gyro bias was causing 4 degrees of drift every 30 seconds during motor turns.',
    timestamp: '10:18 AM',
    read: true
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    senderId: 'user-2',
    receiverId: 'user-1',
    text: 'I wrote a complete tested C++ snippet in my answer on the doubt thread. Did you tune the process noise Q?',
    timestamp: '10:20 AM',
    read: true
  },
  {
    id: 'msg-4',
    conversationId: 'conv-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    text: 'Just read it! The variance weighting analogy made it click. By the way, could you also share tips for the Texas Instruments hardware round?',
    timestamp: '10:24 AM',
    read: true
  },
  {
    id: 'msg-5',
    conversationId: 'conv-1',
    senderId: 'user-2',
    receiverId: 'user-1',
    text: 'Definitely! Focus on setup/hold times, ADC sampling frequencies, and RTOS priority inversion. Let us do a 15-minute mock discussion tomorrow in the IoT lab.',
    timestamp: '10:28 AM',
    read: true
  },
  {
    id: 'msg-6',
    conversationId: 'conv-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    text: 'Awesome, I will bring my STM32 board and oscilloscope readings. Thanks a lot Priya!',
    timestamp: '10:30 AM',
    read: true
  },

  // Conversation 2: Rahul Sharma & Karthik Raj
  {
    id: 'msg-7',
    conversationId: 'conv-2',
    senderId: 'user-5', // Karthik
    receiverId: 'user-1', // Rahul
    text: 'Bro, are you free this afternoon? Our Capstone Smart Grid telemetry node is dropping packets.',
    timestamp: 'Yesterday, 4:10 PM',
    read: true
  },
  {
    id: 'msg-8',
    conversationId: 'conv-2',
    senderId: 'user-1',
    receiverId: 'user-5',
    text: 'Is it the SPI mutex priority inversion we saw earlier or WiFi socket reconnects?',
    timestamp: 'Yesterday, 4:14 PM',
    read: true
  },
  {
    id: 'msg-9',
    conversationId: 'conv-2',
    senderId: 'user-5',
    receiverId: 'user-1',
    text: 'It looks like socket reconnect timeout is blocking the scheduler because it runs in the same task loop.',
    timestamp: 'Yesterday, 4:16 PM',
    read: true
  },
  {
    id: 'msg-10',
    conversationId: 'conv-2',
    senderId: 'user-1',
    receiverId: 'user-5',
    text: 'Separate them into two FreeRTOS queues: one high-priority sensor producer and one low-priority network consumer with exponential backoff!',
    timestamp: 'Yesterday, 4:20 PM',
    read: true
  },
  {
    id: 'msg-11',
    conversationId: 'conv-2',
    senderId: 'user-5',
    receiverId: 'user-1',
    text: 'Testing that right now in the lab. That solved the 150ms latency spike!',
    timestamp: 'Yesterday, 4:45 PM',
    read: true
  },

  // Conversation 3: Rahul Sharma & Dr. Ramesh Kumar (HOD)
  {
    id: 'msg-12',
    conversationId: 'conv-3',
    senderId: 'user-3', // Dr. Ramesh Kumar
    receiverId: 'user-1',
    text: 'Rahul, congratulations on your answer regarding LRU Belady Anomaly and stack algorithms. It showed solid foundational understanding.',
    timestamp: 'Sep 24, 2:00 PM',
    read: true
  },
  {
    id: 'msg-13',
    conversationId: 'conv-3',
    senderId: 'user-1',
    receiverId: 'user-3',
    text: 'Thank you Professor! Your Operating Systems lectures on inclusion properties helped me grasp the proof.',
    timestamp: 'Sep 24, 2:15 PM',
    read: true
  },
  {
    id: 'msg-14',
    conversationId: 'conv-3',
    senderId: 'user-3',
    receiverId: 'user-1',
    text: 'The department is opening 2 teaching assistant slots for 2nd year DSA next semester. Consider applying through the faculty portal.',
    timestamp: 'Sep 24, 2:20 PM',
    read: true
  },
  {
    id: 'msg-15',
    conversationId: 'conv-3',
    senderId: 'user-1',
    receiverId: 'user-3',
    text: 'I would be honored, sir. I will submit the TA application form by Friday.',
    timestamp: 'Sep 24, 2:25 PM',
    read: true
  },

  // Conversation 4: Rahul Sharma & Aishwarya Mohan
  {
    id: 'msg-16',
    conversationId: 'conv-4',
    senderId: 'user-15', // Aishwarya
    receiverId: 'user-1',
    text: 'Hey Rahul! I saw your GitHub repo for the distributed key-value store. Very clean Raft consensus implementation.',
    timestamp: 'Sep 22, 6:00 PM',
    read: true
  },
  {
    id: 'msg-17',
    conversationId: 'conv-4',
    senderId: 'user-1',
    receiverId: 'user-15',
    text: 'Hi Aishwarya! Thank you! I spent last summer reading the Ongaro paper and implementing log replication in Go.',
    timestamp: 'Sep 22, 6:05 PM',
    read: true
  },
  {
    id: 'msg-18',
    conversationId: 'conv-4',
    senderId: 'user-15',
    receiverId: 'user-1',
    text: 'That is great engineering. When Amazon SDE-1 off-campus referral window opens in October, send me your updated resume.',
    timestamp: 'Sep 22, 6:10 PM',
    read: true
  },
  {
    id: 'msg-19',
    conversationId: 'conv-4',
    senderId: 'user-1',
    receiverId: 'user-15',
    text: 'That would be huge for me! Should I highlight competitive programming or system design projects more?',
    timestamp: 'Sep 22, 6:12 PM',
    read: true
  },
  {
    id: 'msg-20',
    conversationId: 'conv-4',
    senderId: 'user-15',
    receiverId: 'user-1',
    text: 'Lead with the Raft KV store and highlight your LeetCode problem solving under technical skills. Keep it strictly 1 page.',
    timestamp: 'Sep 22, 6:15 PM',
    read: true
  },
  {
    id: 'msg-21',
    conversationId: 'conv-4',
    senderId: 'user-1',
    receiverId: 'user-15',
    text: 'Will do! Thanks a ton for the guidance Aishwarya!',
    timestamp: 'Sep 22, 6:18 PM',
    read: true
  }
];

export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    participant: mockUsers[1], // Priya Sundaram
    lastMessage: mockMessages[5],
    unreadCount: 0
  },
  {
    id: 'conv-2',
    participant: mockUsers[4], // Karthik Raj
    lastMessage: mockMessages[10],
    unreadCount: 0
  },
  {
    id: 'conv-3',
    participant: mockUsers[2], // Dr. Ramesh Kumar
    lastMessage: mockMessages[14],
    unreadCount: 0
  },
  {
    id: 'conv-4',
    participant: mockUsers[14], // Aishwarya Mohan
    lastMessage: mockMessages[20],
    unreadCount: 0
  }
];
