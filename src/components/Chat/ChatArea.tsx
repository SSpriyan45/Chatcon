import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCall } from '../../context/CallContext';
import { useFollow } from '../../context/FollowContext';
import { soundManager } from '../../utils/sound';
import { processMediaFile, AudioRecorder } from '../../utils/media';
import { formatLastSeen } from '../../utils/formatters';
import { formatPhoneForCall } from '../../utils/phone';
import { ChatMessage, PrivateChat, GroupChat, UserProfile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { GroupInfoDrawer } from '../Groups/GroupInfoDrawer';
import { LocationShareModal } from '../Modals/LocationShareModal';
import { GroupCallModal } from '../Calls/GroupCallModal';
import { CallLinkModal } from '../Calls/CallLinkModal';
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  Video,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  Lock,
  Users,
  Image,
  FileText,
  MapPin,
  User,
  UserPlus,
  UserMinus,
  Check,
  Copy,
  Clock,
  X,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  StopCircle,
  Flag,
  AlertCircle
} from 'lucide-react';

interface ChatAreaProps {
  chatId: string;
  chatType: 'private' | 'group';
}

export const ChatArea: React.FC<ChatAreaProps> = ({ chatId, chatType }) => {
  const { currentUser, profile, blockUser, unblockUser, blockedUserIds } = useAuth();
  const { closeChat, openReportModal, setIsLocationModalOpen } = useUI();
  const { startCall } = useCall();
  const {
    isFriend,
    getFollowStatus,
    getFriendPhoneNumber,
    sendFollowRequest,
    cancelFollowRequest,
    acceptFollowRequest,
    incomingRequests,
    unfollow
  } = useFollow();

  const [chatData, setChatData] = useState<PrivateChat | GroupChat | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isGroupCallModalOpen, setIsGroupCallModalOpen] = useState(false);
  const [isChatCallLinkOpen, setIsChatCallLinkOpen] = useState(false);

  // Phone number and contact details states
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showContactDetailsModal, setShowContactDetailsModal] = useState(false);

  // Media upload & compression states
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to Chat Document
  useEffect(() => {
    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    let partnerUnsub: (() => void) | null = null;

    const unsub = onSnapshot(doc(db, collName, chatId), (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as PrivateChat | GroupChat;
        setChatData(data);

        // If private chat, subscribe to partner profile and real-time presence
        if (chatType === 'private' && currentUser) {
          const priv = data as PrivateChat;
          const otherUid = priv.participants?.find((uid) => uid !== currentUser.uid);
          if (otherUid && !partnerUnsub) {
            partnerUnsub = onSnapshot(doc(db, 'users', otherUid), (userSnap) => {
              if (userSnap.exists()) {
                setPartnerProfile(userSnap.data() as UserProfile);
              }
            }, (err) => console.warn('Partner profile snapshot error:', err));
          }
        }
      }
    }, (error) => {
      console.warn('Chat document listener notice:', error.message);
    });

    return () => {
      unsub();
      if (partnerUnsub) partnerUnsub();
    };
  }, [chatId, chatType, currentUser]);

  // Cleanup typing status when leaving or switching chats
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (currentUser && chatId) {
        const collName = chatType === 'private' ? 'privateChats' : 'groups';
        updateDoc(doc(db, collName, chatId), {
          [`typing.${currentUser.uid}`]: false,
        }).catch(() => {});
      }
    };
  }, [chatId, chatType, currentUser]);

  // Subscribe to Messages Subcollection
  useEffect(() => {
    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    const q = query(
      collection(db, collName, chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) });
      });
      setMessages(msgs);

      // Auto mark unread as read
      if (currentUser) {
        snapshot.docs.forEach(async (d) => {
          const msg = d.data() as ChatMessage;
          if (msg.senderId !== currentUser.uid && (!msg.readBy || !msg.readBy.includes(currentUser.uid))) {
            const currentReadBy = msg.readBy || [];
            await updateDoc(doc(db, collName, chatId, 'messages', d.id), {
              readBy: [...currentReadBy, currentUser.uid],
            }).catch(() => {});
          }
        });
      }
    }, (error) => {
      console.warn('Messages listener notice:', error.message);
    });

    return () => unsub();
  }, [chatId, chatType, currentUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Handle Typing status broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (!currentUser) return;

    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    const chatRef = doc(db, collName, chatId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!val.trim()) {
      // Input is cleared, immediately broadcast typing: false
      updateDoc(chatRef, {
        [`typing.${currentUser.uid}`]: false,
      }).catch(() => {});
      return;
    }

    // Set typing: true
    updateDoc(chatRef, {
      [`typing.${currentUser.uid}`]: true,
    }).catch(() => {});

    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(chatRef, {
        [`typing.${currentUser.uid}`]: false,
      }).catch(() => {});
      typingTimeoutRef.current = null;
    }, 2500);
  };

  const sendNotificationToRecipients = (bodyText: string) => {
    if (!currentUser || !profile) return;
    const senderName = profile.displayName || profile.username;

    if (chatType === 'private') {
      const privateDoc = chatData as PrivateChat;
      const otherUid = privateDoc?.participants?.find((p) => p !== currentUser.uid);
      if (otherUid) {
        addDoc(collection(db, 'notifications'), {
          userId: otherUid,
          type: 'message',
          title: senderName,
          body: bodyText,
          senderId: currentUser.uid,
          chatId,
          read: false,
          createdAt: Date.now(),
        }).catch((e) => console.warn('Notification notice:', e));
      }
    } else if (chatType === 'group') {
      const groupDoc = chatData as GroupChat;
      const members = groupDoc?.members || [];
      members.forEach((memberUid) => {
        if (memberUid !== currentUser.uid) {
          addDoc(collection(db, 'notifications'), {
            userId: memberUid,
            type: 'message',
            title: `${senderName} in ${groupDoc.name || 'Group'}`,
            body: bodyText,
            senderId: currentUser.uid,
            chatId,
            read: false,
            createdAt: Date.now(),
          }).catch((e) => console.warn('Notification notice:', e));
        }
      });
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser || !profile) return;

    const text = inputText.trim();
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const collName = chatType === 'private' ? 'privateChats' : 'groups';

    if (editingMessage) {
      // Edit existing message
      await updateDoc(doc(db, collName, chatId, 'messages', editingMessage.id), {
        text,
        isEdited: true,
      });
      setEditingMessage(null);
      return;
    }

    try {
      const messageData: Partial<ChatMessage> = {
        senderId: currentUser.uid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        text,
        type: 'text',
        createdAt: Date.now(),
        readBy: [currentUser.uid],
        deliveredTo: [currentUser.uid],
        starredBy: [],
        deletedFor: [],
        isDeletedForEveryone: false,
      };

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
          type: replyingTo.type,
        };
        setReplyingTo(null);
      }

      await addDoc(collection(db, collName, chatId, 'messages'), messageData);
      soundManager.playSent();

      // Trigger real-time notifications for the other participant(s)
      sendNotificationToRecipients(text);

      // Update parent chat doc (with merge: true to guarantee existence)
      await setDoc(
        doc(db, collName, chatId),
        {
          lastMessage: {
            text,
            senderId: currentUser.uid,
            senderName: profile.displayName || profile.username,
            createdAt: Date.now(),
            type: 'text',
          },
          updatedAt: Date.now(),
          [`typing.${currentUser.uid}`]: false,
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Attachments handlers with client-side compression and validation
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !profile) return;

    // Reset input value so the same file can be selected again
    e.target.value = '';

    setIsUploadingMedia(true);
    setUploadError(null);
    setUploadStatusText(
      type === 'image'
        ? 'Compressing & optimizing image...'
        : type === 'video'
        ? 'Verifying video size...'
        : 'Preparing document...'
    );

    try {
      const processed = await processMediaFile(file, type);
      const collName = chatType === 'private' ? 'privateChats' : 'groups';

      setUploadStatusText('Sending message...');

      const messageData: Partial<ChatMessage> = {
        senderId: currentUser.uid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        text: '',
        type: processed.type,
        mediaUrl: processed.dataUrl,
        fileName: processed.fileName,
        fileSize: processed.fileSizeStr,
        createdAt: Date.now(),
        readBy: [currentUser.uid],
        deliveredTo: [currentUser.uid],
        starredBy: [],
        deletedFor: [],
      };

      await addDoc(collection(db, collName, chatId, 'messages'), messageData);
      soundManager.playSent();
      setShowAttachMenu(false);

      sendNotificationToRecipients(`[${processed.type.toUpperCase()}] ${processed.fileName}`);

      await setDoc(
        doc(db, collName, chatId),
        {
          lastMessage: {
            text: `[${processed.type.toUpperCase()}] ${processed.fileName}`,
            senderId: currentUser.uid,
            senderName: profile.displayName || profile.username,
            createdAt: Date.now(),
            type: processed.type,
          },
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.error('Media upload error:', err);
      const msg = err?.message || 'Failed to upload media. Please try again.';
      setUploadError(msg);
      setTimeout(() => setUploadError(null), 6000);
    } finally {
      setIsUploadingMedia(false);
      setUploadStatusText('');
    }
  };

  // Audio Voice Note Recording
  const startRecording = async () => {
    try {
      const recorder = new AudioRecorder();
      await recorder.start();
      audioRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingDuration((p) => {
          // Auto-stop at 60 seconds
          if (p >= 60) {
            stopAndSendRecording();
            return 60;
          }
          return p + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Audio recorder error:', err);
    }
  };

  const stopAndSendRecording = async () => {
    if (!audioRecorderRef.current || !currentUser || !profile) return;
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);

    try {
      const result = await audioRecorderRef.current.stop();
      setIsRecording(false);
      audioRecorderRef.current = null;

      const collName = chatType === 'private' ? 'privateChats' : 'groups';
      const messageData: Partial<ChatMessage> = {
        senderId: currentUser.uid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        text: '',
        type: 'audio',
        mediaUrl: result.dataUrl,
        duration: result.duration,
        createdAt: Date.now(),
        readBy: [currentUser.uid],
        deliveredTo: [currentUser.uid],
        starredBy: [],
        deletedFor: [],
      };

      await addDoc(collection(db, collName, chatId, 'messages'), messageData);
      soundManager.playSent();

      sendNotificationToRecipients(`🎤 Voice note (${result.duration}s)`);

      await setDoc(
        doc(db, collName, chatId),
        {
          lastMessage: {
            text: `🎤 Voice note (${result.duration}s)`,
            senderId: currentUser.uid,
            senderName: profile.displayName || profile.username,
            createdAt: Date.now(),
            type: 'audio',
          },
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Stop audio recording error:', err);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel();
      audioRecorderRef.current = null;
    }
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  // Location share - opens WhatsApp-style location picker
  const handleShareLocation = () => {
    setShowAttachMenu(false);
    setIsLocationModalOpen(true);
  };

  // Contact share
  const handleShareContact = async () => {
    if (!currentUser || !profile) return;
    setShowAttachMenu(false);
    const collName = chatType === 'private' ? 'privateChats' : 'groups';

    const messageData: Partial<ChatMessage> = {
      senderId: currentUser.uid,
      senderName: profile.displayName || profile.username,
      senderPhoto: profile.photoURL,
      text: '👤 Contact Card',
      type: 'contact',
      contact: {
        name: profile.displayName || profile.username,
        username: profile.username,
      },
      createdAt: Date.now(),
      readBy: [currentUser.uid],
      deliveredTo: [currentUser.uid],
    };

    await addDoc(collection(db, collName, chatId, 'messages'), messageData);
    soundManager.playSent();
  };

  // Message Actions
  const handleReact = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    const msgRef = doc(db, collName, chatId, 'messages', messageId);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    soundManager.playReact();

    const reactions = { ...(msg.reactions || {}) };
    const currentUsers = reactions[emoji] || [];
    const isRemoving = currentUsers.includes(currentUser.uid);

    if (isRemoving) {
      // Toggle off
      reactions[emoji] = currentUsers.filter((u) => u !== currentUser.uid);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...currentUsers, currentUser.uid];
    }

    // Optimistic UI update for instantaneous reaction response
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
    );

    try {
      await updateDoc(msgRef, { reactions });

      // Notify the original message sender if reacted by someone else
      if (!isRemoving && msg.senderId !== currentUser.uid && profile) {
        const senderName = profile.displayName || profile.username;
        addDoc(collection(db, 'notifications'), {
          userId: msg.senderId,
          type: 'reaction',
          title: `${senderName} reacted ${emoji}`,
          body: msg.text ? (msg.text.length > 50 ? `${msg.text.slice(0, 50)}...` : msg.text) : `Reacted to your message`,
          senderId: currentUser.uid,
          chatId,
          read: false,
          createdAt: Date.now(),
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to update reaction:', err);
    }
  };

  const handleStar = async (messageId: string) => {
    if (!currentUser) return;
    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    const msgRef = doc(db, collName, chatId, 'messages', messageId);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const starredBy = msg.starredBy || [];
    const newStarred = starredBy.includes(currentUser.uid)
      ? starredBy.filter((u) => u !== currentUser.uid)
      : [...starredBy, currentUser.uid];

    await updateDoc(msgRef, { starredBy: newStarred });
  };

  const handleDeleteForMe = async (messageId: string) => {
    if (!currentUser) return;
    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    const msgRef = doc(db, collName, chatId, 'messages', messageId);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const deletedFor = msg.deletedFor || [];
    await updateDoc(msgRef, {
      deletedFor: [...deletedFor, currentUser.uid],
    });
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    const collName = chatType === 'private' ? 'privateChats' : 'groups';
    const msgRef = doc(db, collName, chatId, 'messages', messageId);
    await updateDoc(msgRef, {
      isDeletedForEveryone: true,
      text: '',
      mediaUrl: '',
    });
  };

  const handleClearForMe = async () => {
    if (!currentUser) return;
    setIsClearing(true);
    const collName = chatType === 'private' ? 'privateChats' : 'groups';

    try {
      const promises = messages.map(async (msg) => {
        const deletedFor = msg.deletedFor || [];
        if (!deletedFor.includes(currentUser.uid)) {
          return updateDoc(doc(db, collName, chatId, 'messages', msg.id), {
            deletedFor: [...deletedFor, currentUser.uid],
          });
        }
      });
      await Promise.all(promises);
      setShowClearModal(false);
      setShowMoreMenu(false);
    } catch (err) {
      console.error('Failed to clear messages for me:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearForEveryone = async () => {
    if (!currentUser) return;
    setIsClearing(true);
    const collName = chatType === 'private' ? 'privateChats' : 'groups';

    try {
      const snap = await getDocs(collection(db, collName, chatId, 'messages'));
      const batch = writeBatch(db);
      snap.forEach((m) => batch.delete(m.ref));
      await batch.commit();

      await updateDoc(doc(db, collName, chatId), {
        lastMessage: {
          text: 'Chat history cleared',
          senderId: 'system',
          senderName: 'System',
          createdAt: Date.now(),
          type: 'text',
        },
        updatedAt: Date.now(),
      });

      setShowClearModal(false);
      setShowMoreMenu(false);
    } catch (err) {
      console.error('Failed to clear messages for everyone:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Header Title & Subtitle
  const isExclusive = chatType === 'private' && (chatData as PrivateChat)?.isExclusiveRoom;
  const isGroup = chatType === 'group';
  const group = isGroup ? (chatData as GroupChat) : null;

  const headerTitle = isGroup
    ? group?.name || 'Group Chat'
    : partnerProfile?.displayName || 'Chat';

  const isPartnerBlocked = partnerProfile ? blockedUserIds.includes(partnerProfile.uid) : false;
  const isPartnerFriend = partnerProfile ? isFriend(partnerProfile.uid) : false;
  const partnerFollowStatus = partnerProfile ? getFollowStatus(partnerProfile.uid) : 'none';
  const partnerPhone = partnerProfile ? getFriendPhoneNumber(partnerProfile.uid, partnerProfile) : null;
  const incomingReqFromPartner = partnerProfile
    ? incomingRequests.find((r) => r.senderId === partnerProfile.uid)
    : null;

  // Filter messages by search
  const displayedMessages = searchQuery.trim()
    ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // User name map for reactions tooltips and detail modal
  const userNameMap: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (currentUser) {
      map[currentUser.uid] = 'You';
    }
    if (partnerProfile) {
      map[partnerProfile.uid] = partnerProfile.displayName || partnerProfile.username;
    }
    messages.forEach((m) => {
      if (m.senderId && m.senderName && !map[m.senderId]) {
        map[m.senderId] = m.senderName;
      }
    });
    return map;
  }, [currentUser, partnerProfile, messages]);

  // Check if other participant is typing in private chat
  const otherParticipantUid = chatType === 'private'
    ? (chatData as PrivateChat)?.participants?.find((uid) => uid !== currentUser?.uid) || partnerProfile?.uid
    : null;

  const isOtherUserTyping = !isGroup && Boolean(
    (otherParticipantUid && chatData?.typing?.[otherParticipantUid]) ||
    (partnerProfile && chatData?.typing?.[partnerProfile.uid])
  );

  // Check if anyone else is typing in group chat
  const groupTypingUserIds = isGroup && chatData?.typing
    ? Object.entries(chatData.typing)
        .filter(([uid, isTyping]) => uid !== currentUser?.uid && isTyping)
        .map(([uid]) => uid)
    : [];

  const typingUserIds = isGroup
    ? groupTypingUserIds
    : isOtherUserTyping && otherParticipantUid
    ? [otherParticipantUid]
    : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 relative overflow-hidden">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => handleMediaUpload(e, 'image')}
        className="hidden"
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip"
        onChange={(e) => handleMediaUpload(e, 'document')}
        className="hidden"
      />

      {/* Top Header */}
      <div className="h-16 px-4 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={closeChat}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 md:hidden transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div
            onClick={() => isGroup ? setShowGroupDrawer(true) : setShowContactDetailsModal(true)}
            className="relative cursor-pointer hover:opacity-90 transition-opacity"
            title="View Details & Phone Number"
          >
            <img
              src={
                isGroup
                  ? group?.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${group?.name}`
                  : partnerProfile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${headerTitle}`
              }
              alt={headerTitle}
              className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 object-cover"
            />
            {!isGroup && partnerProfile?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyan-400 border-2 border-neutral-900 rounded-full" />
            )}
          </div>

          {/* Title & Status */}
          <div
            onClick={() => isGroup ? setShowGroupDrawer(true) : setShowContactDetailsModal(true)}
            className="truncate cursor-pointer hover:opacity-90 transition-opacity"
            title="View Details & Phone Number"
          >
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs">
                {headerTitle}
              </h3>
              {isExclusive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-semibold border border-cyan-500/30">
                  <Lock className="w-2.5 h-2.5" /> 2-User Locked
                </span>
              )}
              {!isGroup && isPartnerFriend && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" /> Friends
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 truncate min-h-[16px] flex items-center">
              {!isGroup && isOtherUserTyping ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium tracking-wide animate-in fade-in duration-200">
                  <span>typing</span>
                  <span className="inline-flex items-center gap-0.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </span>
              ) : isGroup && groupTypingUserIds.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium tracking-wide animate-in fade-in duration-200">
                  <span>typing</span>
                  <span className="inline-flex items-center gap-0.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </span>
              ) : isGroup ? (
                `${group?.members.length || 0} participants`
              ) : partnerProfile ? (
                <span className={partnerProfile.isOnline ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
                  {formatLastSeen(partnerProfile.lastSeen, partnerProfile.isOnline)}
                </span>
              ) : (
                'connecting...'
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {!isGroup && partnerProfile && (
            <>
              <button
                type="button"
                onClick={() =>
                  startCall(
                    partnerProfile.uid,
                    partnerProfile.displayName || partnerProfile.username,
                    partnerProfile.photoURL,
                    'voice'
                  )
                }
                className="p-2 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-[#202c33] transition-colors"
                title="Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  startCall(
                    partnerProfile.uid,
                    partnerProfile.displayName || partnerProfile.username,
                    partnerProfile.photoURL,
                    'video'
                  )
                }
                className="p-2 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-[#202c33] transition-colors"
                title="Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          {isGroup && group && (
            <>
              <button
                type="button"
                onClick={() => setIsGroupCallModalOpen(true)}
                className="p-2 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-[#202c33] transition-colors"
                title="Group Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsGroupCallModalOpen(true)}
                className="p-2 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-[#202c33] transition-colors"
                title="Group Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            className={`p-2 rounded-xl transition-colors ${
              searchOpen ? 'bg-red-600/20 text-red-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Search Messages"
          >
            <Search className="w-5 h-5" />
          </button>

          {isGroup && (
            <button
              type="button"
              onClick={() => setShowGroupDrawer(true)}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Group Info"
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* More Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((p) => !p)}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-12 w-48 bg-neutral-900 border border-neutral-700 rounded-2xl p-1.5 shadow-2xl z-50 text-xs">
                {isGroup && (
                  <button
                    onClick={() => { setShowGroupDrawer(true); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-800 rounded-lg text-neutral-200 text-left"
                  >
                    <Users className="w-4 h-4 text-red-400" /> Group info
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowClearModal(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-800 rounded-lg text-neutral-200 text-left"
                >
                  <Trash2 className="w-4 h-4 text-amber-400" /> Clear chat
                </button>

                {!isGroup && partnerProfile && (
                  <button
                    onClick={() => {
                      if (isPartnerBlocked) {
                        unblockUser(partnerProfile.uid);
                      } else {
                        blockUser(partnerProfile.uid);
                      }
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-800 rounded-lg text-red-300 text-left"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    {isPartnerBlocked ? 'Unblock user' : 'Block user'}
                  </button>
                )}

                <button
                  onClick={() => {
                    openReportModal(
                      isGroup ? 'group' : 'user',
                      isGroup ? chatId : partnerProfile?.uid || chatId,
                      headerTitle
                    );
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-800 rounded-lg text-neutral-400 text-left border-t border-neutral-800 mt-1 pt-1"
                >
                  <Flag className="w-4 h-4 text-neutral-400" /> Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PHONE NUMBER SECTION: Compulsory & Displayed for all users */}
      {!isGroup && partnerProfile && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-neutral-900/95 via-neutral-950 to-neutral-900/95 border-b border-neutral-800 flex items-center justify-between gap-3 text-xs shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>

            <div className="truncate">
              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-cyan-400">
                  Phone Number
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Public
                </span>
              </div>

              <div className="font-mono text-white text-xs font-semibold truncate mt-0.5 flex items-center gap-2">
                <span>{partnerProfile.phoneNumber || partnerPhone || 'No phone set'}</span>
              </div>
            </div>
          </div>

          {/* Direct Phone Actions & Follow connection */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(partnerProfile.phoneNumber || partnerPhone) && (
              <>
                <button
                  onClick={() => {
                    const num = partnerProfile.phoneNumber || partnerPhone || '';
                    navigator.clipboard.writeText(num);
                    setCopiedPhone(true);
                    setTimeout(() => setCopiedPhone(false), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Copy Phone Number"
                >
                  {copiedPhone ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{copiedPhone ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={`tel:${formatPhoneForCall(partnerProfile.phoneNumber || partnerPhone)}`}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                  title="Direct Phone Call"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Call</span>
                </a>
              </>
            )}

            {!isPartnerFriend && (
              partnerFollowStatus === 'pending_sent' ? (
                <button
                  onClick={() => cancelFollowRequest(partnerProfile.uid)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Cancel Follow Request"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Requested</span>
                </button>
              ) : partnerFollowStatus === 'pending_received' ? (
                <button
                  onClick={async () => {
                    if (incomingReqFromPartner) {
                      await acceptFollowRequest(incomingReqFromPartner);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                  title="Confirm Request"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Confirm</span>
                </button>
              ) : (
                <button
                  onClick={() => sendFollowRequest(partnerProfile)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-neutral-700 text-xs font-medium flex items-center gap-1 transition-all"
                  title="Follow user"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Follow</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* In-chat search bar */}
      {searchOpen && (
        <div className="px-4 py-2 bg-neutral-900/95 border-b border-neutral-800 flex items-center gap-2 animate-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversation..."
            className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {/* Security badge at start */}
        <div className="flex justify-center my-3">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-[11px] text-neutral-400 text-center max-w-sm flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              {isExclusive
                ? 'Strict 2-User Private Room. Messages are visible exclusively to verified participants.'
                : 'Messages and calls in Chatcon are encrypted and secured.'}
            </span>
          </div>
        </div>

        {displayedMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMe={msg.senderId === currentUser?.uid}
            onReply={(m) => setReplyingTo(m)}
            onReact={handleReact}
            onStar={handleStar}
            onEdit={(m) => {
              setEditingMessage(m);
              setInputText(m.text || '');
            }}
            onDeleteForMe={handleDeleteForMe}
            onDeleteForEveryone={handleDeleteForEveryone}
            onReport={(m) => openReportModal('message', m.id, m.text)}
            currentUserId={currentUser?.uid || ''}
            userNameMap={userNameMap}
          />
        ))}

        {/* Typing Indicator */}
        {((!isGroup && isOtherUserTyping) || (isGroup && groupTypingUserIds.length > 0)) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/90 rounded-2xl border border-neutral-800/80 w-fit shadow-md animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">
              {!isGroup
                ? `${partnerProfile?.displayName || 'Contact'} is typing...`
                : 'Someone is typing...'}
            </span>
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400/90 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-emerald-400/90 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-emerald-400/90 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Quote Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="border-l-4 border-red-500 pl-2">
            <span className="font-semibold text-red-400 block">
              Replying to {replyingTo.senderName}
            </span>
            <span className="text-neutral-400 truncate max-w-sm block">
              {replyingTo.text || `[${replyingTo.type}]`}
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingMessage && (
        <div className="px-4 py-2 bg-amber-950/40 border-t border-amber-800/40 flex items-center justify-between text-xs">
          <span className="text-amber-300 font-medium">Editing message...</span>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText('');
            }}
            className="text-neutral-400 hover:text-white text-xs underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="absolute bottom-20 left-4 z-40 bg-neutral-900 border border-neutral-700/80 rounded-2xl p-2 shadow-2xl grid grid-cols-4 gap-2 text-center animate-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Image className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-neutral-300">Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-neutral-300">Document</span>
          </button>

          <button
            type="button"
            onClick={handleShareLocation}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-neutral-800 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform flex items-center justify-center border border-emerald-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-neutral-300">Location</span>
          </button>

          <button
            type="button"
            onClick={handleShareContact}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-neutral-300">Contact</span>
          </button>
        </div>
      )}

      {/* Upload Progress Banner */}
      {isUploadingMedia && (
        <div className="px-4 py-2 bg-red-950/80 border-t border-red-800/40 flex items-center gap-2.5 text-xs text-red-300 animate-in slide-in-from-bottom-1">
          <div className="w-3.5 h-3.5 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin shrink-0" />
          <span className="font-medium">{uploadStatusText || 'Processing media attachment...'}</span>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-950/80 border-t border-red-800/50 flex items-center justify-between text-xs text-red-300 animate-in slide-in-from-bottom-1">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-white p-0.5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-neutral-900/90 border-t border-neutral-800 backdrop-blur-md z-20 shrink-0">
        {isPartnerBlocked ? (
          <div className="py-2 text-center text-xs text-red-400 font-medium">
            You blocked this contact. Unblock to send messages.
          </div>
        ) : isGroup && group?.adminOnlyMessages && !group.admins.includes(currentUser?.uid || '') ? (
          <div className="py-2 text-center text-xs text-neutral-400 font-medium flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Only admins can send messages in this group.
          </div>
        ) : isRecording ? (
          <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-950 rounded-2xl border border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-mono text-red-400">
                Recording... {recordingDuration}s
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={cancelRecording}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Attach File"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative flex items-center bg-neutral-950 border border-neutral-800 rounded-2xl px-3.5 py-2">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>

            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center transition-colors"
                title="Record Voice Note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Group Info Drawer */}
      {showGroupDrawer && group && (
        <GroupInfoDrawer
          group={group}
          onClose={() => setShowGroupDrawer(false)}
          onLeave={() => {
            setShowGroupDrawer(false);
            closeChat();
          }}
        />
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowClearModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">Clear Chat History</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              Choose how you want to clear messages in this conversation.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleClearForMe}
                disabled={isClearing}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold text-xs transition-colors flex items-center justify-between disabled:opacity-50"
              >
                <span>Clear for Me</span>
                <span className="text-[10px] text-neutral-400">Keep for other</span>
              </button>

              <button
                onClick={handleClearForEveryone}
                disabled={isClearing}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-semibold text-xs transition-colors flex items-center justify-between disabled:opacity-50"
              >
                <span>Clear for Everyone</span>
                <span className="text-[10px] opacity-80">Permanent purge</span>
              </button>

              <button
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-neutral-800 text-neutral-400 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Style Location Share Modal */}
      <LocationShareModal chatId={chatId} chatType={chatType} />

      {/* WhatsApp-Style Group Call Modal */}
      {isGroup && group && (
        <GroupCallModal
          isOpen={isGroupCallModalOpen}
          groupId={group.id}
          groupName={group.name}
          memberIds={group.members || []}
          onClose={() => setIsGroupCallModalOpen(false)}
          onOpenCallLink={() => setIsChatCallLinkOpen(true)}
        />
      )}

      {/* Call Link Modal */}
      <CallLinkModal
        isOpen={isChatCallLinkOpen}
        onClose={() => setIsChatCallLinkOpen(false)}
        onSendInChat={(linkText) => {
          setInputText((prev) => (prev ? `${prev}\n${linkText}` : linkText));
        }}
      />
    </div>
  );
};
