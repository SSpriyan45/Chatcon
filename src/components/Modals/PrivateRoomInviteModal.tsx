import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { PrivateRoomInvite, PrivateChat } from '../../types';
import { soundManager } from '../../utils/sound';
import { ShieldCheck, UserCheck, X, Check, Lock, Sparkles } from 'lucide-react';

export const PrivateRoomInviteModal: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const { openChat } = useUI();
  const [activeInvite, setActiveInvite] = useState<PrivateRoomInvite | null>(null);
  const [processing, setProcessing] = useState(false);

  // Listen for incoming pending invites where currentUser is receiver
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'privateInvites'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = { id: docSnap.id, ...docSnap.data() } as PrivateRoomInvite;
        setActiveInvite(data);
        soundManager.playReceived();
      } else {
        setActiveInvite(null);
      }
    }, (err) => {
      console.warn('Private invites listener notice:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Also listen for invites SENT by current user that were accepted
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'privateInvites'),
      where('senderId', '==', currentUser.uid),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data() as PrivateRoomInvite;
          if (data.roomId) {
            soundManager.playSent();
            openChat(data.roomId, 'private');
          }
        }
      });
    }, (err) => {
      console.warn('Sent invites listener notice:', err.message);
    });

    return () => unsubscribe();
  }, [currentUser, openChat]);

  if (!activeInvite) return null;

  const handleAccept = async () => {
    if (!currentUser || !activeInvite || processing) return;
    setProcessing(true);

    try {
      // 1. Generate unique room code
      const roomCode = `PR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const chatDocRef = doc(collection(db, 'privateChats'));

      // 2. Build strictly 2-participant private chat document
      const newChat: Omit<PrivateChat, 'id'> = {
        participants: [activeInvite.senderId, currentUser.uid],
        participantDetails: {
          [activeInvite.senderId]: {
            displayName: activeInvite.senderName,
            username: activeInvite.senderUsername,
            photoURL: activeInvite.senderPhoto || '',
          },
          [currentUser.uid]: {
            displayName: profile?.displayName || currentUser.displayName || 'User',
            username: profile?.username || 'user',
            photoURL: profile?.photoURL || currentUser.photoURL || '',
          }
        },
        isExclusiveRoom: true,
        roomCode,
        roomLocked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessage: {
          text: `🔒 Exclusive 2-user private room created with @${activeInvite.senderUsername}. No other users can join.`,
          senderId: 'system',
          createdAt: Date.now(),
          type: 'text'
        },
        unreadCount: {
          [activeInvite.senderId]: 0,
          [currentUser.uid]: 0
        }
      };

      await setDoc(chatDocRef, newChat);

      // 3. Update the invitation record
      await updateDoc(doc(db, 'privateInvites', activeInvite.id), {
        status: 'accepted',
        roomId: chatDocRef.id
      });

      // 4. Notify sender
      await addDoc(collection(db, 'notifications'), {
        userId: activeInvite.senderId,
        type: 'private_invite',
        title: 'Private Room Invite Accepted!',
        body: `@${profile?.username || 'User'} accepted your 2-user private room invitation!`,
        senderId: currentUser.uid,
        chatId: chatDocRef.id,
        read: false,
        createdAt: Date.now()
      });

      // 5. Open chat room for current user
      openChat(chatDocRef.id, 'private');
      setActiveInvite(null);
    } catch (err) {
      console.warn('Failed to accept private invite:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!currentUser || !activeInvite || processing) return;
    setProcessing(true);

    try {
      await updateDoc(doc(db, 'privateInvites', activeInvite.id), {
        status: 'declined'
      });

      // Notify sender that invite was declined
      await addDoc(collection(db, 'notifications'), {
        userId: activeInvite.senderId,
        type: 'private_invite',
        title: 'Private Room Invite Declined',
        body: `@${profile?.username || 'User'} was unable to accept your private room invitation.`,
        senderId: currentUser.uid,
        read: false,
        createdAt: Date.now()
      });

      setActiveInvite(null);
    } catch (err) {
      console.warn('Failed to decline private invite:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-red-500/40 shadow-2xl p-6 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center text-center">
          {/* Header icon badge */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-teal-400 p-0.5 shadow-lg shadow-red-500/30 mb-3 ring-4 ring-red-500/20">
            <div className="w-full h-full bg-neutral-950 rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-red-400" />
            </div>
          </div>

          <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Exclusive 2-User Chat Request
          </span>

          <h3 className="text-lg font-bold text-white mb-2">
            Private Room Invitation
          </h3>

          {/* Sender profile card */}
          <div className="w-full bg-neutral-950/80 rounded-2xl p-3.5 border border-neutral-800 flex items-center gap-3.5 mb-4 text-left">
            <img
              src={activeInvite.senderPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeInvite.senderUsername}`}
              alt={activeInvite.senderName}
              className="w-12 h-12 rounded-xl bg-neutral-800 object-cover border border-red-500/30 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white truncate">
                {activeInvite.senderName}
              </h4>
              <p className="text-xs text-red-400 font-medium truncate">
                @{activeInvite.senderUsername}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Invited you to a private 2-person room
              </p>
            </div>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed mb-6">
            Only you and <strong className="text-white">@{activeInvite.senderUsername}</strong> will have access to this conversation. No third user can join.
          </p>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-2">
            <button
              onClick={handleAccept}
              disabled={processing}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Accept & Enter Private Room</span>
                </>
              )}
            </button>

            <button
              onClick={handleDecline}
              disabled={processing}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
