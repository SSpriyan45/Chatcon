import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from '../../types';
import { formatMessageTime } from '../../utils/formatters';
import { useUI } from '../../context/UIContext';
import { LocationMessageCard } from './LocationMessageCard';
import {
  Check,
  CheckCheck,
  Star,
  CornerUpLeft,
  Copy,
  Edit2,
  Trash2,
  Flag,
  MoreVertical,
  Play,
  Pause,
  FileText,
  MapPin,
  User,
  Download,
  Smile,
  Plus,
  X
} from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  onReply: (msg: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onStar: (messageId: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onReport: (message: ChatMessage) => void;
  currentUserId: string;
  userNameMap?: Record<string, string>;
}

const POPULAR_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];
const EXTENDED_EMOJIS = [
  '👏', '💯', '✨', '😍', '🥳', '🤔',
  '👀', '💪', '🚀', '🥰', '💔', '🤝',
  '⚡', '🤩', '😎', '🫡', '🏆', '☕',
  '💡', '📌', '🤤', '😴', '🙌', '🎈'
];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  onReply,
  onReact,
  onStar,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReport,
  currentUserId,
  userNameMap,
}) => {
  const { selectedChatId, selectedChatType } = useUI();
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showExtendedPicker, setShowExtendedPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [viewingDetailsFor, setViewingDetailsFor] = useState<{ emoji: string; uids: string[] } | null>(null);

  const lastClickRef = useRef<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  // Hidden if deleted for this user
  if (message.deletedFor?.includes(currentUserId)) {
    return null;
  }

  const isStarred = message.starredBy?.includes(currentUserId);

  // Close emoji picker on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
        setShowExtendedPicker(false);
      }
    };

    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const triggerLongPress = useCallback(() => {
    isLongPressTriggeredRef.current = true;
    setIsPressing(false);
    setShowEmojiPicker(true);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (_) {}
    }
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  // Touch event handlers for long press
  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPressTriggeredRef.current = false;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    setIsPressing(true);

    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      triggerLongPress();
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    cancelLongPress();
    if (isLongPressTriggeredRef.current) {
      e.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastClickRef.current < 320) {
      e.stopPropagation();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
      onReact(message.id, '❤️');
      lastClickRef.current = 0;
    } else {
      lastClickRef.current = now;
    }
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) return;
    const now = Date.now();
    if (now - lastClickRef.current < 320) {
      // Double click to react with ❤️
      e.stopPropagation();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
      onReact(message.id, '❤️');
      lastClickRef.current = 0;
    } else {
      lastClickRef.current = now;
    }
  };

  // Mouse event handlers for desktop click-and-hold
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger for primary left click
    if (e.button !== 0) return;
    isLongPressTriggeredRef.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);

    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      triggerLongPress();
    }, 450);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartPosRef.current) return;
    const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Right click also triggers emoji reaction picker quickly
    e.preventDefault();
    cancelLongPress();
    setShowEmojiPicker(true);
  };

  const togglePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
    }
    setShowMenu(false);
  };

  const handleReactionClick = (emoji: string) => {
    onReact(message.id, emoji);
    setShowEmojiPicker(false);
    setShowExtendedPicker(false);
  };

  if (message.isDeletedForEveryone) {
    return (
      <div className={`flex w-full my-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[75%] px-3.5 py-2 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-xs italic flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
          <span>This message was deleted</span>
          <span className="text-[10px] text-neutral-500 not-italic ml-1">
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // Determine read status
  const isRead = message.readBy && message.readBy.length > 1;
  const isDelivered = message.deliveredTo && message.deliveredTo.length > 0;

  return (
    <div className={`group flex flex-col my-1 relative ${isMe ? 'items-end' : 'items-start'}`}>
      {/* Floating Emoji Reaction Bar (on long press or hover action) */}
      {showEmojiPicker && (
        <div
          ref={pickerRef}
          className={`absolute -top-12 sm:-top-13 z-40 bg-neutral-900/95 border border-neutral-700/80 px-2.5 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-1.5 animate-in zoom-in-90 duration-150 ${
            isMe ? 'right-0' : 'left-0'
          }`}
        >
          {POPULAR_EMOJIS.map((emoji) => {
            const isSelected = message.reactions?.[emoji]?.includes(currentUserId);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReactionClick(emoji)}
                className={`text-xl sm:text-2xl hover:scale-130 active:scale-95 transition-transform px-1 py-0.5 rounded-full ${
                  isSelected ? 'bg-red-500/25 ring-2 ring-red-500/60' : 'hover:bg-neutral-800/80'
                }`}
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}

          {/* Plus button to show extended emojis */}
          <button
            type="button"
            onClick={() => setShowExtendedPicker((prev) => !prev)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              showExtendedPicker ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
            }`}
            title="More emojis"
          >
            {showExtendedPicker ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          {/* Extended emoji picker dropdown panel */}
          {showExtendedPicker && (
            <div
              className={`absolute top-11 z-50 bg-neutral-900/98 border border-neutral-700/90 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md grid grid-cols-6 gap-1 w-64 animate-in slide-in-from-top-2 duration-150 ${
                isMe ? 'right-0' : 'left-0'
              }`}
            >
              {EXTENDED_EMOJIS.map((emoji) => {
                const isSelected = message.reactions?.[emoji]?.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReactionClick(emoji)}
                    className={`text-xl p-1.5 rounded-xl hover:scale-125 active:scale-90 transition-transform flex items-center justify-center ${
                      isSelected ? 'bg-red-500/25 ring-1 ring-red-500' : 'hover:bg-neutral-800'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bubble Container with Long-Press Handlers */}
      <div className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[70%]">
        {!isMe && message.senderPhoto && (
          <img
            src={message.senderPhoto}
            alt={message.senderName}
            className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 mb-1 shrink-0"
          />
        )}

        <div
          ref={bubbleRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={cancelLongPress}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleBubbleClick}
          onMouseLeave={cancelLongPress}
          onContextMenu={handleContextMenu}
          className={`relative rounded-2xl px-3.5 py-2 text-sm shadow-md transition-all select-none cursor-pointer duration-150 ${
            isMe
              ? 'bg-red-700 text-white rounded-tr-none'
              : 'bg-neutral-800 text-neutral-100 rounded-tl-none border border-neutral-700/50'
          } ${isPressing ? 'scale-[0.98] brightness-110 shadow-lg ring-2 ring-red-500/40' : ''}`}
          title="Double-click to ❤️ | Long press to react"
        >
          {/* Heart burst animation on double tap/click */}
          {showHeartBurst && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in zoom-in-50 duration-200">
              <span className="text-4xl animate-bounce drop-shadow-lg">❤️</span>
            </div>
          )}

          {/* Group Sender Name */}
          {!isMe && (
            <div className="text-[11px] font-semibold text-red-400 mb-0.5">
              {message.senderName}
            </div>
          )}

          {/* Reply Quote Block */}
          {message.replyTo && (
            <div
              className={`mb-2 p-2 rounded-lg border-l-4 text-xs ${
                isMe
                  ? 'bg-red-800/80 border-red-300 text-red-100'
                  : 'bg-neutral-900/80 border-red-500 text-neutral-300'
              }`}
            >
              <div className="font-semibold text-[11px] text-red-300">{message.replyTo.senderName}</div>
              <div className="truncate text-[11px] opacity-90">{message.replyTo.text || `[${message.replyTo.type}]`}</div>
            </div>
          )}

          {/* Media Content */}
          {message.type === 'image' && message.mediaUrl && (
            <div className="mb-2 rounded-xl overflow-hidden max-w-sm max-h-72 border border-black/10">
              <img
                src={message.mediaUrl}
                alt="Image attachment"
                className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={(e) => {
                  if (isLongPressTriggeredRef.current) return;
                  e.stopPropagation();
                  window.open(message.mediaUrl, '_blank');
                }}
              />
            </div>
          )}

          {message.type === 'video' && message.mediaUrl && (
            <div className="mb-2 rounded-xl overflow-hidden max-w-sm">
              <video
                src={message.mediaUrl}
                controls
                className="w-full rounded-xl max-h-72 object-cover"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {message.type === 'audio' && message.mediaUrl && (
            <div className="mb-2 flex items-center gap-3 py-1 min-w-[200px]">
              <audio
                ref={audioRef}
                src={message.mediaUrl}
                onEnded={() => setIsPlayingAudio(false)}
                className="hidden"
              />
              <button
                type="button"
                onClick={togglePlayAudio}
                className="w-9 h-9 rounded-full bg-white text-red-800 flex items-center justify-center shrink-0 shadow active:scale-95 transition-transform"
              >
                {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <div className="flex-1">
                {/* Visualizer bars */}
                <div className="flex items-center gap-0.5 h-6">
                  {[40, 70, 30, 90, 60, 100, 50, 80, 45, 65, 35, 85, 55, 95].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className={`w-1 rounded-full ${isPlayingAudio ? 'bg-white animate-pulse' : 'bg-white/60'}`}
                    />
                  ))}
                </div>
                <div className="text-[10px] text-white/80 mt-0.5 font-mono">
                  Voice Note {message.duration ? `(${message.duration}s)` : ''}
                </div>
              </div>
            </div>
          )}

          {message.type === 'document' && (
            <div className="mb-2 p-2.5 rounded-xl bg-black/20 flex items-center gap-3">
              <FileText className="w-8 h-8 text-white/90 shrink-0" />
              <div className="flex-1 truncate">
                <div className="text-xs font-medium truncate">{message.fileName || 'Attachment Document'}</div>
                <div className="text-[10px] text-white/70">{message.fileSize || 'File'}</div>
              </div>
              {message.mediaUrl && (
                <a
                  href={message.mediaUrl}
                  download={message.fileName || 'file'}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          {message.type === 'location' && message.location && (
            <LocationMessageCard
              message={message}
              isMe={isMe}
              chatId={selectedChatId || ''}
              chatType={selectedChatType || 'private'}
            />
          )}

          {message.type === 'contact' && message.contact && (
            <div className="mb-2 p-2.5 rounded-xl bg-black/20 flex items-center gap-3 min-w-[180px]">
              <div className="w-8 h-8 rounded-full bg-red-500 text-neutral-950 flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">{message.contact.name}</div>
                <div className="text-[10px] text-white/80">{message.contact.phone || `@${message.contact.username}`}</div>
              </div>
            </div>
          )}

          {/* Text Message */}
          {message.text && (
            <p className="whitespace-pre-wrap break-words leading-relaxed select-text">
              {message.text}
            </p>
          )}

          {/* Time, Star & Read Receipt status */}
          <div className="flex items-center justify-end gap-1 text-[10px] mt-1 select-none opacity-80 float-right ml-3">
            {message.isEdited && <span className="italic mr-0.5">edited</span>}
            {isStarred && <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />}
            <span>{formatMessageTime(message.createdAt)}</span>

            {isMe && (
              <span title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}>
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300 stroke-[2.5]" />
                ) : isDelivered ? (
                  <CheckCheck className="w-3.5 h-3.5 text-neutral-300" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-neutral-300" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Button on Hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker((prev) => !prev);
            }}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="React (or long-press message)"
          >
            <Smile className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Options */}
            {showMenu && (
              <div
                className={`absolute bottom-6 z-40 w-48 bg-neutral-900 border border-neutral-700/80 rounded-2xl p-1.5 shadow-2xl text-xs text-neutral-200 ${
                  isMe ? 'right-0' : 'left-0'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left text-amber-300 font-medium"
                >
                  <Smile className="w-3.5 h-3.5 text-amber-400" /> React with emoji
                </button>

                {message.reactions && Object.keys(message.reactions).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstEmoji = Object.keys(message.reactions!)[0];
                      setViewingDetailsFor({ emoji: firstEmoji, uids: message.reactions![firstEmoji] || [] });
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left text-neutral-300"
                  >
                    <Smile className="w-3.5 h-3.5 text-red-400" /> View reactions
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { onReply(message); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                >
                  <CornerUpLeft className="w-3.5 h-3.5 text-red-400" /> Reply
                </button>

                <button
                  type="button"
                  onClick={() => { onStar(message.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                >
                  <Star className="w-3.5 h-3.5 text-amber-400" /> {isStarred ? 'Unstar' : 'Star message'}
                </button>

                {message.text && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-400" /> Copy text
                  </button>
                )}

                {isMe && message.type === 'text' && (
                  <button
                    type="button"
                    onClick={() => { onEdit(message); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-yellow-400" /> Edit message
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { onDeleteForMe(message.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete for me
                </button>

                {isMe && (
                  <button
                    type="button"
                    onClick={() => { onDeleteForEveryone(message.id); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left text-red-400 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { onReport(message); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left text-neutral-400 border-t border-neutral-800 mt-1 pt-1"
                >
                  <Flag className="w-3.5 h-3.5" /> Report message
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emoji Reactions Display Beneath the Message Bubble */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-1.5 mt-1 select-none z-10 animate-in zoom-in-95 duration-100 ${
            isMe ? 'justify-end pr-1' : 'justify-start pl-8.5'
          }`}
        >
          {Object.entries(message.reactions).map(([emoji, uids]) => {
            if (!uids || uids.length === 0) return null;
            const hasUserReacted = uids.includes(currentUserId);
            const count = uids.length;

            const reactorNames = uids.map((uid) => {
              if (uid === currentUserId) return 'You';
              return userNameMap?.[uid] || 'Someone';
            });

            let tooltip = '';
            if (reactorNames.length === 1) {
              tooltip = `${reactorNames[0]} reacted with ${emoji}`;
            } else if (reactorNames.length === 2) {
              tooltip = `${reactorNames[0]} and ${reactorNames[1]} reacted with ${emoji}`;
            } else {
              tooltip = `${reactorNames[0]}, ${reactorNames[1]} and ${reactorNames.length - 2} other${reactorNames.length > 3 ? 's' : ''} reacted with ${emoji}`;
            }

            return (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(message.id, emoji);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setViewingDetailsFor({ emoji, uids });
                }}
                className={`group/react inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition-all active:scale-90 shadow-sm border cursor-pointer ${
                  hasUserReacted
                    ? 'bg-red-950/80 border-red-500/60 text-red-300 ring-1 ring-red-500/30 font-medium'
                    : 'bg-neutral-900/90 border-neutral-700/70 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800'
                }`}
                title={`${tooltip} (Click to ${hasUserReacted ? 'remove' : 'add'}, Right-click for details)`}
              >
                <span className="text-sm group-hover/react:scale-125 transition-transform duration-100">
                  {emoji}
                </span>
                <span className={`text-[11px] font-semibold ${hasUserReacted ? 'text-red-300' : 'text-neutral-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Quick inline button to add more emoji reactions */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker((prev) => !prev);
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-900/90 border border-neutral-700/70 text-neutral-400 hover:text-white hover:border-neutral-500 text-xs transition-colors shadow-sm"
            title="Add reaction"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reaction Details Modal */}
      {viewingDetailsFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setViewingDetailsFor(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-xs shadow-2xl p-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{viewingDetailsFor.emoji}</span>
                <span className="text-sm font-semibold text-white">
                  Reactions ({viewingDetailsFor.uids.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingDetailsFor(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {viewingDetailsFor.uids.map((uid) => {
                const isCurrentUser = uid === currentUserId;
                const displayName = isCurrentUser ? 'You' : (userNameMap?.[uid] || 'User');
                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2 rounded-xl bg-neutral-800/60 border border-neutral-700/40"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-full bg-red-600/30 border border-red-500/40 text-red-200 flex items-center justify-center font-bold text-xs shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-neutral-200 block truncate">
                          {displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] text-red-400">Tap reaction badge to remove</span>
                        )}
                      </div>
                    </div>
                    <span className="text-lg shrink-0">{viewingDetailsFor.emoji}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
