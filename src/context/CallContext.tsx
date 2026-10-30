import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { CallSession, CallType } from '../types';
import { soundManager } from '../utils/sound';

interface CallContextType {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  facingMode: 'user' | 'environment';
  callVolume: number;
  setCallVolume: (vol: number) => void;
  audioBlocked: boolean;
  unlockAudio: () => void;
  localAudioLevel: number;
  remoteAudioLevel: number;
  localSpeaking: boolean;
  oppositeSpeaking: boolean;
  isMinimized: boolean;
  toggleMinimize: () => void;
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  sendReaction: (emoji: string) => Promise<void>;
  latestReaction: { emoji: string; senderName: string; id: number } | null;
  startCall: (receiverId: string, receiverName: string, receiverPhoto: string, type: CallType) => Promise<void>;
  startGroupCall: (groupId: string, groupName: string, participantIds: string[], type: CallType) => Promise<void>;
  createCallLink: (type: CallType) => Promise<string>;
  joinCallLink: (linkId: string, type: CallType, hostName?: string) => Promise<void>;
  addParticipantToActiveCall: (userId: string, userName: string, userPhoto?: string) => Promise<void>;
  upgradeToVideo: () => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  toggleScreenShare: () => Promise<void>;
  switchCamera: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
};

const CALL_RINGING_TIMEOUT_MS = 38000;

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, profile } = useAuth();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callVolume, setCallVolume] = useState(1.0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [callDuration, setCallDuration] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  // Audio activity metrics
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [oppositeSpeaking, setOppositeSpeaking] = useState(false);

  // Floating in-call reaction
  const [latestReaction, setLatestReaction] = useState<{ emoji: string; senderName: string; id: number } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callUnsubRef = useRef<(() => void) | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const processedCandidatesRef = useRef<Set<string>>(new Set());

  // Persistent off-screen audio element for reliable remote voice playback
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    // Off-screen positioning keeps it in DOM render tree without throttling
    audio.style.position = 'fixed';
    audio.style.top = '-9999px';
    audio.style.left = '-9999px';
    audio.style.width = '1px';
    audio.style.height = '1px';
    audio.style.opacity = '0';
    audio.style.pointerEvents = 'none';
    document.body.appendChild(audio);
    remoteAudioElRef.current = audio;

    return () => {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
    };
  }, []);

  // Page Title Flashing Alert during Incoming Call
  useEffect(() => {
    if (!incomingCall) return;

    const originalTitle = typeof document !== 'undefined' ? document.title : 'Chatcon';
    let isAlert = true;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined') {
        document.title = isAlert
          ? `📞 (1) Incoming Call: ${incomingCall.callerName}...`
          : originalTitle;
        isAlert = !isAlert;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.title = originalTitle;
      }
    };
  }, [incomingCall]);

  // Listen for incoming calls for currentUser
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'calling')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const callDoc = snapshot.docs[0];
          const data = { id: callDoc.id, ...callDoc.data() } as CallSession;
          if (!activeCall) {
            setIncomingCall(data);

            // Read user ringtone & call alert preferences
            let ringtoneEnabled = true;
            let melody: 'modern' | 'classic' | 'gentle' = 'modern';
            try {
              const stored = localStorage.getItem('chatconnect_notification_settings');
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.callRingtone === false || parsed.callAlerts === false) {
                  ringtoneEnabled = false;
                }
                if (parsed.ringtoneType) melody = parsed.ringtoneType;
              }
            } catch {}

            if (ringtoneEnabled) {
              soundManager.startRingtone(melody);
            }

            // Desktop push alert for incoming call if window is in background
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted' &&
              document.hidden
            ) {
              try {
                const notif = new Notification(
                  `Incoming ${data.type === 'video' ? 'Video' : 'Voice'} Call`,
                  {
                    body: `${data.callerName} is calling you on Chatcon. Tap to answer.`,
                    icon: data.callerPhoto || '/logo.png',
                    badge: '/logo.png',
                    tag: `call_${data.id}`,
                    requireInteraction: true,
                  }
                );
                notif.onclick = () => {
                  window.focus();
                  notif.close();
                };
              } catch {}
            }
          }
        } else {
          setIncomingCall(null);
          soundManager.stopRingtone();
        }
      },
      (error) => {
        console.warn('Call listener notice:', error.message);
      }
    );

    return () => {
      unsubscribe();
      soundManager.stopRingtone();
    };
  }, [currentUser, activeCall]);

  // Duration Timer when connected
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [activeCall?.status]);

  // Attach remote stream to persistent audio element
  useEffect(() => {
    const audio = remoteAudioElRef.current;
    if (!audio) return;

    if (remoteStream && activeCall?.status === 'connected') {
      audio.srcObject = remoteStream;
      audio.muted = !isSpeakerOn;
      audio.volume = isSpeakerOn ? Math.min(1.0, Math.max(0, callVolume)) : 0.0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAudioBlocked(false);
            console.log('[WebRTC] Remote call audio playing successfully');
          })
          .catch((err) => {
            console.warn('[WebRTC] Autoplay prevented, requires user interaction:', err);
            setAudioBlocked(true);
          });
      }
    } else {
      audio.srcObject = null;
      setAudioBlocked(false);
    }
  }, [remoteStream, activeCall?.status, isSpeakerOn, callVolume]);

  // Auto-unlock audio on any global user interaction if blocked
  const unlockAudio = useCallback(() => {
    if (remoteAudioElRef.current && remoteStream) {
      remoteAudioElRef.current.muted = !isSpeakerOn;
      remoteAudioElRef.current.volume = isSpeakerOn ? Math.min(1.0, Math.max(0, callVolume)) : 0.0;
      remoteAudioElRef.current
        .play()
        .then(() => {
          setAudioBlocked(false);
          console.log('[WebRTC] Remote call audio unlocked via interaction');
        })
        .catch(() => {});
    }
  }, [remoteStream, isSpeakerOn, callVolume]);

  useEffect(() => {
    if (!audioBlocked) return;
    const handleGesture = () => unlockAudio();
    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('touchstart', handleGesture, { once: true });
    window.addEventListener('keydown', handleGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [audioBlocked, unlockAudio]);

  // Audio Level & Speaking Analyser for Local Microphone
  useEffect(() => {
    if (!localStream || isMuted) {
      setLocalAudioLevel(0);
      setLocalSpeaking(false);
      return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setLocalAudioLevel(0);
      setLocalSpeaking(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setLocalAudioLevel(normalized);
        setLocalSpeaking(normalized > 12);
        animId = requestAnimationFrame(checkLevel);
      };
      checkLevel();

      return () => {
        cancelAnimationFrame(animId);
        source.disconnect();
        analyser.disconnect();
        ctx.close().catch(() => {});
      };
    } catch {
      // AudioContext unavailable or restricted
    }
  }, [localStream, isMuted]);

  // Audio Level & Speaking Analyser for Remote Audio
  useEffect(() => {
    if (!remoteStream || !isSpeakerOn || activeCall?.status !== 'connected') {
      setRemoteAudioLevel(0);
      setOppositeSpeaking(false);
      return;
    }
    const audioTrack = remoteStream.getAudioTracks()[0];
    if (!audioTrack) {
      setRemoteAudioLevel(0);
      setOppositeSpeaking(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setRemoteAudioLevel(normalized);
        setOppositeSpeaking(normalized > 10);
        animId = requestAnimationFrame(checkLevel);
      };
      checkLevel();

      return () => {
        cancelAnimationFrame(animId);
        source.disconnect();
        analyser.disconnect();
        ctx.close().catch(() => {});
      };
    } catch {
      // AudioContext unavailable or restricted
    }
  }, [remoteStream, isSpeakerOn, activeCall?.status]);

  const cleanupPeerConnection = useCallback(() => {
    if (callTimeoutTimerRef.current) {
      clearTimeout(callTimeoutTimerRef.current);
      callTimeoutTimerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (originalVideoTrackRef.current) {
      originalVideoTrackRef.current.stop();
      originalVideoTrackRef.current = null;
    }
    if (remoteAudioElRef.current) {
      remoteAudioElRef.current.srcObject = null;
    }
    setRemoteStream(null);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsMinimized(false);
    setAudioBlocked(false);
    setLocalAudioLevel(0);
    setRemoteAudioLevel(0);
    setLocalSpeaking(false);
    setOppositeSpeaking(false);
    setLatestReaction(null);
    pendingCandidatesRef.current = [];
    processedCandidatesRef.current.clear();

    if (callUnsubRef.current) {
      callUnsubRef.current();
      callUnsubRef.current = null;
    }
    soundManager.stopRingtone();
  }, [localStream]);

  // Helper to safely apply ICE candidates with queueing
  const applyIceCandidates = async (pc: RTCPeerConnection, candidates: any[]) => {
    if (!Array.isArray(candidates)) return;
    for (const cand of candidates) {
      if (!cand || !cand.candidate || typeof cand.candidate !== 'string' || cand.candidate.trim() === '') {
        continue;
      }
      const key = `${cand.candidate}_${cand.sdpMid}_${cand.sdpMLineIndex}`;
      if (processedCandidatesRef.current.has(key)) continue;

      if (!pc.remoteDescription) {
        pendingCandidatesRef.current.push(cand);
        continue;
      }

      processedCandidatesRef.current.add(key);
      try {
        await pc.addIceCandidate(cand);
      } catch (err) {
        console.warn('[WebRTC] Error adding ICE candidate:', err);
      }
    }
  };

  // Helper to drain pending candidates once remote description is ready
  const drainPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    for (const cand of candidates) {
      if (!cand || !cand.candidate || typeof cand.candidate !== 'string' || cand.candidate.trim() === '') {
        continue;
      }
      const key = `${cand.candidate}_${cand.sdpMid}_${cand.sdpMLineIndex}`;
      if (!processedCandidatesRef.current.has(key)) {
        processedCandidatesRef.current.add(key);
        try {
          await pc.addIceCandidate(cand);
        } catch (err) {
          console.warn('[WebRTC] Error draining pending ICE candidate:', err);
        }
      }
    }
  };

  const getMediaConstraints = (type: CallType) => {
    const audioOpts = noiseSuppression
      ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : true;

    return {
      audio: audioOpts,
      video: type === 'video' ? { facingMode: 'user' } : false,
    };
  };

  const startCall = async (
    receiverId: string,
    receiverName: string,
    receiverPhoto: string,
    type: CallType
  ) => {
    if (!currentUser || !profile) return;

    try {
      cleanupPeerConnection();

      // Acquire media with fallback hierarchy
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(type));
      } catch (mediaErr) {
        console.warn('Initial media constraint failed, falling back to audio:true:', mediaErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === 'video' ? { facingMode: 'user' } : false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        }
      }

      // Explicitly ensure audio tracks are active
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      setLocalStream(stream);
      setFacingMode('user');

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add audio tracks first for priority negotiation
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      if (type === 'video') {
        stream.getVideoTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      // Handle incoming remote tracks (audio & video) with new MediaStream references
      pc.ontrack = (event) => {
        console.log('[WebRTC] Caller received track:', event.track.kind, event.track.id);
        event.track.enabled = true;

        if (event.streams && event.streams[0]) {
          setRemoteStream(new MediaStream(event.streams[0].getTracks()));
        } else {
          setRemoteStream((prev) => {
            const existing = prev ? prev.getTracks().filter((t) => t.id !== event.track.id) : [];
            return new MediaStream([...existing, event.track]);
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      };

      const callRef = doc(collection(db, 'calls'));
      const callId = callRef.id;

      // Buffer early ICE candidates until setDoc completes to prevent race conditions
      const queuedCallerIce: any[] = [];
      let isCallDocCreated = false;

      pc.onicecandidate = async (event) => {
        if (event.candidate && event.candidate.candidate && event.candidate.candidate.trim() !== '') {
          const candJson = event.candidate.toJSON();
          if (!isCallDocCreated) {
            queuedCallerIce.push(candJson);
          } else {
            try {
              await updateDoc(callRef, {
                callerIce: arrayUnion(candJson),
              });
            } catch (err) {
              console.warn('[WebRTC] Failed to send caller ICE candidate:', err);
            }
          }
        }
      };

      const offerDescription = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      });
      await pc.setLocalDescription(offerDescription);

      const callData: CallSession = {
        id: callId,
        callerId: currentUser.uid,
        callerName: profile.displayName || profile.username,
        callerPhoto: profile.photoURL,
        receiverId,
        receiverName,
        receiverPhoto,
        type,
        status: 'calling',
        offer: {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        },
        callerIce: queuedCallerIce,
        receiverIce: [],
        createdAt: Date.now(),
      };

      await setDoc(callRef, callData);
      isCallDocCreated = true;

      // Drain any candidates that arrived while setDoc was in flight
      const initialSavedCount = callData.callerIce?.length ?? 0;
      if (queuedCallerIce.length > initialSavedCount) {
        const extra = queuedCallerIce.slice(initialSavedCount);
        for (const c of extra) {
          await updateDoc(callRef, { callerIce: arrayUnion(c) }).catch(() => {});
        }
      }

      setActiveCall(callData);

      // Create notification for receiver
      await addDoc(collection(db, 'notifications'), {
        userId: receiverId,
        type: 'call',
        title: `Incoming ${type === 'video' ? 'Video' : 'Voice'} Call`,
        body: `${profile.displayName || profile.username} is calling you...`,
        senderId: currentUser.uid,
        callId,
        read: false,
        createdAt: Date.now(),
      }).catch(() => {});

      // Auto-timeout if unanswered after CALL_RINGING_TIMEOUT_MS
      callTimeoutTimerRef.current = setTimeout(async () => {
        try {
          soundManager.playBusy();
          await updateDoc(callRef, {
            status: 'missed',
            endedAt: Date.now(),
          });
          await addDoc(collection(db, 'notifications'), {
            userId: receiverId,
            type: 'call',
            title: 'Missed Call',
            body: `Missed ${type} call from ${profile.displayName || profile.username}`,
            senderId: currentUser.uid,
            callId,
            read: false,
            createdAt: Date.now(),
          }).catch(() => {});
        } catch {}
        cleanupPeerConnection();
        setActiveCall(null);
      }, CALL_RINGING_TIMEOUT_MS);

      // Listen for answer, receiver ICE candidates, and reactions
      callUnsubRef.current = onSnapshot(
        callRef,
        async (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data() as CallSession;
          setActiveCall({ ...data, id: snapshot.id });

          if (data.status === 'connected') {
            if (callTimeoutTimerRef.current) {
              clearTimeout(callTimeoutTimerRef.current);
              callTimeoutTimerRef.current = null;
            }
            soundManager.playConnected();
          }

          if (data.status === 'rejected' || data.status === 'ended' || data.status === 'missed') {
            soundManager.playBusy();
            cleanupPeerConnection();
            setActiveCall(null);
            return;
          }

          // Handle incoming reaction
          if (data.reaction && data.reaction.senderId !== currentUser.uid) {
            setLatestReaction({
              emoji: data.reaction.emoji,
              senderName: data.receiverName || 'Caller',
              id: data.reaction.timestamp,
            });
            soundManager.playReact();
          }

          if (data.answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(data.answer);
            try {
              await pc.setRemoteDescription(answerDesc);
              console.log('[WebRTC] Caller successfully set remote description');
              await drainPendingIceCandidates(pc);
            } catch (e) {
              console.warn('[WebRTC] Set remote desc error in caller:', e);
            }
          }

          if (data.receiverIce && data.receiverIce.length > 0) {
            await applyIceCandidates(pc, data.receiverIce);
          }
        },
        (err) => {
          console.warn('Outgoing call snapshot notice:', err.message);
        }
      );
    } catch (err) {
      console.error('Failed to start call:', err);
      cleanupPeerConnection();
      setActiveCall(null);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;
    soundManager.stopRingtone();

    try {
      cleanupPeerConnection();
      const callRef = doc(db, 'calls', incomingCall.id);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(incomingCall.type));
      } catch (err) {
        console.warn('Accept call media error, falling back to audio only:', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: incomingCall.type === 'video' ? { facingMode: 'user' } : false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        }
      }

      // Ensure audio tracks are active
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      setLocalStream(stream);
      setFacingMode('user');

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add audio tracks first
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      if (incomingCall.type === 'video') {
        stream.getVideoTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      // Handle remote tracks with fresh MediaStream instances
      pc.ontrack = (event) => {
        console.log('[WebRTC] Receiver received track:', event.track.kind, event.track.id);
        event.track.enabled = true;

        if (event.streams && event.streams[0]) {
          setRemoteStream(new MediaStream(event.streams[0].getTracks()));
        } else {
          setRemoteStream((prev) => {
            const existing = prev ? prev.getTracks().filter((t) => t.id !== event.track.id) : [];
            return new MediaStream([...existing, event.track]);
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Receiver connection state:', pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] Receiver ICE state:', pc.iceConnectionState);
      };

      // Buffer receiver ICE candidates until answer is written
      const queuedReceiverIce: any[] = [];
      let isAnswerDocWritten = false;

      pc.onicecandidate = async (event) => {
        if (event.candidate && event.candidate.candidate && event.candidate.candidate.trim() !== '') {
          const candJson = event.candidate.toJSON();
          if (!isAnswerDocWritten) {
            queuedReceiverIce.push(candJson);
          } else {
            try {
              await updateDoc(callRef, {
                receiverIce: arrayUnion(candJson),
              });
            } catch (err) {
              console.warn('[WebRTC] Failed to send receiver ICE candidate:', err);
            }
          }
        }
      };

      if (incomingCall.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        console.log('[WebRTC] Receiver set remote description (offer)');

        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: incomingCall.type === 'video',
        });
        await pc.setLocalDescription(answer);

        await updateDoc(callRef, {
          answer: { sdp: answer.sdp, type: answer.type },
          status: 'connected',
          startedAt: Date.now(),
          receiverIce: queuedReceiverIce.length > 0 ? arrayUnion(...queuedReceiverIce) : [],
        });
        isAnswerDocWritten = true;

        // Drain any receiver candidates gathered during answer write
        if (queuedReceiverIce.length > 0) {
          for (const c of queuedReceiverIce) {
            await updateDoc(callRef, { receiverIce: arrayUnion(c) }).catch(() => {});
          }
        }

        // Fetch fresh call doc to get all current caller ICE candidates
        const freshSnap = await getDoc(callRef);
        if (freshSnap.exists()) {
          const freshData = freshSnap.data() as CallSession;
          if (freshData.callerIce && freshData.callerIce.length > 0) {
            await applyIceCandidates(pc, freshData.callerIce);
          }
        } else if (incomingCall.callerIce && incomingCall.callerIce.length > 0) {
          await applyIceCandidates(pc, incomingCall.callerIce);
        }

        await drainPendingIceCandidates(pc);
      }

      soundManager.playConnected();
      setActiveCall({ ...incomingCall, status: 'connected', startedAt: Date.now() });
      setIncomingCall(null);

      // Listen for updates, caller ICE candidates, and reactions
      callUnsubRef.current = onSnapshot(
        callRef,
        async (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data() as CallSession;
          setActiveCall({ ...data, id: snapshot.id });

          if (data.status === 'ended' || data.status === 'rejected' || data.status === 'missed') {
            soundManager.playBusy();
            cleanupPeerConnection();
            setActiveCall(null);
            return;
          }

          if (data.reaction && data.reaction.senderId !== currentUser.uid) {
            setLatestReaction({
              emoji: data.reaction.emoji,
              senderName: data.callerName || 'Caller',
              id: data.reaction.timestamp,
            });
            soundManager.playReact();
          }

          if (data.callerIce && data.callerIce.length > 0) {
            await applyIceCandidates(pc, data.callerIce);
          }
        },
        (err) => {
          console.warn('Accepted call snapshot notice:', err.message);
        }
      );
    } catch (err) {
      console.error('Failed to accept call:', err);
      rejectCall();
    }
  };

  const rejectCall = async () => {
    soundManager.stopRingtone();
    soundManager.playBusy();

    if (!incomingCall) return;
    const callRef = doc(db, 'calls', incomingCall.id);
    await updateDoc(callRef, {
      status: 'rejected',
      endedAt: Date.now(),
    }).catch(() => {});

    // Create missed call notification for receiver
    await addDoc(collection(db, 'notifications'), {
      userId: incomingCall.receiverId,
      type: 'call',
      title: 'Missed Call',
      body: `Missed ${incomingCall.type} call from ${incomingCall.callerName}`,
      senderId: incomingCall.callerId,
      callId: incomingCall.id,
      read: false,
      createdAt: Date.now(),
    }).catch(() => {});

    setIncomingCall(null);
  };

  const endCall = async () => {
    soundManager.stopRingtone();
    soundManager.playBusy();

    if (activeCall) {
      const callRef = doc(db, 'calls', activeCall.id);
      const isConnected = activeCall.status === 'connected';
      const duration = isConnected && activeCall.startedAt ? Math.floor((Date.now() - activeCall.startedAt) / 1000) : 0;

      await updateDoc(callRef, {
        status: isConnected ? 'ended' : 'missed',
        endedAt: Date.now(),
        duration,
      }).catch(() => {});

      if (!isConnected && activeCall.callerId === currentUser?.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: activeCall.receiverId,
          type: 'call',
          title: 'Missed Call',
          body: `Missed ${activeCall.type} call from ${activeCall.callerName}`,
          senderId: activeCall.callerId,
          callId: activeCall.id,
          read: false,
          createdAt: Date.now(),
        }).catch(() => {});
      }
    }

    cleanupPeerConnection();
    setActiveCall(null);
    setIncomingCall(null);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      } else {
        // Upgrade from audio to video call
        await upgradeToVideo();
      }
    } else {
      await upgradeToVideo();
    }
  };

  const upgradeToVideo = async () => {
    if (!pcRef.current || !activeCall) return;
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        if (localStream) {
          localStream.addTrack(videoTrack);
          setLocalStream(new MediaStream(localStream.getTracks()));
        } else {
          setLocalStream(videoStream);
        }
        pcRef.current.addTrack(videoTrack, localStream || videoStream);
        setIsVideoOff(false);

        const callRef = doc(db, 'calls', activeCall.id);
        await updateDoc(callRef, { type: 'video' }).catch(() => {});
        setActiveCall((prev) => (prev ? { ...prev, type: 'video' } : null));

        const offer = await pcRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pcRef.current.setLocalDescription(offer);
        await updateDoc(callRef, {
          offer: { sdp: offer.sdp, type: offer.type },
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Upgrade to video error:', err);
    }
  };

  const startGroupCall = async (
    groupId: string,
    groupName: string,
    participantIds: string[],
    type: CallType
  ) => {
    if (!currentUser || !profile) return;
    const primaryReceiverId = participantIds[0] || groupId;
    await startCall(primaryReceiverId, groupName, '', type);

    if (activeCall) {
      const callRef = doc(db, 'calls', activeCall.id);
      await updateDoc(callRef, {
        isGroupCall: true,
        groupId,
        groupName,
        participants: participantIds,
      }).catch(() => {});
      setActiveCall((prev) =>
        prev
          ? {
              ...prev,
              isGroupCall: true,
              groupId,
              groupName,
              participants: participantIds,
            }
          : null
      );
    }

    for (const pId of participantIds) {
      if (pId !== currentUser.uid && pId !== primaryReceiverId) {
        addDoc(collection(db, 'notifications'), {
          userId: pId,
          type: 'call',
          title: `Group ${type === 'video' ? 'Video' : 'Voice'} Call`,
          body: `${profile.displayName || profile.username} started a group call in ${groupName}`,
          senderId: currentUser.uid,
          callId: activeCall?.id || groupId,
          read: false,
          createdAt: Date.now(),
        }).catch(() => {});
      }
    }
  };

  const createCallLink = async (type: CallType): Promise<string> => {
    const linkId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const host = profile?.displayName || profile?.username || 'Chatcon User';
    return `${origin}/#call-link?id=${linkId}&type=${type}&host=${encodeURIComponent(host)}`;
  };

  const joinCallLink = async (linkId: string, type: CallType, hostName = 'Call Link Host') => {
    if (!currentUser || !profile) return;
    await startCall(`host_${linkId}`, hostName, '', type);
  };

  const addParticipantToActiveCall = async (userId: string, userName: string, userPhoto?: string) => {
    if (!activeCall || !currentUser || !profile) return;
    try {
      const callRef = doc(db, 'calls', activeCall.id);
      await updateDoc(callRef, {
        isGroupCall: true,
        participants: arrayUnion(userId),
      });
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'call',
        title: `Join ongoing ${activeCall.type} call`,
        body: `${profile.displayName || profile.username} invited you to join an active call`,
        senderId: currentUser.uid,
        callId: activeCall.id,
        read: false,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('Failed to add participant to call:', err);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  const toggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  const toggleNoiseSuppression = () => {
    setNoiseSuppression((prev) => !prev);
  };

  const sendReaction = async (emoji: string) => {
    if (!activeCall || !currentUser) return;
    try {
      const callRef = doc(db, 'calls', activeCall.id);
      await updateDoc(callRef, {
        reaction: {
          emoji,
          senderId: currentUser.uid,
          timestamp: Date.now(),
        },
      });
      setLatestReaction({
        emoji,
        senderName: 'You',
        id: Date.now(),
      });
      soundManager.playReact();
    } catch (err) {
      console.warn('Failed to send reaction:', err);
    }
  };

  const switchCamera = async () => {
    if (!localStream || !pcRef.current) return;
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacingMode },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      const oldVideoTrack = localStream.getVideoTracks()[0];
      if (oldVideoTrack) oldVideoTrack.stop();

      localStream.removeTrack(oldVideoTrack);
      localStream.addTrack(newVideoTrack);

      setFacingMode(nextFacingMode);
      setLocalStream(new MediaStream(localStream.getTracks()));
    } catch (err) {
      console.warn('Switch camera error:', err);
    }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current || !localStream) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          originalVideoTrackRef.current = sender.track;
          await sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          stopScreenShareInternal();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    } else {
      await stopScreenShareInternal();
    }
  };

  const stopScreenShareInternal = async () => {
    if (pcRef.current && originalVideoTrackRef.current) {
      const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(originalVideoTrackRef.current);
      }
      originalVideoTrackRef.current = null;
    }
    setIsScreenSharing(false);
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        isSpeakerOn,
        isScreenSharing,
        callDuration,
        facingMode,
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
        startCall,
        startGroupCall,
        createCallLink,
        joinCallLink,
        addParticipantToActiveCall,
        upgradeToVideo,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
        toggleScreenShare,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
