import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Video,
  Search,
  Users,
  Check,
  Link2,
  ShieldCheck
} from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile, CallType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

interface GroupCallModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  memberIds: string[];
  onClose: () => void;
  onOpenCallLink?: () => void;
}

export const GroupCallModal: React.FC<GroupCallModalProps> = ({
  isOpen,
  groupId,
  groupName,
  memberIds,
  onClose,
  onOpenCallLink,
}) => {
  const { currentUser } = useAuth();
  const { startGroupCall } = useCall();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setLoading(true);

    const fetchMembers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserProfile[] = [];
        const initialSelected = new Set<string>();

        snap.forEach((docSnap) => {
          const u = docSnap.data() as UserProfile;
          if (memberIds.includes(u.uid) && u.uid !== currentUser.uid) {
            list.push(u);
            initialSelected.add(u.uid); // Default select all members for group call
          }
        });

        setMembers(list);
        setSelectedIds(initialSelected);
      } catch (err) {
        console.warn('Failed to load group call members:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [isOpen, groupId, memberIds, currentUser]);

  if (!isOpen) return null;

  const toggleSelect = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.uid)));
    }
  };

  const handleStartCall = async (type: CallType) => {
    if (selectedIds.size === 0) return;
    const participantList = Array.from(selectedIds);
    await startGroupCall(groupId, groupName, participantList, type);
    onClose();
  };

  const filteredMembers = members.filter((m) => {
    const name = (m.displayName || m.username || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#111b21] border border-neutral-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden text-neutral-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-xl hover:bg-neutral-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 pr-6">
            <h3 className="text-lg font-bold text-white tracking-tight truncate">
              Call {groupName}
            </h3>
            <p className="text-xs text-neutral-400">
              Select members to start a group call ({selectedIds.size}/{members.length})
            </p>
          </div>
        </div>

        {/* Search & Select All */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search group members..."
              className="w-full bg-[#202c33] border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-neutral-700 text-xs font-semibold text-emerald-400 border border-neutral-800 shrink-0 transition-colors"
          >
            {selectedIds.size === members.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 pr-1 -mr-1 custom-scrollbar min-h-[160px] max-h-[320px] mb-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading members...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No matching group members found.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = selectedIds.has(member.uid);
              return (
                <div
                  key={member.uid}
                  onClick={() => toggleSelect(member.uid)}
                  className="py-2.5 px-2 flex items-center justify-between rounded-xl hover:bg-[#202c33]/70 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        member.photoURL ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${member.displayName || member.username}`
                      }
                      alt={member.displayName || member.username}
                      className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {member.displayName || member.username}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        @{member.username}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'border-neutral-700 bg-neutral-900'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Call Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-800/80">
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => handleStartCall('voice')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>Group Voice Call</span>
          </button>

          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => handleStartCall('video')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Video className="w-4 h-4" />
            <span>Group Video Call</span>
          </button>
        </div>

        {/* Call Link shortcut */}
        {onOpenCallLink && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCallLink();
            }}
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 py-1 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 -rotate-45" />
            <span>Or create a group call link to share</span>
          </button>
        )}
      </div>
    </div>
  );
};
