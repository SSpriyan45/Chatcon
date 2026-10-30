import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Radio,
  Clock,
  StopCircle,
  Compass
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { useUI } from '../../context/UIContext';
import { liveLocationManager } from '../../utils/liveLocation';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

interface LocationMessageCardProps {
  message: ChatMessage;
  isMe: boolean;
  chatId: string;
  chatType: 'private' | 'group';
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const LocationMessageCard: React.FC<LocationMessageCardProps> = ({
  message,
  isMe,
  chatId,
  chatType,
}) => {
  const { openLocationViewer } = useUI();
  const [stopping, setStopping] = useState(false);

  if (!message.location) return null;

  const {
    latitude,
    longitude,
    name,
    address,
    accuracy,
    isLive,
    liveUntil,
    liveEnded,
  } = message.location;

  const isStillLive = isLive && !liveEnded && liveUntil && Date.now() < liveUntil;

  // Format time remaining for live location
  const getTimeRemainingText = () => {
    if (!liveUntil) return '';
    const diffMs = liveUntil - Date.now();
    if (diffMs <= 0) return 'Ended';
    const mins = Math.ceil(diffMs / (60 * 1000));
    if (mins > 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours}h ${remMins}m left`;
    }
    return `${mins}m left`;
  };

  const handleCardClick = () => {
    openLocationViewer({
      latitude,
      longitude,
      name,
      address,
      accuracy,
      isLive,
      liveUntil,
      liveEnded,
      senderName: message.senderName,
      senderPhoto: message.senderPhoto,
      senderId: message.senderId,
      messageId: message.id,
      chatId,
      chatType,
    });
  };

  const handleStopSharing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStopping(true);
    try {
      await liveLocationManager.stopTracking(message.id, true);
      const collName = chatType === 'private' ? 'privateChats' : 'groups';
      await updateDoc(doc(db, collName, chatId, 'messages', message.id), {
        'location.liveEnded': true,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Failed to stop live location:', err);
    } finally {
      setStopping(false);
    }
  };

  // Google Static Map URL or Styled Map fallback
  const staticMapUrl = GOOGLE_MAPS_API_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=400x200&scale=2&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
    : `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=15&l=map&size=400,200&pt=${longitude},${latitude},pm2rdm`;

  return (
    <div
      onClick={handleCardClick}
      className="mb-1 rounded-2xl overflow-hidden bg-neutral-900/90 border border-neutral-750/70 hover:border-emerald-500/50 shadow-md cursor-pointer transition-all group max-w-sm select-none"
    >
      {/* Map Thumbnail Header */}
      <div className="relative w-full h-36 bg-neutral-950 overflow-hidden">
        {/* Map image with subtle zoom on hover */}
        <img
          src={staticMapUrl}
          alt={name || 'Location map'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            // If image fails, replace with sleek dark map placeholder
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Center Marker Pin Overlay (WhatsApp Style) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {isStillLive ? (
            <div className="relative flex items-center justify-center">
              <span className="w-10 h-10 rounded-full bg-emerald-400/40 animate-ping absolute" />
              <div className="w-9 h-9 rounded-full border-2 border-white bg-emerald-500 shadow-xl overflow-hidden flex items-center justify-center">
                {message.senderPhoto ? (
                  <img
                    src={message.senderPhoto}
                    alt={message.senderName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Radio className="w-4 h-4 text-white" />
                )}
              </div>
            </div>
          ) : (
            <div className="relative -mt-4 animate-bounce">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center border-2 border-white">
                <MapPin className="w-4 h-4 fill-white" />
              </div>
              <div className="w-2 h-1 bg-black/40 rounded-full mx-auto mt-0.5 blur-[1px]" />
            </div>
          )}
        </div>

        {/* Live Location Tag (Top Left) */}
        {isLive && (
          <div className="absolute top-2 left-2 z-10">
            {isStillLive ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>Live Location • {getTimeRemainingText()}</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-neutral-900/80 backdrop-blur-md text-neutral-400 text-[10px] font-medium shadow-md">
                Live location ended
              </span>
            )}
          </div>
        )}

        {/* Tap to expand hint (Top Right) */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <span className="p-1.5 rounded-lg bg-neutral-900/80 backdrop-blur-md text-white text-[10px] flex items-center gap-1 shadow">
            <Compass className="w-3 h-3 text-emerald-400" />
            <span>Open</span>
          </span>
        </div>
      </div>

      {/* Info & Details Section */}
      <div className="p-3 bg-neutral-900 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{name || (isLive ? 'Live Location' : 'Current Location')}</span>
            </h4>
            <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
              {address || (accuracy ? `Accurate to ${accuracy}m` : 'Shared GPS location')}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
              title="Get Directions"
            >
              <Navigation className="w-3.5 h-3.5" />
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Open in Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Live Location Stop Button (For Sender) */}
        {isStillLive && isMe && (
          <div className="pt-1.5 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={handleStopSharing}
              disabled={stopping}
              className="w-full py-1.5 px-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-400 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>{stopping ? 'Stopping Live Location...' : 'Stop Sharing Live Location'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
