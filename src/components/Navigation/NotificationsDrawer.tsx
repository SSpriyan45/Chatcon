import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useUI } from '../../context/UIContext';
import { useCall } from '../../context/CallContext';
import { useFollow } from '../../context/FollowContext';
import { formatMessageTime } from '../../utils/formatters';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  MessageSquare,
  Phone,
  Video,
  Lock,
  Users,
  ExternalLink,
  Sparkles,
  Sliders,
  Check,
  UserPlus,
  UserCheck
} from 'lucide-react';

export const NotificationsDrawer: React.FC = () => {
  const { isNotificationsOpen, setIsNotificationsOpen, openChat, setActiveTab } = useUI();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    hasPushPermission,
    requestPushPermission,
    sendTestAlert,
    settings,
  } = useNotifications();
  const { startCall } = useCall();
  const { incomingRequests, acceptFollowRequest, declineFollowRequest } = useFollow();

  const [filter, setFilter] = useState<'all' | 'unread' | 'calls' | 'messages' | 'invites'>('all');

  if (!isNotificationsOpen) return null;

  const filteredList = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'calls') return n.type === 'call';
    if (filter === 'messages') return n.type === 'message';
    if (filter === 'invites') return n.type === 'private_invite' || n.type === 'group_invite' || n.type === 'follow_request' || n.type === 'follow_accepted';
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-red-400" />;
      case 'call':
        return <Phone className="w-4 h-4 text-cyan-400" />;
      case 'private_invite':
        return <Lock className="w-4 h-4 text-purple-400" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-amber-400" />;
      case 'follow_request':
        return <UserPlus className="w-4 h-4 text-cyan-400" />;
      case 'follow_accepted':
        return <UserCheck className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-red-400" />;
    }
  };

  const handleItemClick = (item: any) => {
    markAsRead(item.id);
    if (item.chatId) {
      openChat(item.chatId, 'private');
      setIsNotificationsOpen(false);
    }
  };

  const handleOpenSettings = () => {
    setActiveTab('settings');
    setIsNotificationsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-bold border border-red-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">Alerts for calls, messages & private invites</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenSettings}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Alert Preferences"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsNotificationsOpen(false)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Push Notification Banner */}
        {!hasPushPermission && (
          <div className="px-4 py-3 bg-red-950/40 border-b border-red-800/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-red-300">
              <Sparkles className="w-4 h-4 shrink-0 text-red-400" />
              <span>Enable desktop & mobile push alerts for calls & messages</span>
            </div>
            <button
              onClick={() => requestPushPermission()}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold shrink-0 transition-colors shadow-sm"
            >
              Enable
            </button>
          </div>
        )}

        {/* Quick Test Alert Strip */}
        <div className="px-4 py-2 bg-neutral-950/70 border-b border-neutral-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-neutral-400">
            Call alerts: <strong className={settings.callAlerts ? 'text-emerald-400' : 'text-neutral-500'}>{settings.callAlerts ? 'Active' : 'Muted'}</strong> ({settings.ringtoneType} ring)
          </span>
          <button
            onClick={sendTestAlert}
            className="text-[11px] text-red-400 hover:text-red-300 font-semibold hover:underline"
          >
            Test Alert Sound
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between shrink-0 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                filter === 'unread'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('calls')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                filter === 'calls'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              Calls
            </button>
            <button
              onClick={() => setFilter('messages')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                filter === 'messages'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white'
              }`}
            >
              Chats
            </button>
          </div>

          <div className="flex items-center gap-1 pl-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 custom-scrollbar">
          {filteredList.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-3 h-full">
              <div className="w-12 h-12 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-600">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs">
                {filter === 'unread'
                  ? 'No unread notifications.'
                  : filter === 'calls'
                  ? 'No call alerts recorded.'
                  : 'No notifications found.'}
              </p>
            </div>
          ) : (
            filteredList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group relative ${
                  !item.read ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-neutral-800/40'
                }`}
              >
                {/* Unread indicator */}
                {!item.read && (
                  <span className="absolute top-4 left-1.5 w-1.5 h-1.5 rounded-full bg-red-400 ring-2 ring-red-400/20" />
                )}

                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h4
                      className={`text-xs font-semibold truncate ${
                        !item.read ? 'text-white' : 'text-neutral-300'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-neutral-500 shrink-0">
                      {formatMessageTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>

                  {/* Context Actions for Follow Requests */}
                  {item.type === 'follow_request' && (
                    <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={async () => {
                          const targetReq = incomingRequests.find(
                            (r) => r.id === item.requestId || r.senderId === item.senderId
                          );
                          if (targetReq) {
                            const newChatId = await acceptFollowRequest(targetReq);
                            markAsRead(item.id);
                            if (newChatId) {
                              openChat(newChatId, 'private');
                              setIsNotificationsOpen(false);
                            }
                          } else {
                            setActiveTab('chats');
                            setIsNotificationsOpen(false);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Check className="w-3 h-3" />
                        <span>Confirm & Chat</span>
                      </button>
                      <button
                        onClick={async () => {
                          const targetReq = incomingRequests.find(
                            (r) => r.id === item.requestId || r.senderId === item.senderId
                          );
                          if (targetReq) {
                            await declineFollowRequest(targetReq.id);
                          }
                          deleteNotification(item.id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold transition-colors"
                      >
                        <span>Decline</span>
                      </button>
                    </div>
                  )}

                  {/* Context Actions for Follow Accepted */}
                  {item.type === 'follow_accepted' && item.chatId && (
                    <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          markAsRead(item.id);
                          openChat(item.chatId!, 'private');
                          setIsNotificationsOpen(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Start Chat & View Number</span>
                      </button>
                    </div>
                  )}

                  {/* Context Actions for Calls */}
                  {item.type === 'call' && item.senderId && (
                    <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          startCall(item.senderId, item.title.replace('Missed Call', 'Contact').trim(), '', 'voice');
                          setIsNotificationsOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-all shadow-sm shadow-red-600/30"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call Back</span>
                      </button>
                      <button
                        onClick={() => {
                          startCall(item.senderId, item.title.replace('Missed Call', 'Contact').trim(), '', 'video');
                          setIsNotificationsOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Video className="w-3 h-3" />
                        <span>Video</span>
                      </button>
                    </div>
                  )}

                  {item.chatId && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400 group-hover:underline">
                      <span>Open chat</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(item.id);
                  }}
                  className="absolute top-3.5 right-3 p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete notification"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
