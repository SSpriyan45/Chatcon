import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider, useUI } from './context/UIContext';
import { FollowProvider } from './context/FollowContext';
import { CallProvider, useCall } from './context/CallContext';
import { NotificationProvider } from './context/NotificationContext';
import { CallType } from './types';

import { AuthScreen } from './components/Auth/AuthScreen';
import { AppLockScreen } from './components/Auth/AppLockScreen';
import { useAutoLock } from './hooks/useAutoLock';
import { Sidebar } from './components/Navigation/Sidebar';
import { BottomNav } from './components/Navigation/BottomNav';
import { GlobalAnnouncementBanner } from './components/Navigation/GlobalAnnouncementBanner';
import { NotificationToast } from './components/Navigation/NotificationToast';
import { NotificationsDrawer } from './components/Navigation/NotificationsDrawer';

import { ChatListScreen } from './components/Chat/ChatListScreen';
import { ChatArea } from './components/Chat/ChatArea';
import { StatusScreen } from './components/Status/StatusScreen';
import { CallsScreen } from './components/Calls/CallsScreen';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { AdminDashboard } from './components/Admin/AdminDashboard';

import { CreatePrivateRoomModal } from './components/Modals/CreatePrivateRoomModal';
import { NewChatModal } from './components/Modals/NewChatModal';
import { NewGroupModal } from './components/Modals/NewGroupModal';
import { ReportModal } from './components/Modals/ReportModal';
import { ActiveCallModal } from './components/Calls/ActiveCallModal';
import { PrivateRoomInviteModal } from './components/Modals/PrivateRoomInviteModal';
import { LocationViewerModal } from './components/Modals/LocationViewerModal';
import { MandatoryPhoneModal } from './components/Modals/MandatoryPhoneModal';
import { PWAInstallModal } from './components/PWA/PWAInstallModal';
import { PWAInstallButton } from './components/PWA/PWAInstallButton';

