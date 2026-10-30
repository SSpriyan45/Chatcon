import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useNotifications } from '../../context/NotificationContext';
import { useFollow } from '../../context/FollowContext';
import {
  MessageSquare,
  CircleDot,
  Phone,
  Settings,
  ShieldAlert,
  Lock,
  Bell
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { isAdmin } = useAuth();
  const {
    activeTab,
    setActiveTab,
    selectedChatId,
    setIsPrivateRoomModalOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
  } = useUI();
  const { unreadCount } = useNotifications();
  const { pendingCount } = useFollow();

  // Hide bottom nav if inside an active chat on mobile to give maximum screen space
  if (selectedChatId) return null;

  return (
    <nav className="md:hidden h-16 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur-lg flex items-center justify-around px-2 z-30 shrink-0">
      <button
        onClick={() => setActiveTab('chats')}
        className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'chats' ? 'text-blue-400' : 'text-neutral-400'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 font-medium">Chats</span>
        {pendingCount > 0 && (
          <span className="absolute top-1 right-3 w-3.5 h-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full text-[8px] font-black flex items-center justify-center ring-2 ring-neutral-950 animate-pulse">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab('status')}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'status' ? 'text-blue-400' : 'text-neutral-400'
        }`}
      >
        <CircleDot className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 font-medium">Status</span>
      </button>

      {/* Floating center 2-user lock room button */}
      <button
        onClick={() => setIsPrivateRoomModalOpen(true)}
        className="w-11 h-11 -mt-5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 ring-4 ring-neutral-950 transition-transform active:scale-95"
        title="2-User Private Room"
      >
        <Lock className="w-5 h-5" />
      </button>

      <button
        onClick={() => setActiveTab('calls')}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'calls' ? 'text-blue-400' : 'text-neutral-400'
        }`}
      >
        <Phone className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 font-medium">Calls</span>
      </button>

      <button
        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
        className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isNotificationsOpen ? 'text-blue-400' : 'text-neutral-400'
        }`}
      >
        <Bell className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 font-medium">Alerts</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-2 w-3.5 h-3.5 bg-blue-500 text-white rounded-full text-[8px] font-black flex items-center justify-center ring-2 ring-neutral-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </nav>
  );
};
