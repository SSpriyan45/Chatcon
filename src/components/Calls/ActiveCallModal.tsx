import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { formatDuration } from '../../utils/formatters';
import { soundManager } from '../../utils/sound';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  Volume2,
  VolumeX,
  SwitchCamera,
  Monitor,
  Maximize,
  Minimize,
  Sliders,
  Sparkles,
  Smile,
  X,
  CheckCircle2,
  ChevronDown,
  Lock,
  UserPlus,
  ShieldCheck
} from 'lucide-react';
import { InCallAddParticipantModal } from './InCallAddParticipantModal';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export const ActiveCallModal: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    isScreenSharing,
    callDuration,
    callVolume,
    setCallVolume,
    audioBlocked,
    unlockAudio,
    localAudioLevel,
    remoteAudioLevel,
    localSpeaking,
    oppositeSpeaking,
    isMinimized,
    toggleMinimize,
    noiseSuppression,
    toggleNoiseSuppression,
    sendReaction,
    latestReaction,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    switchCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOptionsDrawer, setShowOptionsDrawer] = useState(false);
  const [showReactionsBar, setShowReactionsBar] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [isRingtoneSilenced, setIsRingtoneSilenced] = useState(false);
  const [isSwappedVideo, setIsSwappedVideo] = useState(false);

  const handleSilenceRingtone = () => {
    soundManager.stopRingtone();
    setIsRingtoneSilenced(true);
  };

  // Trigger floating reaction animation when new reaction arrives
  useEffect(() => {
    if (latestReaction) {
      const id = Date.now() + Math.random();
      setFloatingReactions((prev) => [...prev.slice(-8), { id, emoji: latestReaction.emoji }]);
      const timer = setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [latestReaction]);

  // Attach local stream to local preview video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff, isScreenSharing]);

  // Attach remote stream to remote video when in video call
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && remoteStream && activeCall?.status === 'connected') {
      videoEl.srcObject = remoteStream;
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    }
  }, [remoteStream, isVideoOff, activeCall?.status]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleTestAudio = () => {
    soundManager.playConnected();
  };

  // 1. WhatsApp-style Incoming Call Dialog Overlay
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-[#111b21] border border-neutral-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden text-neutral-200">
          {/* Animated WhatsApp background pulse */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

          {/* End-to-end encrypted tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-neutral-700/60 text-[10px] text-neutral-400 font-medium mb-4">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>End-to-end encrypted</span>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Avatar with WhatsApp pulsing acoustic rings */}
            <div className="relative mb-5">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <span className="absolute -inset-3 rounded-full bg-emerald-500/15 animate-pulse" />
                <img
                  src={
                    incomingCall.callerPhoto ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${incomingCall.callerName}`
                  }
                  alt={incomingCall.callerName}
                  className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-2xl relative z-10"
                />
              </div>

              <div className="absolute bottom-0 right-0 p-2 bg-[#111b21] rounded-full border border-neutral-700 text-emerald-400 shadow-lg z-20">
                {incomingCall.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-1 tracking-tight">
              {incomingCall.callerName}
            </h3>
            <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase mb-7 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Incoming Chatcon {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call...
            </p>

            {/* Accept / Decline Action Buttons */}
            <div className="flex items-center justify-center gap-12 w-full px-4">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={rejectCall}
                  className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-transform hover:scale-110 active:scale-95"
                  title="Decline Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <span className="text-[11px] text-neutral-400 font-medium">Decline</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-600/50 transition-transform hover:scale-110 active:scale-95 animate-bounce ring-4 ring-emerald-500/30"
                  title="Accept Call"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-[11px] text-emerald-400 font-semibold">Accept</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSilenceRingtone}
              className="mt-7 px-3.5 py-1.5 rounded-full bg-[#202c33] hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700/60"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>{isRingtoneSilenced ? 'Ringtone Silenced' : 'Silence Ringtone'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Call state validation
  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video';
  const isCaller = currentUser?.uid === activeCall.callerId;
  const otherPersonName = isCaller ? activeCall.receiverName : activeCall.callerName;
  const otherPersonPhoto = isCaller ? activeCall.receiverPhoto : activeCall.callerPhoto;

  // 3. Minimized Floating Call Card (WhatsApp-style Picture-in-Picture)
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 bg-[#111b21]/95 border border-neutral-700/80 rounded-2xl shadow-2xl p-3 flex items-center gap-3 backdrop-blur-xl animate-in slide-in-from-bottom-4 transition-all max-w-sm select-none">
        {/* Floating Reactions on Minimized Card */}
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl animate-bounce pointer-events-none"
          >
            {r.emoji}
          </div>
        ))}

        {/* Small Avatar with speaking wave */}
        <div className="relative">
          <div
            className={`w-11 h-11 rounded-full overflow-hidden border-2 ${
              oppositeSpeaking
                ? 'border-emerald-400 ring-4 ring-emerald-400/30 animate-pulse'
                : 'border-neutral-700'
            }`}
          >
            <img
              src={otherPersonPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherPersonName}`}
              alt={otherPersonName}
              className="w-full h-full object-cover"
            />
          </div>
          {oppositeSpeaking && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#111b21]" />
          )}
        </div>

        {/* Call Info */}
        <div className="flex-1 min-w-[110px] cursor-pointer" onClick={toggleMinimize}>
          <div className="text-xs font-bold text-white truncate max-w-[120px]">{otherPersonName}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeCall.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            {activeCall.status === 'connected' ? formatDuration(callDuration) : 'Calling...'}
          </div>
        </div>

        {/* Quick Minimized Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-2 rounded-xl text-xs transition-colors ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-[#202c33] text-neutral-300 hover:text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleMinimize}
            className="p-2 rounded-xl bg-[#202c33] text-neutral-300 hover:text-white transition-colors"
            title="Expand Full Call"
          >
            <Maximize className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={endCall}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors"
            title="End Call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 4. Full WhatsApp-Style Call Screen
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg"
      onClick={() => {
        if (audioBlocked) unlockAudio();
      }}
    >
      <div
        ref={modalContainerRef}
        className={`relative w-full h-full md:max-w-4xl ${
          isFullscreen ? 'md:h-full md:rounded-none' : 'md:h-[88vh] md:rounded-3xl'
        } bg-[#0b141a] border border-neutral-800 flex flex-col overflow-hidden shadow-2xl transition-all`}
      >
        {/* Subtle WhatsApp pattern background overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#111b21] via-[#0b141a] to-[#081014] opacity-95 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Floating In-Call Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
          {floatingReactions.map((r) => (
            <div
              key={r.id}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 text-4xl animate-in fade-in slide-in-from-bottom-12 duration-700"
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Audio Autoplay Unblock Banner */}
        {audioBlocked && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              unlockAudio();
            }}
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 px-4 py-2 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors z-30 shadow-md animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <span>Audio playback paused. Tap anywhere to enable call audio.</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-black/20 text-[10px] uppercase tracking-wider font-extrabold">
              Tap to Enable
            </span>
          </div>
        )}

        {/* WhatsApp Top Header Bar */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          {/* Left: Minimize Button */}
          <button
            type="button"
            onClick={toggleMinimize}
            className="p-2.5 rounded-2xl bg-[#111b21]/80 hover:bg-[#202c33] text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors shadow-lg pointer-events-auto"
            title="Minimize to Floating PiP"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {/* Center: End-to-end encrypted tag & Call status */}
          <div className="flex flex-col items-center pointer-events-auto">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[11px] text-neutral-300 shadow-md">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>End-to-end encrypted</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeCall.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="font-semibold text-white">
                {activeCall.status === 'connected'
                  ? formatDuration(callDuration)
                  : activeCall.status === 'calling'
                  ? 'Calling...'
                  : activeCall.status}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                {isVideo ? 'HD Video' : 'HD Audio'}
              </span>
            </div>
          </div>

          {/* Right: Add Participant & Fullscreen */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowAddParticipant(true)}
              className="p-2.5 rounded-2xl bg-[#111b21]/80 hover:bg-[#202c33] text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors shadow-lg"
              title="Add Participant to Call"
            >
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-2xl bg-[#111b21]/80 hover:bg-[#202c33] text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors shadow-lg"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Video / Audio Stage Area */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {isVideo && !isVideoOff && remoteStream ? (
            <div className="w-full h-full relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center p-6 select-none relative z-10">
              {/* WhatsApp Acoustic Radiating Sound Waves around Avatar */}
              <div className="relative">
                <div className="relative w-36 h-36 md:w-44 md:h-44 flex items-center justify-center">
                  {oppositeSpeaking && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                      <span className="absolute -inset-4 rounded-full bg-emerald-500/15 animate-pulse" />
                      <span className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse delay-75" />
                    </>
                  )}
                  <div
                    className={`w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 transition-all duration-300 ${
                      oppositeSpeaking
                        ? 'border-emerald-500 ring-8 ring-emerald-500/30 scale-105 shadow-2xl shadow-emerald-500/40'
                        : 'border-emerald-600/30'
                    }`}
                  >
                    <img
                      src={otherPersonPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherPersonName}`}
                      alt={otherPersonName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Status Indicator Badge on Avatar */}
                {activeCall.status === 'connected' ? (
                  <div
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[10px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1 transition-colors ${
                      oppositeSpeaking ? 'bg-emerald-600' : 'bg-[#202c33] border border-neutral-700'
                    }`}
                  >
                    <span>{oppositeSpeaking ? 'Speaking...' : 'Connected'}</span>
                  </div>
                ) : (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-bold tracking-wider uppercase animate-pulse shadow-md">
                    Ringing...
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">{otherPersonName}</h2>
                <p className="text-xs text-neutral-400 font-mono">
                  {activeCall.status === 'connected'
                    ? formatDuration(callDuration)
                    : activeCall.status === 'calling'
                    ? 'Ringing...'
                    : activeCall.status}
                </p>
              </div>

              {/* Dynamic Sound Equalizer Visualizer */}
              {activeCall.status === 'connected' && (
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#111b21]/90 border border-neutral-800 shadow-inner mt-2">
                  <div className="flex items-center gap-1">
                    {[0.3, 0.7, 1.0, 0.5, 0.8, 0.4].map((multiplier, i) => {
                      const height = oppositeSpeaking
                        ? Math.max(4, Math.round((remoteAudioLevel * multiplier) / 3))
                        : 3;
                      return (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-150 ${
                            oppositeSpeaking ? 'bg-emerald-400' : 'bg-neutral-600'
                          }`}
                          style={{ height: `${Math.min(24, Math.max(3, height))}px` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-neutral-400 ml-1 font-medium">
                    {oppositeSpeaking ? 'Voice Active' : isSpeakerOn ? 'Listening...' : 'Audio Muted'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Local Camera Pip for Video Call with Tap-to-Swap */}
          {isVideo && (
            <div
              onClick={() => setIsSwappedVideo((prev) => !prev)}
              className="absolute top-20 right-4 w-32 h-44 sm:w-44 sm:h-60 bg-[#111b21] rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-2xl z-20 cursor-pointer group"
            >
              {!isVideoOff && localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isScreenSharing ? '' : 'scale-x-[-1]'}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#202c33] text-neutral-400 text-xs">
                  <VideoOff className="w-6 h-6 mb-1 text-neutral-500" />
                  Camera Off
                </div>
              )}

              {/* Pip overlay tag */}
              <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white flex items-center gap-1">
                {localSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {isScreenSharing ? 'Sharing Screen' : 'You'}
              </div>
            </div>
          )}
        </div>

        {/* In-Call Quick Reactions Floating Bar */}
        {showReactionsBar && (
          <div className="p-2.5 bg-[#111b21]/95 border-t border-neutral-800 flex items-center justify-center gap-2 z-30 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-xs text-neutral-400 mr-1 flex items-center gap-1">
              <Smile className="w-4 h-4 text-emerald-400" /> React:
            </span>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  sendReaction(emoji);
                  setShowReactionsBar(false);
                }}
                className="text-2xl p-1.5 rounded-xl hover:bg-[#202c33] hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowReactionsBar(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Calling Options Drawer Modal */}
        {showOptionsDrawer && (
          <div className="p-4 bg-[#111b21]/95 border-t border-neutral-800 flex flex-col gap-3 z-30 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Call Audio & Quality Options
              </h4>
              <button
                type="button"
                onClick={() => setShowOptionsDrawer(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Call Volume Slider */}
              <div className="p-2.5 rounded-xl bg-[#0b141a] border border-neutral-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Call Volume
                  </span>
                  <span className="font-mono text-[11px] text-emerald-400">{Math.round(callVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={callVolume}
                  onChange={(e) => setCallVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                />
              </div>

              {/* Noise Suppression Toggle */}
              <div className="p-2.5 rounded-xl bg-[#0b141a] border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Crystal Voice
                  </div>
                  <div className="text-[10px] text-neutral-400">Noise suppression & AGC</div>
                </div>
                <button
                  type="button"
                  onClick={toggleNoiseSuppression}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    noiseSuppression ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {noiseSuppression ? 'Enabled' : 'Off'}
                </button>
              </div>

              {/* Test Audio Output */}
              <div className="p-2.5 rounded-xl bg-[#0b141a] border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Audio Check
                  </div>
                  <div className="text-[10px] text-neutral-400">Test sound output</div>
                </div>
                <button
                  type="button"
                  onClick={handleTestAudio}
                  className="px-2.5 py-1 rounded-lg bg-[#202c33] hover:bg-neutral-700 text-white text-xs font-medium transition-colors"
                >
                  Play Chime
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Signature Floating Dock Toolbar */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center z-30">
          <div className="flex items-center gap-3 sm:gap-4 p-2 sm:p-2.5 rounded-full bg-[#111b21]/90 backdrop-blur-xl border border-white/10 shadow-2xl">
            {/* Mute Mic */}
            <button
              type="button"
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg'
                  : 'bg-[#202c33] hover:bg-[#2a3942] text-neutral-200'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle (Switch camera on/off or upgrade voice to video) */}
            <button
              type="button"
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isVideoOff
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg'
                  : isVideo
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#202c33] hover:bg-[#2a3942] text-neutral-200'
              }`}
              title={isVideoOff ? 'Turn Camera On' : isVideo ? 'Turn Camera Off' : 'Switch to Video Call'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* Switch Camera (Front/Back) */}
            {isVideo && !isVideoOff && (
              <button
                type="button"
                onClick={switchCamera}
                className="w-12 h-12 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-neutral-200 flex items-center justify-center transition-all"
                title="Flip Camera (Front / Back)"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {/* Screen Share (video call) */}
            {isVideo && (
              <button
                type="button"
                onClick={toggleScreenShare}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isScreenSharing
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-lg'
                    : 'bg-[#202c33] hover:bg-[#2a3942] text-neutral-200'
                }`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <Monitor className="w-5 h-5" />
              </button>
            )}

            {/* Speaker / Audio Output Toggle */}
            <button
              type="button"
              onClick={toggleSpeaker}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                !isSpeakerOn
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-[#202c33] hover:bg-[#2a3942] text-neutral-200'
              }`}
              title={isSpeakerOn ? 'Speakerphone On' : 'Speakerphone Off'}
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Reactions Toggle */}
            <button
              type="button"
              onClick={() => setShowReactionsBar((prev) => !prev)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                showReactionsBar
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-[#202c33] hover:bg-[#2a3942] text-neutral-200'
              }`}
              title="Send Emoji Reaction"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Audio Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowOptionsDrawer((prev) => !prev)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                showOptionsDrawer
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#202c33] hover:bg-[#2a3942] text-neutral-200'
              }`}
              title="Call Audio & Quality Options"
            >
              <Sliders className="w-5 h-5" />
            </button>

            {/* End / Hang Up Call */}
            <button
              type="button"
              onClick={endCall}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-transform hover:scale-105 active:scale-95 ml-1"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* In-Call Add Participant Modal */}
        <InCallAddParticipantModal
          isOpen={showAddParticipant}
          onClose={() => setShowAddParticipant(false)}
        />
      </div>
    </div>
  );
};
