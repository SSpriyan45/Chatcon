import React, { useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap
} from '@vis.gl/react-google-maps';
import {
  X,
  MapPin,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Clock,
  Layers,
  StopCircle,
  Share2
} from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { liveLocationManager } from '../../utils/liveLocation';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const LocationViewerModal: React.FC = () => {
  const { viewingLocation, closeLocationViewer } = useUI();
  const { currentUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [stoppingLive, setStoppingLive] = useState(false);

  if (!viewingLocation) return null;

  const {
    latitude,
    longitude,
    name,
    address,
    accuracy,
    isLive,
    liveUntil,
    liveEnded,
    senderName,
    senderPhoto,
    senderId,
    messageId,
    chatId,
    chatType
  } = viewingLocation;

  const isMe = currentUser?.uid === senderId;
  const isStillLive = isLive && !liveEnded && liveUntil && Date.now() < liveUntil;

  const handleStopSharing = async () => {
    if (!messageId || !chatId || !chatType) return;
    setStoppingLive(true);
    try {
      await liveLocationManager.stopTracking(messageId, true);
      const collName = chatType === 'private' ? 'privateChats' : 'groups';
      await updateDoc(doc(db, collName, chatId, 'messages', messageId), {
        'location.liveEnded': true,
        updatedAt: Date.now(),
      });
      closeLocationViewer();
    } catch (err) {
      console.warn('Failed to stop live sharing:', err);
    } finally {
      setStoppingLive(false);
    }
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const center = { lat: latitude, lng: longitude };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {senderPhoto ? (
              <img
                src={senderPhoto}
                alt={senderName || 'User'}
                className="w-9 h-9 rounded-full object-cover border border-neutral-700 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                <span>{name || 'Shared Location'}</span>
                {isStillLive && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" /> Live Location
                  </span>
                )}
                {isLive && !isStillLive && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                    Live Ended
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-neutral-400 truncate">
                {senderName ? `Shared by ${senderName}` : 'Location details'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMapType((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Toggle Satellite"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={closeLocationViewer}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full Interactive Google Map Container */}
        <div className="relative w-full h-72 sm:h-96 bg-neutral-950 overflow-hidden">
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} solutionChannel="GMP_aistudio_web">
              <Map
                center={center}
                zoom={16}
                mapId="DEMO_MAP_ID"
                mapTypeId={mapType}
                gestureHandling="greedy"
                className="w-full h-full"
                internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              >
                <AdvancedMarker position={center} title={name || 'Location'}>
                  {isStillLive ? (
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-10 h-10 rounded-full bg-emerald-400/40 animate-ping" />
                      <div className="w-11 h-11 rounded-full border-2 border-white bg-emerald-500 shadow-2xl overflow-hidden flex items-center justify-center">
                        {senderPhoto ? (
                          <img src={senderPhoto} alt="Live" className="w-full h-full object-cover" />
                        ) : (
                          <Radio className="w-6 h-6 text-white" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <Pin
                      background="#059669"
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={1.2}
                    />
                  )}
                </AdvancedMarker>
              </Map>
            </APIProvider>
          ) : (
            <iframe
              title="Location Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`}
              className="w-full h-full"
            />
          )}

          {/* Live countdown pill */}
          {isStillLive && liveUntil && (
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-neutral-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                Live until {new Date(liveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Location Details & Actions Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">{name || 'Shared Location'}</h4>
              <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">{address || 'No address text'}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-500 font-mono">
                <span>{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
                {accuracy && <span>• Accurate to {accuracy}m</span>}
              </div>
            </div>

            <button
              onClick={handleCopyCoords}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1 shrink-0 border border-neutral-800 transition-colors"
              title="Copy coordinates"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Coords'}</span>
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-[0.99]"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Get Directions</span>
            </a>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </a>

            {isStillLive && isMe && (
              <button
                type="button"
                onClick={handleStopSharing}
                disabled={stoppingLive}
                className="py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5 text-red-400" />
                <span>{stoppingLive ? 'Stopping...' : 'Stop Sharing'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
