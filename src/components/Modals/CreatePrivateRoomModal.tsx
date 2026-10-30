import React, { useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { ShieldCheck, Copy, Check, Users, Key, AlertCircle, ArrowRight, X } from 'lucide-react';

export const CreatePrivateRoomModal: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const { isPrivateRoomModalOpen, setIsPrivateRoomModalOpen, openChat } = useUI();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [partnerUsername, setPartnerUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [generatedCode] = useState(() => 'CC-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPrivateRoomModalOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile) return;
    setError(null);
    setLoading(true);

    try {
      let partnerUid = '';
      let partnerData: any = null;

      // If partner username provided, verify they exist
      if (partnerUsername.trim()) {
        const cleanUser = partnerUsername.trim().toLowerCase().replace('@', '');
        const q = query(collection(db, 'users'), where('username', '==', cleanUser));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error(`User @${cleanUser} not found. Please verify the username.`);
        }
        const partnerDoc = snap.docs[0];
        partnerUid = partnerDoc.id;
        partnerData = partnerDoc.data();

        if (partnerUid === currentUser.uid) {
          throw new Error('You cannot create an exclusive private room with yourself.');
        }
      }

      const roomRef = doc(collection(db, 'privateChats'));
      const participants = partnerUid ? [currentUser.uid, partnerUid] : [currentUser.uid];

      const participantDetails: any = {
        [currentUser.uid]: {
          displayName: profile.displayName || profile.username,
          photoURL: profile.photoURL,
          username: profile.username,
        }
      };

      if (partnerUid && partnerData) {
        participantDetails[partnerUid] = {
          displayName: partnerData.displayName || partnerData.username,
          photoURL: partnerData.photoURL,
          username: partnerData.username,
        };
      }

      await setDoc(roomRef, {
        id: roomRef.id,
        participants,
        participantDetails,
        isExclusiveRoom: true,
        roomCode: generatedCode,
        roomLocked: !!partnerUid, // if partner chosen right away, room is locked to them!
        unreadCount: {},
        pinnedBy: [],
        mutedBy: [],
        typing: {},
        clearedBy: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessage: {
          text: '🔒 Exclusive 2-User Private Room initialized. Only 2 participants can ever access this room.',
          senderId: 'system',
          createdAt: Date.now(),
          type: 'text'
        }
      });

      setIsPrivateRoomModalOpen(false);
      openChat(roomRef.id, 'private');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create private room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile) return;
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) return;

    setError(null);
    setLoading(true);

    try {
      const q = query(
        collection(db, 'privateChats'),
        where('roomCode', '==', cleanCode),
        where('isExclusiveRoom', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('Invalid room code or room no longer exists.');
      }

      const roomDoc = snap.docs[0];
      const roomData = roomDoc.data();
      const currentParticipants: string[] = roomData.participants || [];

      // Check if already in the room
      if (currentParticipants.includes(currentUser.uid)) {
        setIsPrivateRoomModalOpen(false);
        openChat(roomDoc.id, 'private');
        return;
      }

      // Check strictly 2-user capacity!
      if (currentParticipants.length >= 2) {
        throw new Error('Access Denied: This exclusive private room already has 2 participants and is permanently locked.');
      }

      // Join room as second participant and lock room
      const newParticipants = [...currentParticipants, currentUser.uid];
      const newParticipantDetails = {
        ...roomData.participantDetails,
        [currentUser.uid]: {
          displayName: profile.displayName || profile.username,
          photoURL: profile.photoURL,
          username: profile.username,
        }
      };

      await updateDoc(doc(db, 'privateChats', roomDoc.id), {
        participants: newParticipants,
        participantDetails: newParticipantDetails,
        roomLocked: true,
        updatedAt: Date.now(),
      });

      setIsPrivateRoomModalOpen(false);
      openChat(roomDoc.id, 'private');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={() => setIsPrivateRoomModalOpen(false)}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Private 2-User Room</h2>
            <p className="text-xs text-neutral-400">Strictly 2 participants maximum. 3rd user blocked.</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 mb-5">
          <button
            type="button"
            onClick={() => { setMode('create'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'create' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Create New Room
          </button>
          <button
            type="button"
            onClick={() => { setMode('join'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'join' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Enter Room Code
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Generated Secret Room Code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 font-mono text-red-400 text-sm tracking-wider flex items-center justify-between">
                  <span>{generatedCode}</span>
                  <Key className="w-4 h-4 text-neutral-600" />
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  {copied ? <Check className="w-4 h-4 text-red-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Share this code with the other person to let them join.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Invite Directly by Username (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-semibold">@</span>
                <input
                  type="text"
                  value={partnerUsername}
                  onChange={(e) => setPartnerUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 lowercase"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Leave blank if you prefer sharing the secret room code.
              </p>
            </div>

            <div className="p-3 bg-red-950/30 border border-red-800/30 rounded-xl text-xs text-neutral-300 flex items-start gap-2.5">
              <Users className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <strong>Guaranteed Privacy:</strong> The room locks immediately when the second user joins. No third user can ever join or eavesdrop.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-600/20"
            >
              {loading ? 'Creating Room...' : 'Start Private 2-User Chat'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinByCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Enter 6-Digit Room Code
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. CC-7B2A9"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-red-500 tracking-wider font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-400">
              Only enter codes received directly from the person you want to chat privately with.
            </div>

            <button
              type="submit"
              disabled={loading || !joinCode}
              className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {loading ? 'Verifying & Joining...' : 'Unlock & Join Private Room'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
