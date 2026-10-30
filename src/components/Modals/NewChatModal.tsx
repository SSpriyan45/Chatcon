import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  limit,
  setDoc,
  doc,
  addDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useFollow } from '../../context/FollowContext';
import { soundManager } from '../../utils/sound';
import { formatPhoneForCall } from '../../utils/phone';
import { UserProfile } from '../../types';
import {
  Search,
  UserPlus,
  UserCheck,
  X,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Check,
  Clock,
  Phone,
  PhoneCall,
  Copy,
  Lock,
  Instagram,
  UserMinus
} from 'lucide-react';
import { formatLastSeen } from '../../utils/formatters';

export const NewChatModal: React.FC = () => {
  const { currentUser, profile, blockedUserIds, toggleContact } = useAuth();
  const { isNewChatModalOpen, setIsNewChatModalOpen, openChat } = useUI();
  const {
    getFollowStatus,
    isFriend,
    getFriendPhoneNumber,
    sendFollowRequest,
    cancelFollowRequest,
    acceptFollowRequest,
    declineFollowRequest,
    incomingRequests
  } = useFollow();

  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentInvites, setSentInvites] = useState<Record<string, boolean>>({});
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [actionInfoModal, setActionInfoModal] = useState<{
    targetUser: UserProfile;
    status: 'none' | 'pending_sent';
  } | null>(null);

  useEffect(() => {
    if (!isNewChatModalOpen || !currentUser) return;
    fetchUsers();
  }, [isNewChatModalOpen, currentUser]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), limit(50));
      const snap = await getDocs(q);
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const u = d.data() as UserProfile;
        if (
          d.id !== currentUser?.uid &&
          !blockedUserIds.includes(d.id) &&
          u.allowSearchByUsername !== false
        ) {
          list.push(u);
        }
      });
      setUsers(list);
    } catch (err) {
      console.warn('Error fetching users directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (targetUser: UserProfile) => {
    if (!currentUser || !profile) return;
    const status = getFollowStatus(targetUser.uid);

    // If not accepted yet, show the Instagram-style follow request requirement dialog
    if (status !== 'accepted') {
      setActionInfoModal({
        targetUser,
        status: status === 'pending_sent' ? 'pending_sent' : 'none',
      });
      return;
    }

    try {
      const sortedIds = [currentUser.uid, targetUser.uid].sort();
      const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
      const chatRef = doc(db, 'privateChats', chatId);

      await setDoc(
        chatRef,
        {
          id: chatId,
          participants: sortedIds,
          participantDetails: {
            [currentUser.uid]: {
              displayName: profile.displayName || profile.username,
              photoURL: profile.photoURL,
              username: profile.username,
            },
            [targetUser.uid]: {
              displayName: targetUser.displayName || targetUser.username,
              photoURL: targetUser.photoURL,
              username: targetUser.username,
            },
          },
          isExclusiveRoom: false,
          updatedAt: Date.now(),
          createdAt: Date.now(),
        },
        { merge: true }
      );

      setIsNewChatModalOpen(false);
      openChat(chatId, 'private');
    } catch (err) {
      console.warn('Failed to start chat:', err);
    }
  };

  const handleCopyPhone = (phoneNumber: string, uid: string) => {
    navigator.clipboard.writeText(phoneNumber);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const handleSendPrivateRoomInvite = async (targetUser: UserProfile) => {
    if (!currentUser || !profile) return;
    const inviteId = `${currentUser.uid}_${targetUser.uid}_${Date.now()}`;

    try {
      await setDoc(doc(db, 'privateInvites', inviteId), {
        id: inviteId,
        senderId: currentUser.uid,
        senderUsername: profile.username,
        senderName: profile.displayName || currentUser.displayName || 'User',
        senderPhoto: profile.photoURL || currentUser.photoURL || '',
        receiverId: targetUser.uid,
        receiverUsername: targetUser.username,
        receiverName: targetUser.displayName,
        receiverPhoto: targetUser.photoURL || '',
        status: 'pending',
        createdAt: Date.now(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: targetUser.uid,
        type: 'private_invite',
        title: 'Private 2-User Chat Invitation',
        body: `@${profile.username} invited you to an exclusive 2-user private room.`,
        senderId: currentUser.uid,
        inviteId,
        read: false,
        createdAt: Date.now(),
      });

      soundManager.playSend();
      setSentInvites((prev) => ({ ...prev, [targetUser.uid]: true }));
    } catch (err) {
      console.warn('Failed to send private room invite:', err);
    }
  };

  if (!isNewChatModalOpen) return null;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>Start New Chat</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-cyan-400 border border-cyan-500/30">
                  Instagram Style
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Follow friends to start chatting and reveal phone numbers
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewChatModalOpen(false)}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative my-3">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by @username or name..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-neutral-400">Loading user directory...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <p className="text-sm font-semibold text-neutral-400">No users found</p>
              <p className="text-[11px] text-neutral-600">Check the spelling or try a different @username</p>
            </div>
          ) : (
            filtered.map((user) => {
              const isSavedContact = profile?.savedContactIds?.includes(user.uid);
              const hasSentInvite = sentInvites[user.uid];
              const followStatus = getFollowStatus(user.uid);
              const isAccepted = followStatus === 'accepted';
              const friendPhone = getFriendPhoneNumber(user.uid, user);
              const incomingReq = incomingRequests.find((r) => r.senderId === user.uid);

              return (
                <div
                  key={user.uid}
                  className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 space-y-3 hover:border-neutral-700/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                        alt={user.displayName}
                        className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-neutral-950 ${
                          user.isOnline ? 'bg-cyan-400 ring-2 ring-cyan-400/20' : 'bg-neutral-600'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-white truncate">
                          {user.displayName}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                          @{user.username}
                        </span>

                        {/* Status Chip */}
                        {isAccepted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Friends
                          </span>
                        )}
                        {followStatus === 'pending_sent' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Requested
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {user.about || 'Hey there! I am using Chatcon.'}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                        {user.isOnline ? (
                          <span className="text-cyan-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last seen {formatLastSeen(user.lastSeen)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PHONE NUMBER SECTION: Compulsory & Publicly Displayed */}
                  <div className="pt-2 border-t border-neutral-800/80">
                    <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <span>Phone Number</span>
                            <span className="text-emerald-400">✓ Public</span>
                          </div>
                          <span className="font-mono text-white text-xs font-semibold">
                            {user.phoneNumber || friendPhone || 'No phone number added'}
                          </span>
                        </div>
                      </div>

                      {(user.phoneNumber || friendPhone) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleCopyPhone(user.phoneNumber || friendPhone || '', user.uid)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                            title="Copy Phone Number"
                          >
                            {copiedUid === user.uid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={`tel:${formatPhoneForCall(user.phoneNumber || friendPhone)}`}
                            className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                            title="Call"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INSTAGRAM-STYLE ACTION BUTTONS */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-800/80">
                    {/* 1. Follow / Requested / Confirm Action */}
                    {followStatus === 'accepted' ? (
                      <button
                        onClick={() => handleStartChat(user)}
                        className="py-2 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-cyan-600/20"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    ) : followStatus === 'pending_sent' ? (
                      <button
                        onClick={() => cancelFollowRequest(user.uid)}
                        className="py-2 px-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        title="Cancel Follow Request"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Requested</span>
                      </button>
                    ) : followStatus === 'pending_received' ? (
                      <button
                        onClick={async () => {
                          if (incomingReq) {
                            const cid = await acceptFollowRequest(incomingReq);
                            if (cid) {
                              setIsNewChatModalOpen(false);
                              openChat(cid, 'private');
                            }
                          }
                        }}
                        className="py-2 px-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => sendFollowRequest(user)}
                        className="py-2 px-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-cyan-600/20"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </button>
                    )}

                    {/* 2. Contacts Toggle */}
                    <button
                      onClick={() => toggleContact(user.uid)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        isSavedContact
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {isSavedContact ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Add Contact</span>
                        </>
                      )}
                    </button>

                    {/* 3. 2-User Room Invite */}
                    <button
                      onClick={() => handleSendPrivateRoomInvite(user)}
                      disabled={hasSentInvite}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        hasSentInvite
                          ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                      }`}
                      title="Send 2-User Private Lock Room Invite"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{hasSentInvite ? 'Sent' : 'Private Room'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Dialog for unaccepted follow request */}
      {actionInfoModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl relative">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
              <UserPlus className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white">
                Follow Request Required
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Like Instagram, you need to follow{' '}
                <strong className="text-white">@{actionInfoModal.targetUser.username}</strong>{' '}
                and have your request accepted to start chatting and view each other’s phone numbers.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {actionInfoModal.status === 'none' ? (
                <button
                  onClick={async () => {
                    await sendFollowRequest(actionInfoModal.targetUser);
                    setActionInfoModal(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-cyan-600/20"
                >
                  Send Follow Request Now
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-amber-300 flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Follow request already sent — awaiting approval</span>
                </div>
              )}

              <button
                onClick={() => setActionInfoModal(null)}
                className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
