import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useNotifications } from '../../context/NotificationContext';
import { useFollow } from '../../context/FollowContext';
import { PWAInstallButton } from '../PWA/PWAInstallButton';
import { AppLogo } from '../Common/AppLogo';
import { formatChatListTime, formatLastSeen } from '../../utils/formatters';
import { formatPhoneForCall } from '../../utils/phone';
import { soundManager } from '../../utils/sound';
import { PrivateChat, GroupChat, UserProfile } from '../../types';
import {
  Search,
  Lock,
  Users,
  MessageSquarePlus,
  ShieldCheck,
  Pin,
  BellOff,
  UserPlus,
  UserCheck,
  MessageSquare,
  Sparkles,
  Check,
  X,
  Phone,
  PhoneCall,
  Copy,
  Video,
  Clock,
  Circle,
  Trash2,
  MoreVertical,
  Eraser,
  Bell
} from 'lucide-react';

interface CombinedChat {
  id: string;
  type: 'private' | 'group';
  title: string;
  photoURL?: string;
  lastMessage?: string;
  timestamp: number;
  unread: number;
  isPinned: boolean;
  isMuted: boolean;
  isExclusive: boolean;
  isOnline?: boolean;
  isTyping?: boolean;
}

export const ChatListScreen: React.FC = () => {
  const { currentUser, profile, blockedUserIds, toggleContact } = useAuth();
  const {
    openChat,
    closeChat,
    selectedChatId,
    setIsPrivateRoomModalOpen,
    setIsNewChatModalOpen,
    setIsNewGroupModalOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
  } = useUI();
  const { unreadCount } = useNotifications();
  const {
    incomingRequests,
    pendingCount,
    acceptFollowRequest,
    declineFollowRequest,
    getFollowStatus,
    isFriend,
    getFriendPhoneNumber,
    sendFollowRequest,
    cancelFollowRequest
  } = useFollow();

  const [chats, setChats] = useState<CombinedChat[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'requests' | 'contacts' | 'private_rooms' | 'groups'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeChatMenuId, setActiveChatMenuId] = useState<string | null>(null);
  const [copiedPhoneUid, setCopiedPhoneUid] = useState<string | null>(null);
  const [followPromptModal, setFollowPromptModal] = useState<{
    user: UserProfile;
    status: 'none' | 'pending_sent';
  } | null>(null);

  // User search results state
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [savedContactUsers, setSavedContactUsers] = useState<UserProfile[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchTab, setSearchTab] = useState<'users' | 'conversations'>('users');
  const [sentInvites, setSentInvites] = useState<Record<string, boolean>>({});

  // In-app modal for clearing and deleting chats (eliminates window.confirm)
  const [chatActionModal, setChatActionModal] = useState<{
    isOpen: boolean;
    type: 'clear' | 'delete';
    chat: CombinedChat;
  } | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Subscribe to user's chats
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    let privateList: CombinedChat[] = [];
    let groupList: CombinedChat[] = [];

    // Query private chats where current user is participant
    const privQ = query(
      collection(db, 'privateChats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubPriv = onSnapshot(privQ, (snap) => {
      privateList = snap.docs.map((docSnap) => {
        const data = docSnap.data() as PrivateChat;
        const otherUid = data.participants?.find((uid) => uid !== currentUser.uid);
        const details = otherUid && data.participantDetails ? data.participantDetails[otherUid] : null;

        const title = details?.displayName || (data.isExclusiveRoom ? 'Private Room' : 'Direct Message');
        const photoURL = details?.photoURL;
        const unread = data.unreadCount?.[currentUser.uid] || 0;
        const isPinned = data.pinnedBy?.includes(currentUser.uid) || false;
        const isMuted = data.mutedBy?.includes(currentUser.uid) || false;
        const isTyping = Boolean(otherUid && data.typing?.[otherUid]);

        return {
          id: docSnap.id,
          type: 'private' as const,
          title,
          photoURL,
          lastMessage: data.lastMessage?.text || (data.isExclusiveRoom ? 'Exclusive Room Created' : 'No messages yet'),
          timestamp: data.updatedAt || data.createdAt || 0,
          unread,
          isPinned,
          isMuted,
          isExclusive: !!data.isExclusiveRoom,
          isTyping,
        };
      });
      combine();
    }, (error) => {
      console.warn('Private chats listener notice:', error.message);
    });

    // Query groups where current user is member
    const groupQ = query(
      collection(db, 'groups'),
      where('members', 'array-contains', currentUser.uid)
    );

    const unsubGroup = onSnapshot(groupQ, (snap) => {
      groupList = snap.docs.map((docSnap) => {
        const data = docSnap.data() as GroupChat;
        const unread = data.unreadCount?.[currentUser.uid] || 0;
        const isPinned = data.pinnedBy?.includes(currentUser.uid) || false;
        const isMuted = data.mutedBy?.includes(currentUser.uid) || false;
        const isTyping = Boolean(
          data.typing &&
          Object.entries(data.typing).some(([uid, typing]) => uid !== currentUser.uid && typing)
        );

        return {
          id: docSnap.id,
          type: 'group' as const,
          title: data.name,
          photoURL: data.photoURL,
          lastMessage: data.lastMessage?.text || 'Group created',
          timestamp: data.updatedAt || data.createdAt || 0,
          unread,
          isPinned,
          isMuted,
          isExclusive: false,
          isTyping,
        };
      });
      combine();
    }, (error) => {
      console.warn('Groups listener notice:', error.message);
    });

    const combine = () => {
      const merged = [...privateList, ...groupList].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.timestamp - a.timestamp;
      });
      setChats(merged);
      setLoading(false);
    };

    return () => {
      unsubPriv();
      unsubGroup();
    };
  }, [currentUser]);

  // Load saved contacts user profiles
  useEffect(() => {
    if (!currentUser || !profile?.savedContactIds?.length) {
      setSavedContactUsers([]);
      return;
    }

    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const contactProfiles: UserProfile[] = [];
        for (const uid of profile.savedContactIds || []) {
          if (blockedUserIds.includes(uid)) continue;
          const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid), limit(1)));
          if (!snap.empty) {
            contactProfiles.push(snap.docs[0].data() as UserProfile);
          }
        }
        setSavedContactUsers(contactProfiles);
      } catch (err) {
        console.warn('Error loading contacts:', err);
      } finally {
        setLoadingContacts(false);
      }
    };

    fetchContacts();
  }, [currentUser, profile?.savedContactIds, blockedUserIds]);

  // Real-time username & display name search system
  useEffect(() => {
    const rawQuery = search.trim();
    if (!rawQuery || !currentUser) {
      setFoundUsers([]);
      setSearchingUsers(false);
      return;
    }

    const cleanQuery = rawQuery.startsWith('@') ? rawQuery.substring(1).toLowerCase() : rawQuery.toLowerCase();
    setSearchingUsers(true);

    const debounceTimer = setTimeout(async () => {
      try {
        // Query users by username prefix and displayName prefix
        const usersRef = collection(db, 'users');
        const qUsername = query(
          usersRef,
          where('username', '>=', cleanQuery),
          where('username', '<=', cleanQuery + '\uf8ff'),
          limit(15)
        );

        const snapUsername = await getDocs(qUsername);
        const map = new Map<string, UserProfile>();

        snapUsername.forEach((d) => {
          const u = d.data() as UserProfile;
          if (
            u.uid !== currentUser.uid &&
            !blockedUserIds.includes(u.uid) &&
            u.allowSearchByUsername !== false
          ) {
            map.set(u.uid, u);
          }
        });

        // Also query by displayName prefix if search is not an explicit @username
        if (!rawQuery.startsWith('@')) {
          const qName = query(
            usersRef,
            where('displayName', '>=', rawQuery),
            where('displayName', '<=', rawQuery + '\uf8ff'),
            limit(15)
          );
          const snapName = await getDocs(qName);
          snapName.forEach((d) => {
            const u = d.data() as UserProfile;
            if (
              u.uid !== currentUser.uid &&
              !blockedUserIds.includes(u.uid) &&
              u.allowSearchByUsername !== false
            ) {
              map.set(u.uid, u);
            }
          });
        }

        setFoundUsers(Array.from(map.values()));
      } catch (err) {
        console.warn('User search error:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(debounceTimer);
  }, [search, currentUser, blockedUserIds]);

  // Handle Start Standard 1-to-1 Message
  const handleStartMessage = async (targetUser: UserProfile) => {
    if (!currentUser || !profile) return;

    // Like Instagram: follow request must be accepted before direct chat begins
    const status = getFollowStatus(targetUser.uid);
    if (status !== 'accepted') {
      setFollowPromptModal({
        user: targetUser,
        status: status === 'pending_sent' ? 'pending_sent' : 'none',
      });
      return;
    }

    try {
      const sortedIds = [currentUser.uid, targetUser.uid].sort();
      const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
      const chatRef = doc(db, 'privateChats', chatId);

      await setDoc(
        chatRef,
        {
          id: chatId,
          participants: sortedIds,
          participantDetails: {
            [currentUser.uid]: {
              displayName: profile.displayName || profile.username,
              photoURL: profile.photoURL,
              username: profile.username,
            },
            [targetUser.uid]: {
              displayName: targetUser.displayName || targetUser.username,
              photoURL: targetUser.photoURL,
              username: targetUser.username,
            },
          },
          isExclusiveRoom: false,
          updatedAt: Date.now(),
          createdAt: Date.now(),
        },
        { merge: true }
      );

      setSearch('');
      openChat(chatId, 'private');
    } catch (err) {
      console.warn('Failed to start chat:', err);
    }
  };

  // Handle Send Private 2-User Room Invitation
  const handleSendPrivateRoomInvite = async (targetUser: UserProfile) => {
    if (!currentUser || !profile) return;
    const inviteId = `${currentUser.uid}_${targetUser.uid}_${Date.now()}`;

    try {
      await setDoc(doc(db, 'privateInvites', inviteId), {
        id: inviteId,
        senderId: currentUser.uid,
        senderUsername: profile.username,
        senderName: profile.displayName || currentUser.displayName || 'User',
        senderPhoto: profile.photoURL || currentUser.photoURL || '',
        receiverId: targetUser.uid,
        receiverUsername: targetUser.username,
        receiverName: targetUser.displayName,
        receiverPhoto: targetUser.photoURL || '',
        status: 'pending',
        createdAt: Date.now(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: targetUser.uid,
        type: 'private_invite',
        title: 'Private 2-User Chat Invitation',
        body: `@${profile.username} invited you to an exclusive 2-user private room.`,
        senderId: currentUser.uid,
        inviteId,
        read: false,
        createdAt: Date.now(),
      });

      soundManager.playSent();
      setSentInvites((prev) => ({ ...prev, [targetUser.uid]: true }));
    } catch (err) {
      console.warn('Failed to send private room invite:', err);
    }
  };

  const handleClearChatFromList = (e: React.MouseEvent, chat: CombinedChat) => {
    e.stopPropagation();
    setActiveChatMenuId(null);
    setChatActionModal({
      isOpen: true,
      type: 'clear',
      chat,
    });
  };

  const handleDeleteChatFromList = (e: React.MouseEvent, chat: CombinedChat) => {
    e.stopPropagation();
    setActiveChatMenuId(null);
    setChatActionModal({
      isOpen: true,
      type: 'delete',
      chat,
    });
  };

  const executeChatAction = async () => {
    if (!currentUser || !chatActionModal) return;
    const { type, chat } = chatActionModal;
    setActionInProgress(true);

    try {
      const collName = chat.type === 'private' ? 'privateChats' : 'groups';

      if (type === 'delete') {
        if (chat.type === 'private') {
          // Delete all messages subcollection docs then delete parent doc
          const snap = await getDocs(collection(db, 'privateChats', chat.id, 'messages'));
          const batch = writeBatch(db);
          snap.forEach((m) => batch.delete(m.ref));
          await batch.commit();
          await deleteDoc(doc(db, 'privateChats', chat.id));
        } else {
          // Group: remove member from group
          const groupRef = doc(db, 'groups', chat.id);
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            const data = groupSnap.data();
            const members = data.members || [];
            const isCreator = data.createdBy === currentUser.uid;
            if (isCreator && members.length <= 1) {
              const snap = await getDocs(collection(db, 'groups', chat.id, 'messages'));
              const batch = writeBatch(db);
              snap.forEach((m) => batch.delete(m.ref));
              await batch.commit();
              await deleteDoc(groupRef);
            } else {
              await updateDoc(groupRef, {
                members: members.filter((m: string) => m !== currentUser.uid),
              });
            }
          }
        }
        if (selectedChatId === chat.id) {
          closeChat();
        }
        setActionToast(`Deleted "${chat.title}"`);
        setTimeout(() => setActionToast(null), 3000);
      } else if (type === 'clear') {
        const snap = await getDocs(collection(db, collName, chat.id, 'messages'));
        const batch = writeBatch(db);
        snap.forEach((m) => {
          const data = m.data();
          const deletedFor = data.deletedFor || [];
          if (!deletedFor.includes(currentUser.uid)) {
            batch.update(m.ref, { deletedFor: [...deletedFor, currentUser.uid] });
          }
        });
        await batch.commit();
        setActionToast(`Cleared history for "${chat.title}"`);
        setTimeout(() => setActionToast(null), 3000);
      }
    } catch (err) {
      console.error(`Failed to ${type} chat:`, err);
      setActionToast(`Failed to ${type} conversation`);
      setTimeout(() => setActionToast(null), 3000);
    } finally {
      setActionInProgress(false);
      setChatActionModal(null);
    }
  };

  // Filter conversations
  const filteredChats = chats.filter((c) => {
    if (filter === 'unread' && c.unread === 0) return false;
    if (filter === 'private_rooms' && !c.isExclusive) return false;
    if (filter === 'groups' && c.type !== 'group') return false;
    if (search.trim()) {
      return (
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  const isSearchActive = search.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-900 border-r border-neutral-800 overflow-hidden">
      {/* Search & Top Action Bar */}
      <div className="p-3.5 border-b border-neutral-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" withText={true} />
          </div>
          <div className="flex items-center gap-1.5">
            <PWAInstallButton variant="header" />

            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-neutral-950 rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-neutral-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsPrivateRoomModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Exclusive 2-User Private Room Code"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>2-User Room</span>
            </button>

            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 transition-all"
              title="Find Users & New Chat"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Username & Conversation Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by @username, name, or messages..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Mode Tabs (Only when searching) */}
        {isSearchActive ? (
          <div className="flex bg-neutral-950/80 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setSearchTab('users')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                searchTab === 'users'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Found Users</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                {foundUsers.length}
              </span>
            </button>

            <button
              onClick={() => setSearchTab('conversations')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                searchTab === 'conversations'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Conversations</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                {filteredChats.length}
              </span>
            </button>
          </div>
        ) : (
          /* Filter Pills (Standard View) */
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                filter === 'all'
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                filter === 'unread'
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter('requests')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all flex items-center gap-1.5 ${
                filter === 'requests'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow shadow-cyan-600/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3 h-3 text-cyan-400" />
              <span>Requests</span>
              {pendingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-cyan-400 text-neutral-950 font-black text-[10px] flex items-center justify-center animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('contacts')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all flex items-center gap-1 ${
                filter === 'contacts'
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Contacts ({profile?.savedContactIds?.length || 0})</span>
            </button>
            <button
              onClick={() => setFilter('private_rooms')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all flex items-center gap-1 ${
                filter === 'private_rooms'
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              <Lock className="w-3 h-3" /> 2-User Rooms
            </button>
            <button
              onClick={() => setFilter('groups')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all flex items-center gap-1 ${
                filter === 'groups'
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3 h-3" /> Groups
            </button>
          </div>
        )}
      </div>

      {/* Main List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 custom-scrollbar">
        {/* VIEW 1: Active User Search Results */}
        {isSearchActive && searchTab === 'users' ? (
          searchingUsers ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span>Searching users directory...</span>
            </div>
          ) : foundUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-950 flex items-center justify-center text-neutral-600 mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-semibold text-neutral-300">No matching users found</p>
              <p className="text-[11px] text-neutral-500">
                Try searching for an exact @username or display name.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="px-2 pt-1 pb-0.5 text-[11px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center justify-between">
                <span>Matching Users Directory</span>
                <span className="text-red-400 font-normal">{foundUsers.length} found</span>
              </div>

              {foundUsers.map((user) => {
                const isSavedContact = profile?.savedContactIds?.includes(user.uid);
                const hasSentInvite = sentInvites[user.uid];
                const followStatus = getFollowStatus(user.uid);
                const isAccepted = followStatus === 'accepted';
                const friendPhone = getFriendPhoneNumber(user.uid, user);
                const incomingReq = incomingRequests.find((r) => r.senderId === user.uid);

                return (
                  <div
                    key={user.uid}
                    className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 transition-all space-y-2.5"
                  >
                    {/* User Header */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                          alt={user.displayName}
                          className="w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-neutral-950 ${
                            user.isOnline ? 'bg-cyan-400 ring-2 ring-cyan-400/30' : 'bg-neutral-600'
                          }`}
                          title={user.isOnline ? 'Online now' : 'Offline'}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-white truncate">
                            {user.displayName}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                            @{user.username}
                          </span>
                          {isAccepted && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Friends
                            </span>
                          )}
                          {followStatus === 'pending_sent' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> Requested
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {user.about || 'Hey there! I am using Chatcon.'}
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500">
                          {user.isOnline ? (
                            <span className="text-cyan-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last seen {formatLastSeen(user.lastSeen)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PHONE NUMBER SECTION: Compulsory & Publicly Displayed */}
                    <div className="pt-2 border-t border-neutral-800/80">
                      <div className="p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                              Phone Number (Public)
                            </span>
                            <span className="font-mono text-white text-xs font-semibold">
                              {user.phoneNumber || friendPhone || 'No phone set by user'}
                            </span>
                          </div>
                        </div>

                        {(user.phoneNumber || friendPhone) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                const num = user.phoneNumber || friendPhone || '';
                                navigator.clipboard.writeText(num);
                                setCopiedPhoneUid(user.uid);
                                setTimeout(() => setCopiedPhoneUid(null), 2000);
                              }}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                              title="Copy Phone Number"
                            >
                              {copiedPhoneUid === user.uid ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <a
                              href={`tel:${formatPhoneForCall(user.phoneNumber || friendPhone)}`}
                              className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                              title="Call"
                            >
                              <PhoneCall className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-neutral-800/80">
                      {/* 1. Follow / Message */}
                      {isAccepted ? (
                        <button
                          onClick={() => handleStartMessage(user)}
                          className="py-1.5 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                          title="Open Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </button>
                      ) : followStatus === 'pending_sent' ? (
                        <button
                          onClick={() => cancelFollowRequest(user.uid)}
                          className="py-1.5 px-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          title="Cancel Follow Request"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Requested</span>
                        </button>
                      ) : followStatus === 'pending_received' ? (
                        <button
                          onClick={async () => {
                            if (incomingReq) {
                              const cid = await acceptFollowRequest(incomingReq);
                              if (cid) openChat(cid, 'private');
                            }
                          }}
                          className="py-1.5 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => sendFollowRequest(user)}
                          className="py-1.5 px-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </button>
                      )}

                      {/* 2. Add / Toggle Contact */}
                      <button
                        onClick={() => toggleContact(user.uid)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          isSavedContact
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        }`}
                        title={isSavedContact ? 'Remove Contact' : 'Save to Contacts'}
                      >
                        {isSavedContact ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Contact</span>
                          </>
                        )}
                      </button>

                      {/* 3. Start Private 2-User Chat */}
                      <button
                        onClick={() => handleSendPrivateRoomInvite(user)}
                        disabled={hasSentInvite}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          hasSentInvite
                            ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                        }`}
                        title="Send 2-User Private Room Invitation"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{hasSentInvite ? 'Sent' : '2-User'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filter === 'requests' && !isSearchActive ? (
          /* VIEW: Instagram-Style Follow Requests Tab */
          incomingRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
                <UserCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-neutral-200 text-sm">No Pending Follow Requests</p>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  When other users send you an Instagram-style follow request, they will appear here. Accepting lets you chat and reveals each other’s phone numbers.
                </p>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="mt-2 py-2 px-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Find Friends to Follow</span>
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center justify-between border-b border-neutral-800">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Incoming Follow Requests</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-bold">
                  {incomingRequests.length} pending
                </span>
              </div>

              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 hover:border-cyan-500/30 transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={req.senderPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.senderUsername}`}
                      alt={req.senderName}
                      className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 object-cover shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white truncate">
                          {req.senderName}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                          @{req.senderUsername}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        wants to follow you and start chatting
                      </p>
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {formatChatListTime(req.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Accept / Decline Action buttons like Instagram */}
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                    <button
                      onClick={async () => {
                        const chatId = await acceptFollowRequest(req);
                        if (chatId) {
                          openChat(chatId, 'private');
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all active:scale-[0.98]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Chat</span>
                    </button>

                    <button
                      onClick={() => declineFollowRequest(req.id)}
                      className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-semibold text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filter === 'contacts' && !isSearchActive ? (
          /* VIEW 2: Saved Contacts Tab */
          loadingContacts ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading saved contacts...</span>
            </div>
          ) : savedContactUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-950 flex items-center justify-center text-neutral-600 mx-auto">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-neutral-300">No saved contacts yet</p>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-xs mx-auto">
                  Search by <strong className="text-red-400">@username</strong> in the search bar above and click "Add Contact" to build your contact list!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="px-2 pt-1 pb-0.5 text-[11px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center justify-between">
                <span>My Saved Contacts</span>
                <span className="text-red-400 font-normal">{savedContactUsers.length} total</span>
              </div>

              {savedContactUsers.map((contact) => (
                <div
                  key={contact.uid}
                  className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={contact.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${contact.username}`}
                        alt={contact.displayName}
                        className="w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-neutral-950 ${
                          contact.isOnline ? 'bg-red-500' : 'bg-neutral-600'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-white truncate">
                          {contact.displayName}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">
                          @{contact.username}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {contact.about}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-neutral-800/80">
                    <button
                      onClick={() => handleStartMessage(contact)}
                      className="py-1.5 px-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-red-400" />
                      <span>Message</span>
                    </button>

                    <button
                      onClick={() => toggleContact(contact.uid)}
                      className="py-1.5 px-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold flex items-center justify-center gap-1"
                      title="Remove from contacts"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>

                    <button
                      onClick={() => handleSendPrivateRoomInvite(contact)}
                      className="py-1.5 px-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-red-200" />
                      <span>2-User Room</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* VIEW 3: Standard Conversations List */
          loading ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading messages...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-950 flex items-center justify-center text-neutral-600">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-neutral-300">No conversations found</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Search users by @username above to start messaging!
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setIsPrivateRoomModalOpen(true)}
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium"
                >
                  Create 2-User Room
                </button>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium"
                >
                  Find Users
                </button>
              </div>
            </div>
          ) : (
            filteredChats.map((item) => {
              const isSelected = selectedChatId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => openChat(item.id, item.type)}
                  className={`w-full p-3.5 flex items-center gap-3 cursor-pointer transition-colors relative ${
                    isSelected
                      ? 'bg-neutral-800/90 border-l-4 border-red-500'
                      : 'hover:bg-neutral-800/50'
                  }`}
                >
                  {/* Avatar with indicator */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        item.photoURL ||
                        (item.type === 'group'
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${item.title}`
                          : `https://api.dicebear.com/7.x/bottts/svg?seed=${item.title}`)
                      }
                      alt={item.title}
                      className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 object-cover"
                    />
                    {item.isExclusive && (
                      <span className="absolute -bottom-0.5 -right-0.5 p-1 bg-red-500 rounded-full text-neutral-950 shadow" title="2-User Locked Room">
                        <Lock className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                    {item.type === 'group' && !item.isExclusive && (
                      <span className="absolute -bottom-0.5 -right-0.5 p-1 bg-blue-500 rounded-full text-white shadow">
                        <Users className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-white truncate max-w-[160px] sm:max-w-[200px]">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {formatChatListTime(item.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {item.isTyping ? (
                        <p className="text-xs text-emerald-400 font-medium truncate flex-1 flex items-center gap-1 animate-pulse">
                          <span>typing...</span>
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-400 truncate flex-1">
                          {item.lastMessage}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.isMuted && <BellOff className="w-3.5 h-3.5 text-neutral-500" />}
                        {item.isPinned && <Pin className="w-3.5 h-3.5 text-red-400" />}
                        {item.unread > 0 && (
                          <span className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-neutral-950 font-bold text-[10px] flex items-center justify-center">
                            {item.unread}
                          </span>
                        )}

                        {/* More Menu for Clear & Delete */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChatMenuId(activeChatMenuId === item.id ? null : item.id);
                            }}
                            className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-700/50 transition-colors"
                            title="Chat Options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeChatMenuId === item.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-6 w-36 bg-neutral-900 border border-neutral-700 rounded-xl p-1 shadow-2xl z-30 text-xs animate-in fade-in duration-150"
                            >
                              <button
                                type="button"
                                onClick={(e) => handleClearChatFromList(e, item)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 text-amber-400 rounded-lg text-left"
                              >
                                <Eraser className="w-3.5 h-3.5" />
                                <span>Clear Chat</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteChatFromList(e, item)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 text-red-400 rounded-lg text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Chat</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Floating Action Bar */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900/50 flex items-center justify-between text-xs">
        <span className="text-neutral-400">Discover & Connect</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-red-400" />
            <span>Find Users</span>
          </button>
          <button
            onClick={() => setIsNewGroupModalOpen(true)}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-red-400" />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {/* In-App Confirmation Modal for Clear / Delete */}
      {chatActionModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  chatActionModal.type === 'delete'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {chatActionModal.type === 'delete' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <Eraser className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">
                  {chatActionModal.type === 'delete' ? 'Delete Conversation?' : 'Clear Chat History?'}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                  {chatActionModal.chat.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
              {chatActionModal.type === 'delete'
                ? chatActionModal.chat.type === 'group'
                  ? 'You will leave this group and it will be removed from your conversations.'
                  : 'Permanently delete this private chat room and its message history.'
                : 'Clear all messages in this conversation. The chat will stay in your list.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() => setChatActionModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={executeChatAction}
                className={`px-4 py-1.5 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                  chatActionModal.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                }`}
              >
                {actionInProgress && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>
                  {chatActionModal.type === 'delete' ? 'Delete Chat' : 'Clear History'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-neutral-800/95 border border-cyan-500/40 text-cyan-300 text-xs font-medium rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-cyan-400" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Instagram-Style Follow Request Required Dialog */}
      {followPromptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
              <UserPlus className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                Follow Request Required
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Like Instagram, you must follow{' '}
                <strong className="text-white">@{followPromptModal.user.username}</strong>{' '}
                and have your request accepted before starting a direct chat.
              </p>
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-cyan-300 flex items-center justify-center gap-1.5 mt-2">
                <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Phone numbers will unlock once accepted!</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {followPromptModal.status === 'none' ? (
                <button
                  onClick={async () => {
                    await sendFollowRequest(followPromptModal.user);
                    setFollowPromptModal(null);
                    setActionToast(`Follow request sent to @${followPromptModal.user.username}`);
                    setTimeout(() => setActionToast(null), 3000);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all active:scale-[0.98]"
                >
                  Send Follow Request Now
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-amber-300 flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Request pending approval by @{followPromptModal.user.username}</span>
                </div>
              )}

              <button
                onClick={() => setFollowPromptModal(null)}
                className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
