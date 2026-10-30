import React, { useEffect, useState, useRef } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useUI } from '../../context/UIContext';
import { useCall } from '../../context/CallContext';
import {
  Bell,
  X,
  ArrowRight,
  Phone,
  Video,
  Lock,
  MessageSquare,
  Users,
  Check,
  UserPlus,
  UserCheck
} from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { latestToast, dismissToast } = useNotifications();
  const { openChat, setActiveTab } = useUI();
  const { startCall } = useCall();

  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const TOAST_DURATION_MS = 6000;

  useEffect(() => {
    if (!latestToast) return;
    setProgress(100);

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isHovered) return;
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / TOAST_DURATION_MS) * 100);
      setProgress(remainingPct);

      if (elapsed >= TOAST_DURATION_MS) {
        clearInterval(interval);
        dismissToast();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [latestToast, isHovered, dismissToast]);

  if (!latestToast) return null;

  const isCall = latestToast.type === 'call';
  const isMessage = latestToast.type === 'message';
  const isPrivateInvite = latestToast.type === 'private_invite';
  const isGroupInvite = latestToast.type === 'group_invite';
  const isFollowRequest = latestToast.type === 'follow_request';
  const isFollowAccepted = latestToast.type === 'follow_accepted';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed top-4 right-4 z-50 max-w-sm w-full bg-neutral-900/95 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in slide-in-from-top-4 duration-200 select-none"
    >
      {/* Auto-dismiss progress line */}
      <div className="w-full bg-neutral-800 h-1">
        <div
          className={`h-full transition-all duration-75 ${
            isCall
              ? 'bg-cyan-500'
              : isFollowRequest
              ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
              : isFollowAccepted
              ? 'bg-emerald-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Category Icon Badge */}
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isCall
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : isFollowRequest
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : isFollowAccepted
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isPrivateInvite
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : isGroupInvite
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {isCall ? (
                <Phone className="w-4 h-4" />
              ) : isFollowRequest ? (
                <UserPlus className="w-4 h-4" />
              ) : isFollowAccepted ? (
                <UserCheck className="w-4 h-4" />
              ) : isPrivateInvite ? (
                <Lock className="w-4 h-4" />
              ) : isGroupInvite ? (
                <Users className="w-4 h-4" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  {isCall
                    ? 'Call Alert'
                    : isFollowRequest
                    ? 'Follow Request'
                    : isFollowAccepted
                    ? 'Follow Accepted'
                    : isPrivateInvite
                    ? 'Private Room'
                    : isGroupInvite
                    ? 'Group'
                    : 'Chat'}
                </span>
                <span className="text-neutral-600 text-xs">•</span>
                <span className="text-[10px] text-neutral-500">Just now</span>
              </div>
              <h5 className="text-xs font-bold text-white truncate">{latestToast.title}</h5>
              <p className="text-xs text-neutral-300 mt-0.5 line-clamp-2 leading-relaxed">
                {latestToast.body}
              </p>
            </div>
          </div>

          <button
            onClick={dismissToast}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons based on notification category */}
        {isFollowRequest && (
          <button
            onClick={() => {
              setActiveTab('chats');
              dismissToast();
            }}
            className="mt-3 w-full py-1.5 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-600/30"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>View Requests & Confirm</span>
          </button>
        )}

        {isFollowAccepted && latestToast.chatId && (
          <button
            onClick={() => {
              if (latestToast.chatId) {
                openChat(latestToast.chatId, 'private');
              }
              dismissToast();
            }}
            className="mt-3 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/30"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Chat & View Phone</span>
          </button>
        )}

        {isCall && latestToast.senderId && (
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-neutral-800/80">
            <button
              onClick={() => {
                startCall(
                  latestToast.senderId!,
                  latestToast.title.replace('Missed Call', 'Contact').trim(),
                  '',
                  'voice'
                );
                dismissToast();
              }}
              className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-600/30"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Back</span>
            </button>
            <button
              onClick={() => {
                startCall(
                  latestToast.senderId!,
                  latestToast.title.replace('Missed Call', 'Contact').trim(),
                  '',
                  'video'
                );
                dismissToast();
              }}
              className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video</span>
            </button>
          </div>
        )}

        {!isFollowRequest && !isFollowAccepted && latestToast.chatId && (
          <button
            onClick={() => {
              if (latestToast.chatId) {
                openChat(latestToast.chatId, 'private');
              }
              dismissToast();
            }}
            className="mt-3 w-full py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-600/30"
          >
            <span>Open Conversation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
