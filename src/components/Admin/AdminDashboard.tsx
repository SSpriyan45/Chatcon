import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  orderBy,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { UserProfile, ReportItem, GroupChat, GlobalAnnouncement, PrivateChat, ChatMessage } from '../../types';
import { formatMessageTime } from '../../utils/formatters';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  MessageSquare,
  Lock,
  Flag,
  UserCheck,
  UserX,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  Activity,
  Send,
  Eraser,
  Check,
  X,
  Eye,
  Key,
  Copy,
  ExternalLink,
  Clock,
  Mail,
  ArrowLeft,
  Sliders,
  AlertCircle
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { currentUser, isAdmin, verifyAdminPassword, lockAdminSession } = useAuth();
  const { setActiveTab: setMainTab, openChat } = useUI();

  // Authentication Gate State
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'chats' | 'groups' | 'reports' | 'broadcast'>('overview');

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    suspendedUsers: 0,
    privateChats: 0,
    groupsCount: 0,
    pendingReports: 0,
  });

  // Data lists
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'suspended' | 'admins'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfile | null>(null);

  const [chatsList, setChatsList] = useState<PrivateChat[]>([]);
  const [chatSearch, setChatSearch] = useState('');

  const [groupsList, setGroupsList] = useState<GroupChat[]>([]);
  const [reportsList, setReportsList] = useState<ReportItem[]>([]);
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);

  // Message Inspector Modal state
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    chatId: string;
    chatTitle: string;
    type: 'private' | 'group';
  } | null>(null);
  const [inspectedMessages, setInspectedMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // New broadcast form
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  // In-app confirmation dialog
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Unlock Admin with Master Password
  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      const result = await verifyAdminPassword(adminPasswordInput.trim());
      if (result.success) {
        setAdminPasswordInput('');
        setToastMessage('Administrator access granted successfully');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setAuthError(result.error || 'Incorrect administrator password');
      }
    } catch {
      setAuthError('An error occurred during authentication');
    } finally {
      setAuthLoading(false);
    }
  };

  // Load Firestore Data when Admin is authenticated
  useEffect(() => {
    if (!isAdmin) return;

    // Load users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const users: UserProfile[] = [];
      let online = 0;
      let suspended = 0;
      snap.forEach((d) => {
        const u = d.data() as UserProfile;
        users.push(u);
        if (u.isOnline) online++;
        if (u.isSuspended) suspended++;
      });
      users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsersList(users);
      setStats((prev) => ({
        ...prev,
        totalUsers: users.length,
        onlineUsers: online,
        suspendedUsers: suspended,
      }));
    }, (err) => {
      console.warn('Admin users listener notice:', err.message);
    });

    // Load private chats list & count
    const unsubChats = onSnapshot(collection(db, 'privateChats'), (snap) => {
      const list: PrivateChat[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PrivateChat));
      list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setChatsList(list);
      setStats((prev) => ({ ...prev, privateChats: snap.size }));
    }, (err) => {
      console.warn('Admin chats listener notice:', err.message);
    });

    // Load groups
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      const grps: GroupChat[] = [];
      snap.forEach((d) => grps.push({ id: d.id, ...d.data() } as GroupChat));
      grps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setGroupsList(grps);
      setStats((prev) => ({ ...prev, groupsCount: snap.size }));
    }, (err) => {
      console.warn('Admin groups listener notice:', err.message);
    });

    // Load reports
    const unsubReports = onSnapshot(query(collection(db, 'reports'), orderBy('createdAt', 'desc')), (snap) => {
      const reps: ReportItem[] = [];
      let pending = 0;
      snap.forEach((d) => {
        const r = { id: d.id, ...d.data() } as ReportItem;
        reps.push(r);
        if (r.status === 'pending') pending++;
      });
      setReportsList(reps);
      setStats((prev) => ({ ...prev, pendingReports: pending }));
    }, (err) => {
      console.warn('Admin reports listener notice:', err.message);
    });

    // Load announcements
    const unsubAnnounce = onSnapshot(query(collection(db, 'appSettings'), orderBy('createdAt', 'desc')), (snap) => {
      const anns: GlobalAnnouncement[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.type === 'announcement') {
          anns.push({ id: d.id, ...data } as GlobalAnnouncement);
        }
      });
      setAnnouncements(anns);
    }, (err) => {
      console.warn('Admin announcements listener notice:', err.message);
    });

    return () => {
      unsubUsers();
      unsubChats();
      unsubGroups();
      unsubReports();
      unsubAnnounce();
    };
  }, [isAdmin]);

  // Load inspected messages when inspect modal opens
  useEffect(() => {
    if (!inspectModal || !inspectModal.isOpen) {
      setInspectedMessages([]);
      return;
    }

    setLoadingMessages(true);
    const collName = inspectModal.type === 'private' ? 'privateChats' : 'groups';
    const q = query(
      collection(db, collName, inspectModal.chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = [];
      snap.forEach((d) => {
        msgs.push({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) });
      });
      setInspectedMessages(msgs);
      setLoadingMessages(false);
    }, (err) => {
      console.warn('Admin messages inspect notice:', err.message);
      setLoadingMessages(false);
    });

    return () => unsub();
  }, [inspectModal]);

  // Block / Delete a specific message
  const handleBlockMessage = async (messageId: string) => {
    if (!inspectModal) return;
    const collName = inspectModal.type === 'private' ? 'privateChats' : 'groups';

    try {
      await updateDoc(doc(db, collName, inspectModal.chatId, 'messages', messageId), {
        isDeletedForEveryone: true,
        text: 'This message was blocked by an administrator.',
        mediaUrl: '',
      });
      setToastMessage('Message blocked and removed');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to block message:', err);
      setToastMessage('Failed to block message');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Permanently delete message doc
  const handleDeleteMessageDoc = async (messageId: string) => {
    if (!inspectModal) return;
    const collName = inspectModal.type === 'private' ? 'privateChats' : 'groups';

    try {
      await deleteDoc(doc(db, collName, inspectModal.chatId, 'messages', messageId));
      setToastMessage('Message permanently deleted');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to delete message:', err);
      setToastMessage('Failed to delete message');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Suspend / Unsuspend user action
  const handleToggleSuspendUser = async (user: UserProfile) => {
    const newSuspended = !user.isSuspended;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isSuspended: newSuspended,
      });
      setToastMessage(`@${user.username} is now ${newSuspended ? 'SUSPENDED' : 'ACTIVE'}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update user status:', err);
      setToastMessage('Error updating user status');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Toggle user admin role
  const handleToggleAdminRole = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      if (newRole === 'admin') {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: user.email,
          grantedAt: Date.now(),
        }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'admins', user.uid)).catch(() => {});
      }
      setToastMessage(`@${user.username} role updated to ${newRole}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update admin role:', err);
    }
  };

  // Delete User Account
  const handleDeleteUser = (user: UserProfile) => {
    setActionConfirm({
      isOpen: true,
      title: 'Delete User Account',
      description: `Permanently delete account and user profile for @${user.username} (${user.email})? This action cannot be undone.`,
      confirmText: 'Delete User',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid));
          await deleteDoc(doc(db, 'admins', user.uid)).catch(() => {});
          setToastMessage(`User @${user.username} deleted`);
          setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
          console.error('Failed to delete user:', err);
          setToastMessage('Failed to delete user');
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    });
  };

  // Chat Actions (Delete & Clear from Dashboard)
  const handleDeleteChat = (chatId: string) => {
    setActionConfirm({
      isOpen: true,
      title: 'Delete Chat Room',
      description: 'Permanently remove this chat room and all messages from the database? Participants will lose access.',
      confirmText: 'Delete Chat',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const msgsSnap = await getDocs(collection(db, 'privateChats', chatId, 'messages'));
          const batch = writeBatch(db);
          msgsSnap.forEach((m) => batch.delete(m.ref));
          await batch.commit();
          await deleteDoc(doc(db, 'privateChats', chatId));
          setToastMessage('Chat room deleted');
          setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
          console.error('Failed to delete chat:', err);
          setToastMessage('Error deleting chat');
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    });
  };

  const handleClearChatMessages = (chatId: string) => {
    setActionConfirm({
      isOpen: true,
      title: 'Clear Chat Messages',
      description: 'Clear all message documents in this conversation? The room will remain with an empty history.',
      confirmText: 'Clear Messages',
      isDestructive: false,
      onConfirm: async () => {
        try {
          const msgsSnap = await getDocs(collection(db, 'privateChats', chatId, 'messages'));
          const batch = writeBatch(db);
          msgsSnap.forEach((m) => batch.delete(m.ref));
          await batch.commit();
          await updateDoc(doc(db, 'privateChats', chatId), {
            lastMessage: {
              text: 'Chat history cleared by admin',
              senderId: 'system',
              senderName: 'System',
              createdAt: Date.now(),
              type: 'text',
            },
            updatedAt: Date.now(),
          });
          setToastMessage('Chat messages cleared');
          setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
          console.error('Failed to clear chat:', err);
          setToastMessage('Error clearing chat');
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    });
  };

  // Group Actions (Delete & Clear from Dashboard)
  const handleDeleteGroup = (groupId: string) => {
    setActionConfirm({
      isOpen: true,
      title: 'Delete Group',
      description: 'Permanently delete this group and all its message history?',
      confirmText: 'Delete Group',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const msgsSnap = await getDocs(collection(db, 'groups', groupId, 'messages'));
          const batch = writeBatch(db);
          msgsSnap.forEach((m) => batch.delete(m.ref));
          await batch.commit();
          await deleteDoc(doc(db, 'groups', groupId));
          setToastMessage('Group permanently deleted');
          setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
          console.error('Failed to delete group:', err);
          setToastMessage('Error deleting group');
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    });
  };

  const handleClearGroupMessages = (groupId: string) => {
    setActionConfirm({
      isOpen: true,
      title: 'Clear Group Messages',
      description: 'Clear all messages in this group? Members and settings will remain intact.',
      confirmText: 'Clear Messages',
      isDestructive: false,
      onConfirm: async () => {
        try {
          const msgsSnap = await getDocs(collection(db, 'groups', groupId, 'messages'));
          const batch = writeBatch(db);
          msgsSnap.forEach((m) => batch.delete(m.ref));
          await batch.commit();
          await updateDoc(doc(db, 'groups', groupId), {
            lastMessage: {
              text: 'Group history cleared by admin',
              senderId: 'system',
              senderName: 'System',
              createdAt: Date.now(),
              type: 'text',
            },
            updatedAt: Date.now(),
          });
          setToastMessage('Group messages cleared');
          setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
          console.error('Failed to clear group:', err);
          setToastMessage('Error clearing group');
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    });
  };

  // Broadcast announcement
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMsg.trim() || !currentUser) return;

    setBroadcasting(true);
    try {
      await addDoc(collection(db, 'appSettings'), {
        type: 'announcement',
        title: announcementTitle.trim(),
        message: announcementMsg.trim(),
        urgent: isUrgent,
        authorId: currentUser.uid,
        createdAt: Date.now(),
      });
      setAnnouncementTitle('');
      setAnnouncementMsg('');
      setIsUrgent(false);
      setToastMessage('Announcement broadcasted to all users!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to post announcement:', err);
      setToastMessage('Error posting announcement');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appSettings', id));
      setToastMessage('Announcement removed');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  // Filter users by search and status
  const filteredUsers = usersList.filter((u) => {
    if (userFilter === 'active' && u.isSuspended) return false;
    if (userFilter === 'suspended' && !u.isSuspended) return false;
    if (userFilter === 'admins' && u.role !== 'admin') return false;

    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  // Filter chats by search
  const filteredChats = chatsList.filter((c) => {
    if (!chatSearch.trim()) return true;
    const q = chatSearch.toLowerCase();
    const details = c.participantDetails ? Object.values(c.participantDetails) : [];
    const matchUser = details.some(
      (p) => p.displayName?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)
    );
    const matchCode = c.roomCode?.toLowerCase().includes(q);
    const matchId = c.id.toLowerCase().includes(q);
    return matchUser || matchCode || matchId;
  });

  // ========================================================
  // 1. ADMIN AUTHORIZATION GATE (When user is not yet admin)
  // ========================================================
  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-neutral-950 text-white select-none">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
          {/* Ambient Glow */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mb-5 shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-extrabold text-white tracking-tight mb-1">
              Administrator Access Portal
            </h2>
            <p className="text-xs text-neutral-400 mb-6 max-w-xs leading-relaxed">
              Enter your master administrator security password to access app user information, moderation controls, and message management.
            </p>

            <form onSubmit={handleUnlockAdmin} className="w-full space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-red-400" />
                  Admin Security Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter admin password..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 pr-10 font-mono tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>{authLoading ? 'Verifying...' : 'Unlock Admin Dashboard'}</span>
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMainTab('chats')}
              className="mt-6 text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Messages</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // 2. FULL AUTHORIZED ADMIN COMMAND CENTER
  // ========================================================
  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 text-white overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 px-6 border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Admin Moderation Center</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                Master Admin
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              User information inspection, message blocking, and community safety controls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => lockAdminSession()}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700"
            title="Lock administrator session"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock Session</span>
          </button>
          <button
            onClick={() => setMainTab('chats')}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>App Home</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="px-6 py-2.5 border-b border-neutral-800/80 bg-neutral-950 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'users', label: `Users (${stats.totalUsers})`, icon: Users },
          { id: 'chats', label: `Direct Chats (${stats.privateChats})`, icon: Lock },
          { id: 'groups', label: `Groups (${stats.groupsCount})`, icon: MessageSquare },
          { id: 'reports', label: `Reports (${stats.pendingReports})`, icon: Flag },
          { id: 'broadcast', label: 'Broadcast Alerts', icon: Megaphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {/* TAB 1: OVERVIEW & STATS */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                <div className="text-[11px] text-neutral-400 font-medium mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-red-400" /> Total Users
                </div>
                <div className="text-2xl font-black text-white">{stats.totalUsers}</div>
                <div className="text-[10px] text-emerald-400 font-medium mt-1">
                  {stats.onlineUsers} online now
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                <div className="text-[11px] text-neutral-400 font-medium mb-1 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5 text-amber-400" /> Suspended
                </div>
                <div className="text-2xl font-black text-amber-400">{stats.suspendedUsers}</div>
                <div className="text-[10px] text-neutral-500 mt-1">Restricted accounts</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                <div className="text-[11px] text-neutral-400 font-medium mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-400" /> 2-User Rooms
                </div>
                <div className="text-2xl font-black text-white">{stats.privateChats}</div>
                <div className="text-[10px] text-neutral-500 mt-1">Encrypted sessions</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                <div className="text-[11px] text-neutral-400 font-medium mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Groups
                </div>
                <div className="text-2xl font-black text-white">{stats.groupsCount}</div>
                <div className="text-[10px] text-neutral-500 mt-1">Community chats</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                <div className="text-[11px] text-neutral-400 font-medium mb-1 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-red-400" /> Pending Reports
                </div>
                <div className="text-2xl font-black text-red-400">{stats.pendingReports}</div>
                <div className="text-[10px] text-neutral-500 mt-1">Requires review</div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-5 rounded-3xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Quick Management Tasks</h3>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setActiveTab('users')}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-4 h-4 text-red-400" />
                  <span>Manage Users & Suspend Accounts</span>
                </button>
                <button
                  onClick={() => setActiveTab('chats')}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span>Inspect & Block Chat Messages</span>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Flag className="w-4 h-4" />
                  <span>Review Pending Reports ({stats.pendingReports})</span>
                </button>
                <button
                  onClick={() => setActiveTab('broadcast')}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Send Broadcast Announcement</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS INFORMATION & MODERATION (SUSPEND / VIEW / DELETE) */}
        {activeTab === 'users' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, @username, email, or UID..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                {(['all', 'active', 'suspended', 'admins'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setUserFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                      userFilter === filterKey
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table / List */}
            <div className="divide-y divide-neutral-800/80 bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
              {filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-500">
                  No users matching filter criteria.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                          alt={u.displayName}
                          className="w-11 h-11 rounded-full bg-neutral-800 border border-neutral-700 object-cover"
                        />
                        {u.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-bold text-white truncate">{u.displayName}</span>
                          <span className="text-xs text-red-400 font-mono">@{u.username}</span>

                          {u.role === 'admin' && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                              Admin
                            </span>
                          )}

                          {u.isSuspended ? (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Suspended
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-neutral-400 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-neutral-300">
                            <Mail className="w-3 h-3 text-neutral-500" />
                            {u.email || 'No email'}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-neutral-500 text-[10px]">
                            UID: {u.uid.slice(0, 10)}...
                          </span>
                          <span>•</span>
                          <span>Joined {formatMessageTime(u.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: View Info, Suspend / Unsuspend, Delete */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => setSelectedUserDetail(u)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700"
                        title="View user details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => handleToggleSuspendUser(u)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                          u.isSuspended
                            ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30'
                            : 'bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30'
                        }`}
                        title={u.isSuspended ? 'Lift suspension' : 'Suspend user account'}
                      >
                        {u.isSuspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        <span>{u.isSuspended ? 'Unsuspend' : 'Suspend'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Delete user profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CHATS MODERATION (INSPECT MESSAGES & BLOCK) */}
        {activeTab === 'chats' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search chats by participant username, room code, or chat ID..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {filteredChats.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-500 rounded-3xl bg-neutral-900 border border-neutral-800">
                <Lock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                No private chats or rooms found.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80 bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
                {filteredChats.map((c) => {
                  const participantsList = c.participantDetails ? Object.values(c.participantDetails) : [];
                  return (
                    <div
                      key={c.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-neutral-800/40 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.isExclusiveRoom ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              2-User Private Room
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                              Direct Message
                            </span>
                          )}

                          {c.roomCode && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-neutral-950 text-neutral-300 border border-neutral-800">
                              Code: {c.roomCode}
                            </span>
                          )}

                          <span className="text-[10px] text-neutral-500 font-mono">
                            ID: {c.id.slice(0, 10)}...
                          </span>
                        </div>

                        {/* Participants List */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-neutral-400">Members:</span>
                          {participantsList.length > 0 ? (
                            participantsList.map((p, idx) => (
                              <span
                                key={idx}
                                className="text-xs font-semibold text-white flex items-center gap-1 bg-neutral-950 px-2 py-0.5 rounded-lg border border-neutral-800"
                              >
                                <span>{p.displayName || p.username}</span>
                                <span className="text-red-400 font-mono text-[10px]">@{p.username}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-neutral-500 font-mono">
                              {c.participants?.join(', ') || 'Unknown'}
                            </span>
                          )}
                        </div>

                        {/* Last Message Snippet */}
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 truncate">
                          <span className="text-neutral-500">Last activity:</span>
                          <span className="text-neutral-300 truncate max-w-sm">
                            {c.lastMessage?.text || 'No message recorded'}
                          </span>
                          <span className="text-neutral-600">•</span>
                          <span className="text-neutral-500 text-[10px]">
                            {formatMessageTime(c.updatedAt || c.createdAt || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Admin Actions: Inspect Messages, Clear, Delete */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() =>
                            setInspectModal({
                              isOpen: true,
                              chatId: c.id,
                              chatTitle: `Chat (${c.roomCode ? 'Room ' + c.roomCode : 'Direct'})`,
                              type: 'private',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30"
                          title="Inspect live messages and block content"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Messages</span>
                        </button>

                        <button
                          onClick={() => handleClearChatMessages(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title="Clear all messages in this chat"
                        >
                          <Eraser className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>

                        <button
                          onClick={() => handleDeleteChat(c.id)}
                          className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Delete chat room"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GROUPS MODERATION */}
        {activeTab === 'groups' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="divide-y divide-neutral-800/80 bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
              {groupsList.length === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-500">No group chats found.</div>
              ) : (
                groupsList.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={g.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${g.name}`}
                        alt={g.name}
                        className="w-11 h-11 rounded-2xl bg-neutral-800 border border-neutral-700 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-bold text-white truncate">{g.name}</h4>
                          <span className="text-[10px] px-2 py-0.2 rounded font-mono bg-neutral-950 text-neutral-300 border border-neutral-800">
                            Code: {g.inviteCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          {g.members?.length || 0} members • Created {formatMessageTime(g.createdAt)}
                        </p>
                        {g.lastMessage?.text && (
                          <p className="text-[11px] text-neutral-400 truncate max-w-sm mt-0.5">
                            Latest: {g.lastMessage.text}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() =>
                          setInspectModal({
                            isOpen: true,
                            chatId: g.id,
                            chatTitle: `Group: ${g.name}`,
                            type: 'group',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30"
                        title="Inspect messages in this group"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Messages</span>
                      </button>

                      <button
                        onClick={() => handleClearGroupMessages(g.id)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Clear group messages"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>

                      <button
                        onClick={() => handleDeleteGroup(g.id)}
                        className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Delete group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {reportsList.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-500 rounded-3xl bg-neutral-900 border border-neutral-800">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                No member reports submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80 bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
                {reportsList.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Report #{r.id.slice(0, 6)}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            r.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="text-xs text-red-400 font-semibold">{r.reason}</span>
                      </div>
                      <p className="text-xs text-neutral-300">{r.details || 'No additional details provided'}</p>
                      <p className="text-[10px] text-neutral-500">
                        Target: {r.targetName || r.targetId} • Reporter UID: {r.reporterId} •{' '}
                        {formatMessageTime(r.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={async () => {
                          const target = usersList.find((u) => u.uid === r.targetId);
                          if (target) {
                            await handleToggleSuspendUser(target);
                          } else {
                            await updateDoc(doc(db, 'users', r.targetId), { isSuspended: true }).catch(() => {});
                          }
                          await updateDoc(doc(db, 'reports', r.id), { status: 'resolved' });
                          setToastMessage('Reported user suspended and report resolved');
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-rose-600/30"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Suspend Reported User</span>
                      </button>

                      <button
                        onClick={async () => {
                          await updateDoc(doc(db, 'reports', r.id), { status: 'dismissed' });
                          setToastMessage('Report dismissed');
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: GLOBAL BROADCAST */}
        {activeTab === 'broadcast' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="p-6 bg-neutral-900 rounded-3xl border border-neutral-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-red-400" />
                <span>Broadcast Announcement Banner</span>
              </h3>

              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Announcement Headline
                  </label>
                  <input
                    type="text"
                    required
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="E.g., System Maintenance Scheduled Tonight..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Message Body
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={announcementMsg}
                    onChange={(e) => setAnnouncementMsg(e.target.value)}
                    placeholder="Enter full announcement details displayed to all online users..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="urgentCheck"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500"
                  />
                  <label htmlFor="urgentCheck" className="text-xs text-neutral-300 font-medium">
                    Mark as Urgent Banner (Highlights red across user screens)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={broadcasting}
                  className="py-2.5 px-5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{broadcasting ? 'Posting...' : 'Broadcast to All Users'}</span>
                </button>
              </form>
            </div>

            {/* Active Announcements List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Active Broadcast Banners ({announcements.length})
              </h4>
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{a.title}</span>
                      {a.urgent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-300 mb-1">{a.message}</p>
                    <span className="text-[10px] text-neutral-500">
                      Posted {formatMessageTime(a.createdAt)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteAnnouncement(a.id)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 transition-colors"
                    title="Remove banner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          3. MESSAGE INSPECTOR & BLOCKING MODAL
         ======================================================== */}
      {inspectModal && inspectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Message Moderation Inspector</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">{inspectModal.chatTitle}</p>
                </div>
              </div>

              <button
                onClick={() => setInspectModal(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar divide-y divide-neutral-800/40">
              {loadingMessages ? (
                <div className="p-12 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading chat message history...</span>
                </div>
              ) : inspectedMessages.length === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-500">
                  No messages exist in this conversation yet.
                </div>
              ) : (
                inspectedMessages.map((m) => (
                  <div key={m.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3 group">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <img
                        src={m.senderPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.senderName}`}
                        alt={m.senderName}
                        className="w-8 h-8 rounded-full bg-neutral-800 object-cover shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-white">{m.senderName}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {formatMessageTime(m.createdAt)}
                          </span>
                          {m.isDeletedForEveryone && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                              Blocked / Deleted
                            </span>
                          )}
                        </div>

                        {/* Content text or media */}
                        <div
                          className={`text-xs ${
                            m.isDeletedForEveryone ? 'text-red-400/80 italic' : 'text-neutral-200'
                          } break-words leading-relaxed`}
                        >
                          {m.text || (m.mediaUrl ? '[Media File]' : '')}
                        </div>

                        {/* Media image preview */}
                        {m.mediaUrl && !m.isDeletedForEveryone && (
                          <div className="mt-1.5 max-w-xs rounded-xl overflow-hidden border border-neutral-800">
                            {m.type === 'video' ? (
                              <video src={m.mediaUrl} controls className="max-h-48 w-full object-cover" />
                            ) : (
                              <img src={m.mediaUrl} alt="media" className="max-h-48 w-full object-cover" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Block / Delete Actions for this Message */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!m.isDeletedForEveryone && (
                        <button
                          onClick={() => handleBlockMessage(m.id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-neutral-950 text-[11px] font-semibold transition-colors border border-amber-500/30"
                          title="Block message content for all users"
                        >
                          Block Message
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          const target = usersList.find((u) => u.uid === m.senderId);
                          if (target) {
                            await handleToggleSuspendUser(target);
                          } else {
                            await updateDoc(doc(db, 'users', m.senderId), { isSuspended: true }).catch(() => {});
                            setToastMessage(`Sender ${m.senderName} suspended`);
                            setTimeout(() => setToastMessage(null), 3000);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-[11px] font-semibold transition-colors border border-rose-500/30"
                        title="Suspend the user who sent this message"
                      >
                        Suspend Sender
                      </button>

                      <button
                        onClick={() => handleDeleteMessageDoc(m.id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Permanently erase message document from database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 px-6 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400">
              <span>{inspectedMessages.length} total messages inspected</span>
              <button
                onClick={() => setInspectModal(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          4. USER DETAILS INSPECTION MODAL
         ======================================================== */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedUserDetail(null)}
              className="absolute top-5 right-5 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <img
                  src={selectedUserDetail.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUserDetail.username}`}
                  alt={selectedUserDetail.displayName}
                  className="w-16 h-16 rounded-full bg-neutral-800 border-2 border-red-500 object-cover"
                />
                {selectedUserDetail.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{selectedUserDetail.displayName}</h3>
                <div className="text-xs text-red-400 font-mono">@{selectedUserDetail.username}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{selectedUserDetail.email}</div>
              </div>
            </div>

            <div className="space-y-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-xs mb-6">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">User ID:</span>
                <span className="font-mono text-neutral-300 flex items-center gap-1.5">
                  <span>{selectedUserDetail.uid}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedUserDetail.uid);
                      setToastMessage('UID copied to clipboard');
                      setTimeout(() => setToastMessage(null), 2500);
                    }}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Account Status:</span>
                <span className={`font-bold ${selectedUserDetail.isSuspended ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedUserDetail.isSuspended ? 'Suspended' : 'Active'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400">System Role:</span>
                <span className="font-bold text-white capitalize">{selectedUserDetail.role || 'user'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Registration Date:</span>
                <span className="text-neutral-300">{formatMessageTime(selectedUserDetail.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Last Seen:</span>
                <span className="text-neutral-300">
                  {selectedUserDetail.isOnline ? 'Active Now' : formatMessageTime(selectedUserDetail.lastSeen)}
                </span>
              </div>

              {selectedUserDetail.about && (
                <div className="pt-2 border-t border-neutral-800/80">
                  <span className="text-neutral-400 block mb-0.5">Bio / About:</span>
                  <span className="text-neutral-300 italic">{selectedUserDetail.about}</span>
                </div>
              )}
            </div>

            {/* Quick Actions inside detail modal */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => handleToggleAdminRole(selectedUserDetail)}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors border border-neutral-700"
              >
                {selectedUserDetail.role === 'admin' ? 'Revoke Admin' : 'Make Administrator'}
              </button>

              <button
                onClick={async () => {
                  await handleToggleSuspendUser(selectedUserDetail);
                  setSelectedUserDetail((prev) => (prev ? { ...prev, isSuspended: !prev.isSuspended } : null));
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors ${
                  selectedUserDetail.isSuspended
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {selectedUserDetail.isSuspended ? 'Unsuspend Account' : 'Suspend Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. CONFIRMATION MODAL
         ======================================================== */}
      {actionConfirm && actionConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                actionConfirm.isDestructive ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">{actionConfirm.title}</h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">{actionConfirm.description}</p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    await actionConfirm.onConfirm();
                  } finally {
                    setActionLoading(false);
                    setActionConfirm(null);
                  }
                }}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-md ${
                  actionConfirm.isDestructive
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                }`}
              >
                {actionLoading ? 'Processing...' : actionConfirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
