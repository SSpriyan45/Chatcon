import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  MapControl,
  ControlPosition,
  useMap
} from '@vis.gl/react-google-maps';
import {
  X,
  MapPin,
  Navigation,
  Radio,
  Clock,
  Send,
  Search,
  Check,
  Compass,
  AlertCircle,
  LocateFixed,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { db } from '../../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { soundManager } from '../../utils/sound';
import { liveLocationManager } from '../../utils/liveLocation';
import { ChatMessage } from '../../types';

interface LocationShareModalProps {
  chatId: string;
  chatType: 'private' | 'group';
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Subcomponent to smoothly pan map when center changes
const MapRecenterController: React.FC<{ center: { lat: number; lng: number } }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo(center);
    }
  }, [map, center]);
  return null;
};

export const LocationShareModal: React.FC<LocationShareModalProps> = ({ chatId, chatType }) => {
  const { currentUser, profile } = useAuth();
  const { isLocationModalOpen, setIsLocationModalOpen } = useUI();

  // Mode: 'current' (Send Current Location), 'live' (Share Live Location), or 'custom' (Pin on map)
  const [activeMode, setActiveMode] = useState<'current' | 'live' | 'search'>('current');
  const [liveDuration, setLiveDuration] = useState<15 | 60 | 480>(60); // 15m, 1h, 8h
  const [comment, setComment] = useState('');

  // Location Coordinates
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('Locating...');
  const [locationName, setLocationName] = useState<string>('Current Location');
  const [loadingGps, setLoadingGps] = useState(true);
  const [sending, setSending] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

  // Search places state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; address: string; lat: number; lng: number }>>([]);

  // Fetch initial GPS position
  const fetchCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setAddress('Geolocation not supported by your browser');
      setLoadingGps(false);
      return;
    }

    setLoadingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setSelectedLocation(coords);
        setAccuracy(Math.round(pos.coords.accuracy || 10));
        setLoadingGps(false);
        reverseGeocode(coords.lat, coords.lng);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        // Default to a scenic central location if user denies permission
        const fallback = { lat: 37.7749, lng: -122.4194 };
        setUserLocation(fallback);
        setSelectedLocation(fallback);
        setAddress('San Francisco, CA (Default Preview)');
        setLoadingGps(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    if (isLocationModalOpen) {
      fetchCurrentLocation();
    }
  }, [isLocationModalOpen, fetchCurrentLocation]);

  // Reverse geocoding helper
  const reverseGeocode = async (lat: number, lng: number) => {
    setAddress('Fetching address...');
    try {
      // 1. Check window.google.maps.Geocoder first if available
      const g = (window as unknown as { google?: { maps?: { Geocoder: any } } }).google;
      if (g?.maps?.Geocoder) {
        const geocoder = new g.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results?.[0]) {
            setAddress(results[0].formatted_address);
            const routeOrPremise = results[0].address_components?.find((c: any) =>
              c.types.includes('point_of_interest') ||
              c.types.includes('establishment') ||
              c.types.includes('route') ||
              c.types.includes('locality')
            );
            if (routeOrPremise) {
              setLocationName(routeOrPremise.long_name);
            } else {
              setLocationName('Current Location');
            }
            return;
          }
        });
        return;
      }

      // 2. Fallback to OpenStreetMap reverse geocoding
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      if (res.ok) {
        const data = await res.json();
        setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setLocationName(data.name || data.address?.road || data.address?.city || 'Selected Location');
        return;
      }
    } catch {
      // Fallback to formatted coordinates
    }
    setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setLocationName('Selected Location');
  };

  // Search Place handler
  const handleSearchPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      // Free geocoding search fallback
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = data.map((item: any) => ({
          name: item.name || item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));
        setSearchResults(list);
      }
    } catch (err) {
      console.warn('Place search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (res: { name: string; address: string; lat: number; lng: number }) => {
    const coords = { lat: res.lat, lng: res.lng };
    setSelectedLocation(coords);
    setLocationName(res.name);
    setAddress(res.address);
    setSearchResults([]);
  };

  // Click on map to reposition pin
  const handleMapClick = (e: any) => {
    if (e.detail?.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      setSelectedLocation({ lat, lng });
      reverseGeocode(lat, lng);
    }
  };

  // SEND LOCATION TO CHAT
  const handleSendLocation = async (type: 'static' | 'live') => {
    if (!currentUser || !profile || !selectedLocation) return;
    setSending(true);

    const collName = chatType === 'private' ? 'privateChats' : 'groups';

    try {
      const isLive = type === 'live';
      const liveDurationMinutes = isLive ? liveDuration : 0;
      const liveUntil = isLive ? Date.now() + liveDurationMinutes * 60 * 1000 : undefined;

      const messageData: Partial<ChatMessage> = {
        senderId: currentUser.uid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL || currentUser.photoURL || '',
        text: isLive
          ? comment.trim() ? `📍 ${comment.trim()}` : `📍 Live location shared (${liveDuration >= 60 ? `${liveDuration / 60} hour` : `${liveDuration} mins`})`
          : comment.trim() ? `📍 ${comment.trim()}` : `📍 ${locationName}`,
        type: 'location',
        location: {
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          name: isLive ? (profile.displayName || profile.username) : locationName,
          address: address || 'Shared location',
          accuracy: accuracy || 10,
          isLive,
          liveUntil,
          liveEnded: false,
          speed: 0,
        },
        createdAt: Date.now(),
        readBy: [currentUser.uid],
        deliveredTo: [currentUser.uid],
      };

      const docRef = await addDoc(collection(db, collName, chatId, 'messages'), messageData);

      // If Live Location, kick off live tracking manager
      if (isLive && liveUntil) {
        liveLocationManager.startTracking(chatType, chatId, docRef.id, liveUntil);
      }

      soundManager.playSent();
      setIsLocationModalOpen(false);
      setComment('');
    } catch (err) {
      console.error('Failed to send location message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!isLocationModalOpen) return null;

  const currentCenter = selectedLocation || userLocation || { lat: 37.7749, lng: -122.4194 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header (WhatsApp Style) */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Share Location</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  WhatsApp Style
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Send current GPS location or share live tracking
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsLocationModalOpen(false)}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Current / Live / Search) */}
        <div className="grid grid-cols-3 p-1.5 bg-neutral-950/80 border-b border-neutral-800 text-xs shrink-0">
          <button
            onClick={() => setActiveMode('current')}
            className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'current'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Current Location</span>
          </button>

          <button
            onClick={() => setActiveMode('live')}
            className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'live'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
            <span>Live Location</span>
          </button>

          <button
            onClick={() => setActiveMode('search')}
            className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'search'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Place</span>
          </button>
        </div>

        {/* Place Search Bar (visible in search mode) */}
        {activeMode === 'search' && (
          <form onSubmit={handleSearchPlace} className="p-3 bg-neutral-950/90 border-b border-neutral-800 flex gap-2 shrink-0">
            <div className="flex-1 relative flex items-center bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5">
              <Search className="w-4 h-4 text-neutral-500 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search landmark, café, street..."
                className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        )}

        {/* Search Results Dropdown List */}
        {searchResults.length > 0 && activeMode === 'search' && (
          <div className="max-h-36 overflow-y-auto bg-neutral-950 border-b border-neutral-800 divide-y divide-neutral-800/60 custom-scrollbar shrink-0">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left p-2.5 hover:bg-neutral-850 flex items-start gap-2.5 transition-colors"
              >
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{item.name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{item.address}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Interactive Google Map Preview Container */}
        <div className="relative w-full h-56 sm:h-64 bg-neutral-950 overflow-hidden border-b border-neutral-800">
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} solutionChannel="GMP_aistudio_web">
              <Map
                center={currentCenter}
                zoom={16}
                mapId="DEMO_MAP_ID"
                mapTypeId={mapType}
                onClick={handleMapClick}
                gestureHandling="greedy"
                disableDefaultUI={true}
                className="w-full h-full"
                internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              >
                <MapRecenterController center={currentCenter} />

                {/* Marker with custom styled Pin */}
                {selectedLocation && (
                  <AdvancedMarker position={selectedLocation} title={locationName}>
                    {activeMode === 'live' ? (
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-8 h-8 rounded-full bg-emerald-400/40 animate-ping" />
                        <div className="w-10 h-10 rounded-full border-2 border-white bg-emerald-500 shadow-xl overflow-hidden flex items-center justify-center">
                          <img
                            src={profile?.photoURL || currentUser?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.uid}`}
                            alt="Live Marker"
                            className="w-full h-full object-cover"
                          />
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
                )}

                {/* Accuracy Circle indication if user's location */}
                {userLocation && accuracy && (
                  <div className="absolute top-2 left-2 pointer-events-none" />
                )}
              </Map>
            </APIProvider>
          ) : (
            /* Graceful Fallback Map Card if API Key not provided */
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-neutral-950/90 relative">
              <iframe
                title="Location Map Preview"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://maps.google.com/maps?q=${currentCenter.lat},${currentCenter.lng}&z=15&output=embed`}
                className="absolute inset-0 w-full h-full opacity-70"
              />
              <div className="relative z-10 p-3 rounded-2xl bg-neutral-900/90 backdrop-blur-md border border-neutral-700 shadow-xl max-w-xs">
                <MapPin className="w-6 h-6 text-emerald-400 mx-auto mb-1 animate-bounce" />
                <p className="text-xs font-bold text-white truncate">{locationName}</p>
                <p className="text-[10px] text-neutral-400 truncate">{address}</p>
              </div>
            </div>
          )}

          {/* Floating Controls over Map */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
            {/* Re-center GPS button */}
            <button
              onClick={fetchCurrentLocation}
              disabled={loadingGps}
              className="w-9 h-9 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-emerald-400 border border-neutral-700 shadow-lg flex items-center justify-center transition-transform active:scale-95"
              title="Re-center My GPS"
            >
              <LocateFixed className={`w-4 h-4 ${loadingGps ? 'animate-spin' : ''}`} />
            </button>

            {/* Map Style toggle */}
            <button
              onClick={() => setMapType((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))}
              className="w-9 h-9 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 shadow-lg flex items-center justify-center transition-transform active:scale-95"
              title="Toggle Satellite View"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Hint */}
          <div className="absolute bottom-2 left-2 z-10 px-2 py-1 rounded-lg bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 text-[10px] text-neutral-300 flex items-center gap-1.5 shadow">
            <Compass className="w-3 h-3 text-emerald-400" />
            <span>Tap map to reposition marker</span>
          </div>
        </div>

        {/* Bottom Options & Controls */}
        <div className="p-4 bg-neutral-950 flex-1 overflow-y-auto space-y-3.5 custom-scrollbar">
          {/* Selected Location Address Card */}
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-white truncate">{locationName}</h4>
                {accuracy && activeMode !== 'search' && (
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    Accurate to {accuracy}m
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed">
                {address}
              </p>
            </div>
          </div>

          {/* MODE 1: SHARE LIVE LOCATION (WhatsApp style) */}
          {activeMode === 'live' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">Live Tracking Duration</span>
                </div>
                <span className="text-[11px] text-neutral-400">Updates as you move</span>
              </div>

              {/* Duration Pills: 15 mins, 1 hour, 8 hours */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 15, label: '15 Minutes' },
                  { value: 60, label: '1 Hour' },
                  { value: 480, label: '8 Hours' },
                ].map((dur) => (
                  <button
                    key={dur.value}
                    type="button"
                    onClick={() => setLiveDuration(dur.value as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                      liveDuration === dur.value
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/30'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-emerald-300/80 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Participants will see your real-time location on the map until{' '}
                  <strong className="text-emerald-300 font-bold">
                    {new Date(Date.now() + liveDuration * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </strong>. You can stop sharing at any time.
                </span>
              </div>
            </div>
          )}

          {/* Optional Caption / Comment */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
              Add note or message (optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={activeMode === 'live' ? 'e.g. Walking towards the cafe, ETA 5m...' : 'e.g. Meet me at this gate'}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Action Send Button */}
          <div className="pt-2">
            {activeMode === 'live' ? (
              <button
                type="button"
                onClick={() => handleSendLocation('live')}
                disabled={sending || loadingGps}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Radio className="w-4 h-4 animate-pulse" />
                )}
                <span>{sending ? 'Starting Live Location...' : `Share Live Location (${liveDuration >= 60 ? `${liveDuration / 60}h` : `${liveDuration}m`})`}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendLocation('static')}
                disabled={sending || loadingGps}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {sending
                    ? 'Sending Location...'
                    : activeMode === 'search'
                    ? `Send "${locationName}"`
                    : 'Send Your Current Location'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
