import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Search,
  Check,
  Copy,
  Link2,
  Send,
  ShieldCheck
} from 'lucide-react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

interface InCallAddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InCallAddParticipantModal: React.FC<InCallAddParticipantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const { activeCall, addParticipantToActiveCall, createCallLink } = useCall();
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setLoading(true);

    const fetchContacts = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          if (
            d.id !== currentUser.uid &&
            d.id !== activeCall?.callerId &&
            d.id !== activeCall?.receiverId
          ) {
            list.push(d.data() as UserProfile);
          }
        });
        setContacts(list);
      } catch (err) {
        console.warn('Failed to load contacts for in-call addition:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [isOpen, currentUser, activeCall]);

  if (!isOpen) return null;

  const handleInvite = async (user: UserProfile) => {
    try {
      await addParticipantToActiveCall(
        user.uid,
        user.displayName || user.username,
        user.photoURL
      );
      setInvitedIds((prev) => new Set(prev).add(user.uid));
    } catch {}
  };

  const handleCopyCallLink = async () => {
    try {
      const type = activeCall?.type || 'video';
      const link = await createCallLink(type);
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const filteredContacts = contacts.filter((c) => {
    const name = (c.displayName || c.username || '').toLowerCase();
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
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Add to call</h3>
            <p className="text-xs text-neutral-400">Invite more people to this active call</p>
          </div>
        </div>

        {/* Copy Call Link Pill */}
        <div className="p-3 rounded-2xl bg-[#0b141a] border border-neutral-800/80 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-4 h-4 text-emerald-400 shrink-0 -rotate-45" />
            <div className="text-xs text-neutral-300 truncate">
              Instant join call link
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCallLink}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              copiedLink
                ? 'bg-emerald-600 text-white'
                : 'bg-[#202c33] hover:bg-neutral-700 text-emerald-400'
            }`}
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Search Contacts */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts to add..."
            className="w-full bg-[#202c33] border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 pr-1 -mr-1 custom-scrollbar min-h-[160px] max-h-[300px]">
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading contacts...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No contacts available to invite.
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const hasInvited = invitedIds.has(contact.uid);
              return (
                <div
                  key={contact.uid}
                  className="py-2.5 px-2 flex items-center justify-between rounded-xl hover:bg-[#202c33]/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        contact.photoURL ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${contact.displayName || contact.username}`
                      }
                      alt={contact.displayName || contact.username}
                      className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {contact.displayName || contact.username}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        @{contact.username}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={hasInvited}
                    onClick={() => handleInvite(contact)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      hasInvited
                        ? 'bg-neutral-800 text-neutral-400 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                    }`}
                  >
                    {hasInvited ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Invited</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Invite</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
