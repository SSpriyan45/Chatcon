import React, { useState, useEffect } from 'react';
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { GroupChat, UserProfile } from '../../types';
import {
  X,
  Shield,
  ShieldAlert,
  UserMinus,
  Copy,
  Check,
  BellOff,
  Bell,
  Pin,
  LogOut,
  Trash2,
  Lock,
  Unlock,
  Users,
  Phone,
  PhoneCall
} from 'lucide-react';
import { formatPhoneForCall } from '../../utils/phone';

interface GroupInfoDrawerProps {
  group: GroupChat;
  onClose: () => void;
  onLeave: () => void;
}

export const GroupInfoDrawer: React.FC<GroupInfoDrawerProps> = ({
  group,
  onClose,
  onLeave,
}) => {
  const { currentUser, profile, isAdmin: isAppAdmin } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhoneUid, setCopiedPhoneUid] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'leave' | 'delete' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isGroupAdmin = currentUser ? group.admins.includes(currentUser.uid) : false;
  const isCreator = currentUser ? group.createdBy === currentUser.uid : false;
  const isMuted = currentUser ? group.mutedBy?.includes(currentUser.uid) : false;
  const isPinned = currentUser ? group.pinnedBy?.includes(currentUser.uid) : false;

  useEffect(() => {
    const fetchMemberProfiles = async () => {
      if (!group.members || group.members.length === 0) return;
      setLoadingMembers(true);
      try {
        const memberList: UserProfile[] = [];
        // Fetch up to members
        for (const uid of group.members) {
          const q = query(collection(db, 'users'), where('uid', '==', uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            memberList.push(snap.docs[0].data() as UserProfile);
          }
        }
        setMembers(memberList);
      } catch (err) {
        console.error('Error fetching group members:', err);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMemberProfiles();
  }, [group.members]);

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePromoteAdmin = async (targetUid: string) => {
    if (!isGroupAdmin && !isAppAdmin) return;
    const newAdmins = [...group.admins, targetUid];
    await updateDoc(doc(db, 'groups', group.id), { admins: newAdmins });
  };

  const handleDemoteAdmin = async (targetUid: string) => {
    if (!isGroupAdmin && !isAppAdmin) return;
    if (targetUid === group.createdBy) return; // creator cannot be demoted
    const newAdmins = group.admins.filter((id) => id !== targetUid);
    await updateDoc(doc(db, 'groups', group.id), { admins: newAdmins });
  };

  const handleRemoveMember = async (targetUid: string) => {
    if (!isGroupAdmin && !isAppAdmin) return;
    const newMembers = group.members.filter((id) => id !== targetUid);
    const newAdmins = group.admins.filter((id) => id !== targetUid);
    await updateDoc(doc(db, 'groups', group.id), {
      members: newMembers,
      admins: newAdmins,
    });
  };

  const toggleAdminOnly = async () => {
    if (!isGroupAdmin && !isAppAdmin) return;
    await updateDoc(doc(db, 'groups', group.id), {
      adminOnlyMessages: !group.adminOnlyMessages,
    });
  };

  const toggleMute = async () => {
    if (!currentUser) return;
    const mutedList = group.mutedBy || [];
    const newMuted = isMuted
      ? mutedList.filter((id) => id !== currentUser.uid)
      : [...mutedList, currentUser.uid];
    await updateDoc(doc(db, 'groups', group.id), { mutedBy: newMuted });
  };

  const togglePin = async () => {
    if (!currentUser) return;
    const pinnedList = group.pinnedBy || [];
    const newPinned = isPinned
      ? pinnedList.filter((id) => id !== currentUser.uid)
      : [...pinnedList, currentUser.uid];
    await updateDoc(doc(db, 'groups', group.id), { pinnedBy: newPinned });
  };

  const handleLeaveGroup = async () => {
    if (!currentUser) return;
    setActionLoading(true);
    try {
      const newMembers = group.members.filter((id) => id !== currentUser.uid);
      const newAdmins = group.admins.filter((id) => id !== currentUser.uid);
      await updateDoc(doc(db, 'groups', group.id), {
        members: newMembers,
        admins: newAdmins,
      });
      onLeave();
    } catch (err) {
      console.error('Failed to leave group:', err);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isCreator && !isAppAdmin) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'groups', group.id));
      onLeave();
    } catch (err) {
      console.error('Failed to delete group:', err);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-red-400" />
          Group Information
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Group Hero */}
        <div className="flex flex-col items-center text-center">
          <img
            src={group.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${group.name}`}
            alt={group.name}
            className="w-24 h-24 rounded-3xl bg-neutral-800 border-2 border-red-500 shadow-xl p-1 mb-3"
          />
          <h2 className="text-xl font-bold text-white">{group.name}</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            {group.description || 'No description provided.'}
          </p>
          <span className="text-[11px] text-red-400 mt-2 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 font-medium">
            {group.members.length} participants
          </span>
        </div>

        {/* Group Settings / Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-2xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
              isMuted
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            <span>{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          <button
            onClick={togglePin}
            className={`p-3 rounded-2xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
              isPinned
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <Pin className="w-4 h-4" />
            <span>{isPinned ? 'Pinned' : 'Pin'}</span>
          </button>
        </div>

        {/* Invite Code */}
        <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800">
          <span className="text-xs font-medium text-neutral-400 block mb-1">Group Invite Code</span>
          <div className="flex items-center justify-between">
            <span className="font-mono text-red-400 text-sm font-semibold tracking-wider">
              {group.inviteCode}
            </span>
            <button
              onClick={handleCopyInvite}
              className="px-2.5 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-red-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Admin Permissions Toggle */}
        {(isGroupAdmin || isAppAdmin) && (
          <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-white block">Only Admins Can Send</span>
              <span className="text-[11px] text-neutral-400">Restricts message posting to admins</span>
            </div>
            <button
              onClick={toggleAdminOnly}
              className={`p-2 rounded-xl transition-colors ${
                group.adminOnlyMessages
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {group.adminOnlyMessages ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Members ({group.members.length})
            </h4>
          </div>

          <div className="space-y-2">
            {loadingMembers ? (
              <div className="text-center py-4 text-xs text-neutral-500">Loading members...</div>
            ) : (
              members.map((member) => {
                const isAdminMember = group.admins.includes(member.uid);
                const isMemberCreator = group.createdBy === member.uid;
                const isMe = currentUser?.uid === member.uid;

                return (
                  <div
                    key={member.uid}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={member.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.username}`}
                        alt={member.displayName}
                        className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>{member.displayName}</span>
                          {isMe && <span className="text-[10px] text-neutral-500">(You)</span>}
                        </div>
                        <div className="text-[10px] text-neutral-400">@{member.username}</div>
                        {member.phoneNumber && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-cyan-300 font-mono">
                            <Phone className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{member.phoneNumber}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(member.phoneNumber || '');
                                setCopiedPhoneUid(member.uid);
                                setTimeout(() => setCopiedPhoneUid(null), 2000);
                              }}
                              className="p-0.5 text-neutral-400 hover:text-white transition-colors"
                              title="Copy Phone"
                            >
                              {copiedPhoneUid === member.uid ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                            <a
                              href={`tel:${formatPhoneForCall(member.phoneNumber)}`}
                              className="p-0.5 text-cyan-400 hover:text-cyan-300 transition-colors"
                              title="Direct Call"
                            >
                              <PhoneCall className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isMemberCreator ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                          Creator
                        </span>
                      ) : isAdminMember ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                          Admin
                        </span>
                      ) : null}

                      {/* Admin controls for member */}
                      {(isGroupAdmin || isAppAdmin) && !isMe && (
                        <div className="flex items-center gap-1 ml-1">
                          {isAdminMember && !isMemberCreator && (
                            <button
                              onClick={() => handleDemoteAdmin(member.uid)}
                              className="p-1 text-neutral-400 hover:text-amber-400 transition-colors"
                              title="Dismiss as Admin"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isAdminMember && (
                            <button
                              onClick={() => handlePromoteAdmin(member.uid)}
                              className="p-1 text-neutral-400 hover:text-red-400 transition-colors"
                              title="Make Group Admin"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isMemberCreator && (
                            <button
                              onClick={() => handleRemoveMember(member.uid)}
                              className="p-1 text-neutral-400 hover:text-red-400 transition-colors"
                              title="Remove from Group"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Exit / Delete Group buttons */}
        <div className="pt-4 border-t border-neutral-800 space-y-2">
          {confirmAction === 'leave' ? (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-center">
              <p className="text-xs text-red-300 font-medium">Leave this group?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleLeaveGroup}
                  className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1"
                >
                  {actionLoading ? 'Leaving...' : 'Confirm Leave'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAction('leave')}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-red-500/40 text-red-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Leave Group
            </button>
          )}

          {(isCreator || isAppAdmin) && (
            confirmAction === 'delete' ? (
              <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl space-y-2 text-center">
                <p className="text-xs text-red-300 font-medium">Permanently delete this group for everyone?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleDeleteGroup}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1"
                  >
                    {actionLoading ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction('delete')}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 text-red-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Group for Everyone
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
