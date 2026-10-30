import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { FollowRequest, UserProfile } from '../types';
import { soundManager } from '../utils/sound';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

interface FollowContextType {
  incomingRequests: FollowRequest[];
  outgoingRequests: FollowRequest[];
  acceptedFollows: FollowRequest[];
  pendingCount: number;
  loading: boolean;
  sendFollowRequest: (targetUser: UserProfile) => Promise<boolean>;
  cancelFollowRequest: (targetUserId: string) => Promise<boolean>;
  acceptFollowRequest: (request: FollowRequest) => Promise<string | null>;
  declineFollowRequest: (requestId: string) => Promise<boolean>;
  unfollow: (targetUserId: string) => Promise<boolean>;
  getFollowStatus: (targetUserId: string) => 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  isFriend: (targetUserId: string) => boolean;
  getFriendPhoneNumber: (targetUserId: string, targetUser?: UserProfile | null) => string | null;
}

const FollowContext = createContext<FollowContextType | undefined>(undefined);

export const FollowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, profile } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<FollowRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FollowRequest[]>([]);
  const [acceptedFollows, setAcceptedFollows] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to follow requests where current user is receiver
  useEffect(() => {
    if (!currentUser) {
      setIncomingRequests([]);
      setAcceptedFollows([]);
      setLoading(false);
      return;
    }

    const qReceiver = query(
      collection(db, 'followRequests'),
      where('receiverId', '==', currentUser.uid)
    );

    const unsubReceiver = onSnapshot(
      qReceiver,
      (snapshot) => {
        const incoming: FollowRequest[] = [];
        const acceptedAsReceiver: FollowRequest[] = [];

        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as FollowRequest;
          if (data.status === 'pending') {
            incoming.push(data);
          } else if (data.status === 'accepted') {
            acceptedAsReceiver.push(data);
          }
        });

        setIncomingRequests(incoming);
        setAcceptedFollows((prev) => {
          // Merge accepted from both receiver and sender queries
          const otherAccepted = prev.filter((r) => r.senderId === currentUser.uid);
          return [...otherAccepted, ...acceptedAsReceiver];
        });
        setLoading(false);
      },
      (error) => {
        console.warn('Receiver follow requests listener notice:', error.message);
        handleFirestoreError(error, OperationType.GET, 'followRequests (receiver)');
      }
    );

    // Listen to follow requests where current user is sender
    const qSender = query(
      collection(db, 'followRequests'),
      where('senderId', '==', currentUser.uid)
    );

    const unsubSender = onSnapshot(
      qSender,
      (snapshot) => {
        const outgoing: FollowRequest[] = [];
        const acceptedAsSender: FollowRequest[] = [];

        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as FollowRequest;
          if (data.status === 'pending') {
            outgoing.push(data);
          } else if (data.status === 'accepted') {
            acceptedAsSender.push(data);
          }
        });

        setOutgoingRequests(outgoing);
        setAcceptedFollows((prev) => {
          const otherAccepted = prev.filter((r) => r.receiverId === currentUser.uid);
          return [...acceptedAsSender, ...otherAccepted];
        });
      },
      (error) => {
        console.warn('Sender follow requests listener notice:', error.message);
        handleFirestoreError(error, OperationType.GET, 'followRequests (sender)');
      }
    );

    return () => {
      unsubReceiver();
      unsubSender();
    };
  }, [currentUser]);

  // Set of UIDs that are mutual accepted friends
  const friendUids = React.useMemo(() => {
    if (!currentUser) return new Set<string>();
    const set = new Set<string>();
    acceptedFollows.forEach((r) => {
      if (r.senderId === currentUser.uid) {
        set.add(r.receiverId);
      } else if (r.receiverId === currentUser.uid) {
        set.add(r.senderId);
      }
    });
    return set;
  }, [acceptedFollows, currentUser]);

  const isFriend = (targetUserId: string): boolean => {
    return friendUids.has(targetUserId);
  };

  const getFollowStatus = (
    targetUserId: string
  ): 'none' | 'pending_sent' | 'pending_received' | 'accepted' => {
    if (friendUids.has(targetUserId)) return 'accepted';
    if (outgoingRequests.some((r) => r.receiverId === targetUserId)) return 'pending_sent';
    if (incomingRequests.some((r) => r.senderId === targetUserId)) return 'pending_received';
    return 'none';
  };

  const getFriendPhoneNumber = (
    targetUserId: string,
    targetUser?: UserProfile | null
  ): string | null => {
    // Phone numbers are compulsory and publicly visible to all users
    if (targetUser?.phoneNumber && targetUser.phoneNumber.trim()) {
      return targetUser.phoneNumber.trim();
    }

    // Fallback: check stored followRequest document (accepted, incoming, or outgoing)
    const match = [...acceptedFollows, ...incomingRequests, ...outgoingRequests].find(
      (r) =>
        (r.senderId === targetUserId && r.receiverId === currentUser?.uid) ||
        (r.receiverId === targetUserId && r.senderId === currentUser?.uid)
    );

    if (match) {
      if (match.senderId === targetUserId && match.senderPhoneNumber) {
        return match.senderPhoneNumber;
      }
      if (match.receiverId === targetUserId && match.receiverPhoneNumber) {
        return match.receiverPhoneNumber;
      }
    }

    return null;
  };

  const sendFollowRequest = async (targetUser: UserProfile): Promise<boolean> => {
    if (!currentUser || !profile) return false;
    const reqId = `${currentUser.uid}_${targetUser.uid}`;

    try {
      const followData: FollowRequest = {
        id: reqId,
        senderId: currentUser.uid,
        senderUsername: profile.username || 'user',
        senderName: profile.displayName || currentUser.displayName || 'User',
        senderPhoto: profile.photoURL || currentUser.photoURL || '',
        senderPhoneNumber: profile.phoneNumber || '',
        receiverId: targetUser.uid,
        receiverUsername: targetUser.username || 'user',
        receiverName: targetUser.displayName || 'User',
        receiverPhoto: targetUser.photoURL || '',
        receiverPhoneNumber: targetUser.phoneNumber || '',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'followRequests', reqId), followData);

      // Create in-app notification for the target user
      await addDoc(collection(db, 'notifications'), {
        userId: targetUser.uid,
        type: 'follow_request',
        title: 'New Follow Request',
        body: `@${profile.username} requested to follow you. Accept to start chatting and share phone numbers.`,
        senderId: currentUser.uid,
        requestId: reqId,
        read: false,
        createdAt: Date.now(),
      });

      soundManager.playSend();
      return true;
    } catch (err) {
      console.error('Failed to send follow request:', err);
      handleFirestoreError(err, OperationType.CREATE, `followRequests/${reqId}`);
      return false;
    }
  };

  const cancelFollowRequest = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) return false;
    const reqId = `${currentUser.uid}_${targetUserId}`;

    try {
      await deleteDoc(doc(db, 'followRequests', reqId));
      return true;
    } catch (err) {
      console.error('Failed to cancel follow request:', err);
      handleFirestoreError(err, OperationType.DELETE, `followRequests/${reqId}`);
      return false;
    }
  };

  const acceptFollowRequest = async (request: FollowRequest): Promise<string | null> => {
    if (!currentUser || !profile) return null;

    try {
      // 1. Mark request as accepted and attach current receiver phone number if available
      await updateDoc(doc(db, 'followRequests', request.id), {
        status: 'accepted',
        receiverPhoneNumber: profile.phoneNumber || '',
        updatedAt: Date.now(),
      });

      // 2. Initialize / ensure the 2-user private chat room exists so they can start chatting right away!
      const sortedIds = [request.senderId, request.receiverId].sort();
      const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
      const chatRef = doc(db, 'privateChats', chatId);

      await setDoc(
        chatRef,
        {
          id: chatId,
          participants: sortedIds,
          participantDetails: {
            [request.senderId]: {
              displayName: request.senderName,
              photoURL: request.senderPhoto || '',
              username: request.senderUsername,
            },
            [request.receiverId]: {
              displayName: profile.displayName || profile.username,
              photoURL: profile.photoURL || '',
              username: profile.username,
            },
          },
          isExclusiveRoom: false,
          updatedAt: Date.now(),
          createdAt: Date.now(),
        },
        { merge: true }
      );

      // 3. Send notification to the original sender
      await addDoc(collection(db, 'notifications'), {
        userId: request.senderId,
        type: 'follow_accepted',
        title: 'Follow Request Accepted!',
        body: `@${profile.username} accepted your follow request. You can now chat and view their phone number!`,
        senderId: currentUser.uid,
        chatId,
        requestId: request.id,
        read: false,
        createdAt: Date.now(),
      });

      soundManager.playReceive();
      return chatId;
    } catch (err) {
      console.error('Failed to accept follow request:', err);
      handleFirestoreError(err, OperationType.UPDATE, `followRequests/${request.id}`);
      return null;
    }
  };

  const declineFollowRequest = async (requestId: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, 'followRequests', requestId));
      return true;
    } catch (err) {
      console.error('Failed to decline follow request:', err);
      handleFirestoreError(err, OperationType.DELETE, `followRequests/${requestId}`);
      return false;
    }
  };

  const unfollow = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const match = acceptedFollows.find(
        (r) =>
          (r.senderId === currentUser.uid && r.receiverId === targetUserId) ||
          (r.receiverId === currentUser.uid && r.senderId === targetUserId)
      );

      if (match) {
        await deleteDoc(doc(db, 'followRequests', match.id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to unfollow:', err);
      handleFirestoreError(err, OperationType.DELETE, `followRequests`);
      return false;
    }
  };

  return (
    <FollowContext.Provider
      value={{
        incomingRequests,
        outgoingRequests,
        acceptedFollows,
        pendingCount: incomingRequests.length,
        loading,
        sendFollowRequest,
        cancelFollowRequest,
        acceptFollowRequest,
        declineFollowRequest,
        unfollow,
        getFollowStatus,
        isFriend,
        getFriendPhoneNumber,
      }}
    >
      {children}
    </FollowContext.Provider>
  );
};

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};
