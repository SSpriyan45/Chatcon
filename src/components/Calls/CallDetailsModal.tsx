import React from 'react';
import {
  X,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MessageSquare,
  Clock,
  HardDrive,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { CallSession } from '../../types';
import { formatDuration } from '../../utils/formatters';

interface CallDetailsModalProps {
  call: CallSession | null;
  currentUserId: string;
  onClose: () => void;
  onStartVoice: (id: string, name: string, photo: string) => void;
  onStartVideo: (id: string, name: string, photo: string) => void;
  onOpenChat: (userId: string) => void;
  onDelete: (callId: string) => void;
}

export const CallDetailsModal: React.FC<CallDetailsModalProps> = ({
  call,
  currentUserId,
  onClose,
  onStartVoice,
  onStartVideo,
  onOpenChat,
  onDelete,
}) => {
  if (!call) return null;

  const isCaller = call.callerId === currentUserId;
  const otherName = isCaller ? call.receiverName : call.callerName;
  const otherPhoto = isCaller ? call.receiverPhoto : call.callerPhoto;
  const otherId = isCaller ? call.receiverId : call.callerId;
  const isMissed = call.status === 'missed' || call.status === 'rejected';

  // Format exact date & time
  const dateObj = new Date(call.createdAt);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate approximate data used
  const durationSec = call.duration || 0;
  const estimatedMB =
    call.type === 'video'
      ? ((durationSec * 250) / 1024).toFixed(1) // ~250 KB/s for video
      : ((durationSec * 32) / 1024).toFixed(1); // ~32 KB/s for audio

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#111b21] border border-neutral-800 rounded-3xl p-6 shadow-2xl relative flex flex-col overflow-hidden text-neutral-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-xl hover:bg-neutral-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Avatar & Name */}
        <div className="flex flex-col items-center text-center mb-6 pt-2">
          <div className="relative mb-3">
            <img
              src={otherPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherName}`}
              alt={otherName}
              className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/40 shadow-xl"
            />
            <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#111b21] border border-neutral-700 text-emerald-400">
              {call.type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            </div>
          </div>

          <h3 className="text-lg font-bold text-white mb-0.5">{otherName}</h3>
          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-end encrypted call</span>
          </p>
        </div>

        {/* Action Buttons: Message, Voice, Video */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenChat(otherId);
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors text-white text-xs font-semibold"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span>Message</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartVoice(otherId, otherName, otherPhoto || '');
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors text-white text-xs font-semibold"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <span>Voice Call</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartVideo(otherId, otherName, otherPhoto || '');
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors text-white text-xs font-semibold"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <span>Video Call</span>
          </button>
        </div>

        {/* Call Metadata Details */}
        <div className="p-4 rounded-2xl bg-[#0b141a] border border-neutral-800/80 space-y-3 mb-5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              {isMissed ? (
                <PhoneMissed className="w-4 h-4 text-rose-500" />
              ) : isCaller ? (
                <PhoneOutgoing className="w-4 h-4 text-emerald-400" />
              ) : (
                <PhoneIncoming className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-medium text-white">
                {isMissed
                  ? 'Missed call'
                  : isCaller
                  ? 'Outgoing call'
                  : 'Incoming call'}
              </span>
            </div>
            <span className="text-neutral-400 text-[11px] font-mono">
              {formattedDate}, {formattedTime}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-800/60">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" /> Duration
            </span>
            <span className="font-mono text-neutral-200">
              {durationSec > 0 ? formatDuration(durationSec) : 'Not answered'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-800/60">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-neutral-500" /> Data transferred
            </span>
            <span className="font-mono text-neutral-200">
              {durationSec > 0 ? `${estimatedMB} MB (HD)` : '0 KB'}
            </span>
          </div>
        </div>

        {/* Delete Call Log */}
        <button
          type="button"
          onClick={() => {
            onDelete(call.id);
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete from call history</span>
        </button>
      </div>
    </div>
  );
};
