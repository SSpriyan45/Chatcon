import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  limit,
  setDoc,
  doc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { UserProfile } from '../../types';
import { Users, X, Check, Image, Sparkles } from 'lucide-react';

export const NewGroupModal: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const { isNewGroupModalOpen, setIsNewGroupModalOpen, openChat } = useUI();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [adminOnlyMessages, setAdminOnlyMessages] = useState(false);
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState(() => Math.random().toString(36).substring(7));
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const groupPhoto = `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedAvatarSeed}`;

  useEffect(() => {
    if (!isNewGroupModalOpen || !currentUser) return;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), limit(30));
        const snap = await getDocs(q);
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          if (d.id !== currentUser.uid) {
            list.push(d.data() as UserProfile);
          }
        });
        setUsers(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isNewGroupModalOpen, currentUser]);

  if (!isNewGroupModalOpen) return null;

  const toggleMember = (uid: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile || !groupName.trim()) return;

    setSubmitting(true);
    try {
      const groupRef = doc(collection(db, 'groups'));
      const inviteCode = 'GRP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const members = Array.from(new Set([currentUser.uid, ...selectedMemberIds]));

      await setDoc(groupRef, {
        id: groupRef.id,
        name: groupName.trim(),
        description: description.trim(),
        photoURL: groupPhoto,
        createdBy: currentUser.uid,
        admins: [currentUser.uid],
        members,
        inviteCode,
        adminOnlyMessages,
        pinnedBy: [],
        mutedBy: [],
        typing: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessage: {
          text: `${profile.displayName || profile.username} created group "${groupName.trim()}"`,
          senderId: 'system',
          senderName: 'System',
          createdAt: Date.now(),
          type: 'text'
        }
      });

      setIsNewGroupModalOpen(false);
      openChat(groupRef.id, 'group');
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={() => setIsNewGroupModalOpen(false)}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">New Group</h2>
            <p className="text-xs text-neutral-400">Collaborate with multiple members</p>
          </div>
        </div>

        <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative group shrink-0">
              <img
                src={groupPhoto}
                alt="Group Icon"
                className="w-16 h-16 rounded-2xl bg-neutral-800 border-2 border-red-500 p-1"
              />
              <button
                type="button"
                onClick={() => setSelectedAvatarSeed(Math.random().toString(36).substring(7))}
                className="absolute -bottom-1 -right-1 bg-red-500 hover:bg-red-400 text-neutral-950 p-1 rounded-full shadow transition-all"
                title="Randomize Group Icon"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-300 mb-1">Group Name</label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Project Alpha"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-neutral-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl mb-4">
            <div>
              <span className="text-xs font-medium text-white block">Admin-Only Messages</span>
              <span className="text-[11px] text-neutral-400 block">Only admins can send messages to this group</span>
            </div>
            <input
              type="checkbox"
              checked={adminOnlyMessages}
              onChange={(e) => setAdminOnlyMessages(e.target.checked)}
              className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500"
            />
          </div>

          <label className="block text-xs font-medium text-neutral-300 mb-2">
            Select Participants ({selectedMemberIds.length} selected)
          </label>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-[140px] max-h-[200px] mb-4">
            {loading ? (
              <div className="text-center py-6 text-neutral-500 text-xs">Loading contacts...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-6 text-neutral-500 text-xs">No contacts available to add.</div>
            ) : (
              users.map((user) => {
                const isSelected = selectedMemberIds.includes(user.uid);
                return (
                  <div
                    key={user.uid}
                    onClick={() => toggleMember(user.uid)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-950/40 border-red-500/50 text-white'
                        : 'bg-neutral-950/50 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                        alt={user.displayName}
                        className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700"
                      />
                      <div>
                        <div className="text-xs font-medium text-white">{user.displayName}</div>
                        <div className="text-[10px] text-neutral-400">@{user.username}</div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-red-500 border-red-500 text-neutral-950'
                          : 'border-neutral-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !groupName.trim()}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            {submitting ? 'Creating Group...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
};
