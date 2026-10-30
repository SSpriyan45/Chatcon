import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI, MainTab } from '../../context/UIContext';
import { useNotifications } from '../../context/NotificationContext';
import { useFollow } from '../../context/FollowContext';
import { PWAInstallButton } from '../PWA/PWAInstallButton';
import {
  MessageSquare,
  CircleDot,
  Phone,
  Settings,
  ShieldAlert,
  Moon,
  Sun,
  Lock,
  Bell,
  UserPlus
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const {
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    setIsPrivateRoomModalOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
  } = useUI();
  const { unreadCount } = useNotifications();
  const { pendingCount } = useFollow();

  const navItems: { tab: MainTab; label: string; icon: any }[] = [
    { tab: 'chats', label: 'Chats', icon: MessageSquare },
    { tab: 'status', label: 'Status', icon: CircleDot },
    { tab: 'calls', label: 'Calls', icon: Phone },
    { tab: 'settings', label: 'Settings', icon: Settings },
    { tab: 'admin', label: 'Admin', icon: ShieldAlert },
  ];

  return (
    <aside className="hidden md:flex flex-col w-18 lg:w-20 bg-neutral-950 border-r border-neutral-800 items-center py-4 justify-between shrink-0 select-none z-20">
      {/* Brand Icon & Top Controls */}
      <div className="flex flex-col items-center gap-3">
        <div
          onClick={() => setActiveTab('chats')}
          className="cursor-pointer hover:scale-105 transition-transform"
          title="Chatcon"
        >
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/40 bg-neutral-950">
            <img
              src="/logo.png"
              alt="Chatcon"
              className="w-full h-full object-cover scale-[1.05] origin-center"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Quick 2-User Private Room Button */}
        <button
          onClick={() => setIsPrivateRoomModalOpen(true)}
          className="p-2.5 rounded-xl bg-neutral-900 hover:bg-blue-950/60 text-blue-400 border border-neutral-800 hover:border-blue-500/40 transition-all flex flex-col items-center gap-0.5 group"
          title="Create Exclusive 2-User Room"
        >
          <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-bold text-neutral-400 group-hover:text-blue-400">2P</span>
        </button>

        {/* Notifications Bell Button */}
        <button
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          className={`relative p-3 rounded-2xl transition-all ${
            isNotificationsOpen
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-neutral-950 animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-2 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            const hasFollowBadge = item.tab === 'chats' && pendingCount > 0;
            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`relative p-3 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
                title={hasFollowBadge ? `${item.label} (${pendingCount} follow request${pendingCount > 1 ? 's' : ''})` : item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                {hasFollowBadge && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-neutral-950 shadow-md shadow-cyan-500/30 animate-pulse">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / User & Theme */}
      <div className="flex flex-col items-center gap-3">
        {/* PWA Download / Install App */}
        <PWAInstallButton variant="sidebar" />

        {/* Lock App */}
        <button
          onClick={() => {
            sessionStorage.removeItem('chatcon_app_unlocked');
            window.dispatchEvent(new CustomEvent('chatcon:lock-app'));
          }}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-900 transition-colors"
          title="Lock Chatcon App (Passcode: 4268)"
        >
          <Lock className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Avatar */}
        <div
          onClick={() => setActiveTab('settings')}
          className="relative cursor-pointer group"
          title={profile?.displayName || 'Profile'}
        >
          <img
            src={profile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.username}`}
            alt="Profile"
            className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-red-500/80 p-0.5 object-cover group-hover:border-red-400 transition-colors"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-neutral-950 rounded-full" />
        </div>
      </div>
    </aside>
  );
};
