export interface PrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  about: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  onlineStatus: 'everyone' | 'contacts' | 'nobody';
}

export interface NotificationSettings {
  callAlerts: boolean;
  callRingtone: boolean;
  callVibration: boolean;
  messageAlerts: boolean;
  soundEffects: boolean;
  previewMessage: boolean;
  desktopPush: boolean;
  ringtoneType: 'modern' | 'classic' | 'gentle';
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  photoURL: string;
  about: string;
  isOnline: boolean;
  lastSeen: number;
  createdAt: number;
  isSuspended?: boolean;
  role?: 'user' | 'admin';
  phoneNumber?: string;
  privacySettings?: PrivacySettings;
  notificationSettings?: NotificationSettings;
  allowSearchByUsername?: boolean;
  savedContactIds?: string[];
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';

export interface MessageReply {
  id: string;
  text: string;
  senderName: string;
  type: MessageType;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: number;
  replyTo?: MessageReply;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  readBy?: string[];
  deliveredTo?: string[];
  deletedFor?: string[]; // userIds who deleted for me
  isDeletedForEveryone?: boolean;
  isEdited?: boolean;
  starredBy?: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
    accuracy?: number;
    isLive?: boolean;
    liveUntil?: number;
    liveEnded?: boolean;
    speed?: number;
  };
  contact?: {
    name: string;
    phone?: string;
    username?: string;
  };
  createdAt: number;
}

export interface PrivateChat {
  id: string;
  participants: string[];
  participantDetails: Record<string, {
    displayName: string;
    photoURL?: string;
    username: string;
  }>;
  isExclusiveRoom: boolean; // special 2-user lock room
  roomCode?: string;
  roomLocked?: boolean;
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: number;
    type: MessageType;
  };
  unreadCount?: Record<string, number>;
  pinnedBy?: string[];
  mutedBy?: string[];
  typing?: Record<string, boolean>;
  clearedBy?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface GroupChat {
  id: string;
  name: string;
  photoURL?: string;
  description?: string;
  createdBy: string;
  admins: string[];
  members: string[];
  inviteCode: string;
  adminOnlyMessages?: boolean;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    createdAt: number;
    type: MessageType;
  };
  unreadCount?: Record<string, number>;
  pinnedBy?: string[];
  mutedBy?: string[];
  typing?: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface StatusViewer {
  userId: string;
  displayName: string;
  photoURL?: string;
  viewedAt: number;
}

export interface StatusStory {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto?: string;
  type: 'text' | 'image' | 'video';
  content: string; // text body or media url / base64
  caption?: string;
  bgColor?: string;
  textColor?: string;
  viewers: StatusViewer[];
  privacy: 'everyone' | 'contacts' | 'selected';
  allowedUsers?: string[];
  createdAt: number;
}

export type CallType = 'voice' | 'video';
export type CallStatus = 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto?: string;
  type: CallType;
  status: CallStatus;
  offer?: any;
  answer?: any;
  callerIce?: any[];
  receiverIce?: any[];
  startedAt?: number;
  endedAt?: number;
  duration?: number;
  reaction?: { emoji: string; senderId: string; timestamp: number };
  isGroupCall?: boolean;
  groupId?: string;
  groupName?: string;
  participants?: string[];
  callLinkId?: string;
  audioMuted?: boolean;
  videoMuted?: boolean;
  createdAt: number;
}

export interface PrivateRoomInvite {
  id: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  receiverUsername: string;
  receiverName: string;
  receiverPhoto?: string;
  status: 'pending' | 'accepted' | 'declined';
  roomId?: string;
  createdAt: number;
}

export interface FollowRequest {
  id: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderPhoto?: string;
  senderPhoneNumber?: string;
  receiverId: string;
  receiverUsername: string;
  receiverName: string;
  receiverPhoto?: string;
  receiverPhoneNumber?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  updatedAt?: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'message' | 'group_invite' | 'call' | 'mention' | 'status_reply' | 'private_invite' | 'follow_request' | 'follow_accepted' | 'reaction';
  title: string;
  body: string;
  senderId: string;
  chatId?: string;
  inviteId?: string;
  requestId?: string;
  read: boolean;
  createdAt: number;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'message' | 'group' | 'status';
  targetId: string;
  targetName?: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'fake_account' | 'other';
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: number;
}

export interface GlobalAnnouncement {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  authorName: string;
  urgent?: boolean;
}