import { MessageSquare, ShieldCheck, Lock, Sparkles, Download } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, profile, loading } = useAuth();
  const {
    activeTab,
    selectedChatId,
    selectedChatType,
    setIsPrivateRoomModalOpen,
  } = useUI();
  const { joinCallLink } = useCall();

  // Handle joining call via shareable link (#call-link?id=...&type=...)
  React.useEffect(() => {
    if (!currentUser) return;
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.includes('call-link')) {
        const queryPart = hash.split('?')[1];
        if (queryPart) {
          const urlParams = new URLSearchParams(queryPart);
          const callId = urlParams.get('id');
          const type = (urlParams.get('type') as CallType) || 'video';
          const host = urlParams.get('host') || 'Call Host';
          if (callId) {
            window.history.replaceState(null, '', window.location.pathname);
            joinCallLink(callId, type, decodeURIComponent(host));
          }
        }
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [currentUser, joinCallLink]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white gap-4">
        <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/30 ring-4 ring-blue-500/40 animate-pulse bg-neutral-950">
          <img
            src="/logo.png"
            alt="Chatcon"
            className="w-full h-full object-cover scale-[1.05] origin-center"
            referrerPolicy="no-referrer"
          />
        </div>
        <p
          className="text-xs text-neutral-400 tracking-wider uppercase font-extrabold flex items-center gap-1"
          style={{ fontFamily: "'Nunito', sans-serif" }}
        >
          <span>Connecting to</span>
          <span className="text-white">CHAT</span>
          <span className="bg-gradient-to-r from-sky-400 to-purple-500 bg-clip-text text-transparent">CON</span>
          <span>...</span>
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  // Account suspended check
  if (profile?.isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-950 text-center">
        <div className="max-w-md p-8 rounded-3xl bg-neutral-900 border border-red-500/40 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Account Suspended</h2>
          <p className="text-xs text-neutral-400 mb-6">
            Your account has been temporarily restricted by moderators for safety policy reviews.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold"
          >
            Check Status Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-neutral-950 overflow-hidden font-sans">
      {/* Global Announcements */}
      <GlobalAnnouncementBanner />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar */}
        <Sidebar />

        {activeTab === 'admin' ? (
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-neutral-950">
            <AdminDashboard />
          </div>
        ) : (
          <>
            {/* Master Navigation & Content List */}
            <div
              className={`flex-1 md:w-96 md:max-w-md md:flex-none flex flex-col h-full overflow-hidden ${
                selectedChatId ? 'hidden md:flex' : 'flex'
              }`}
            >
              {activeTab === 'chats' && <ChatListScreen />}
              {activeTab === 'status' && <StatusScreen />}
              {activeTab === 'calls' && <CallsScreen />}
              {activeTab === 'settings' && <SettingsScreen />}
            </div>

            {/* Detail Pane (Chat Area or Placeholder) */}
            <div
              className={`flex-1 flex flex-col h-full overflow-hidden ${
                selectedChatId ? 'flex' : 'hidden md:flex'
              }`}
            >
              {selectedChatId && selectedChatType ? (
                <ChatArea chatId={selectedChatId} chatType={selectedChatType} />
              ) : (
                /* Desktop Default Placeholder */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-950/80 border-l border-neutral-900 text-center select-none">
                  <div className="relative mb-6">
                    <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/25 ring-4 ring-blue-500/40 bg-neutral-950">
                      <img
                        src="/logo.png"
                        alt="Chatcon"
                        className="w-full h-full object-cover scale-[1.05] origin-center"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 p-2 bg-neutral-900 rounded-full border border-neutral-700 text-blue-400 shadow-md">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <h2
                    className="text-2xl font-extrabold text-white mb-2 tracking-wider flex items-center justify-center"
                    style={{ fontFamily: "'Nunito', sans-serif" }}
                  >
                    <span className="text-white">CHAT</span>
                    <span className="bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent ml-0.5">
                      CON
                    </span>
                    <span className="text-neutral-400 text-base font-normal ml-2 font-sans">for Web</span>
                  </h2>
                  <p className="text-sm text-neutral-400 max-w-sm mb-6 leading-relaxed">
                    Send and receive messages with end-to-end security. Create exclusive 2-user private lock
                    rooms, launch WebRTC video calls, and share disappearing status updates.
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPrivateRoomModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all shadow-lg shadow-red-600/30 flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>New 2-User Private Room</span>
                    </button>
                    <PWAInstallButton variant="header" className="!py-2.5 !px-4 !text-xs font-semibold" />
                  </div>

                  <div className="mt-12 flex items-center gap-2 text-xs text-neutral-400">
                    <Lock className="w-3.5 h-3.5 text-red-400" />
                    <span>Protected by Cloud Firestore & Firebase Auth</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Modals & Overlays */}
      <MandatoryPhoneModal />
      <CreatePrivateRoomModal />
      <NewChatModal />
      <NewGroupModal />
      <ReportModal />
      <ActiveCallModal />
      <PrivateRoomInviteModal />
      <LocationViewerModal />
      <PWAInstallModal />
      <NotificationToast />
      <NotificationsDrawer />
    </div>
  );
};


export default function App() {
  const [isUnlocked, setIsUnlocked] = React.useState<boolean>(() => {
    return sessionStorage.getItem('chatcon_app_unlocked') === 'true';
  });

  // Automatically lock the app after user-configured period of inactivity (default 5 min)
  useAutoLock(isUnlocked);

  React.useEffect(() => {
    const handleLock = () => {
      sessionStorage.removeItem('chatcon_app_unlocked');
      setIsUnlocked(false);
    };
    window.addEventListener('chatcon:lock-app', handleLock);
    return () => window.removeEventListener('chatcon:lock-app', handleLock);
  }, []);

  const handleUnlock = () => {
    sessionStorage.setItem('chatcon_app_unlocked', 'true');
    setIsUnlocked(true);
  };

  if (!isUnlocked) {
    return <AppLockScreen onUnlock={handleUnlock} />;
  }

  return (
    <AuthProvider>
      <UIProvider>
        <FollowProvider>
          <CallProvider>
            <NotificationProvider>
              <MainLayout />
            </NotificationProvider>
          </CallProvider>
        </FollowProvider>
      </UIProvider>
    </AuthProvider>
  );
}
