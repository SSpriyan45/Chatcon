import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  limit,
  deleteDoc,
  doc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { useUI } from '../../context/UIContext';
import { CallSession, UserProfile } from '../../types';
import { formatMessageTime, formatDuration } from '../../utils/formatters';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  Search,
  X,
  Trash2,
  AlertTriangle,
  Link2,
  Info,
  ShieldCheck
} from 'lucide-react';
import { CallLinkModal } from './CallLinkModal';
import { CallDetailsModal } from './CallDetailsModal';

export const CallsScreen: React.FC = () => {
  const { currentUser } = useAuth();
  const { startCall } = useCall();
  const { openChat } = useUI();

  const [calls, setCalls] = useState<CallSession[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isNewCallOpen, setIsNewCallOpen] = useState(false);
  const [isCallLinkOpen, setIsCallLinkOpen] = useState(false);
  const [selectedCallDetails, setSelectedCallDetails] = useState<CallSession | null>(null);

  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    const q1 = query(
      collection(db, 'calls'),
      where('callerId', '==', currentUser.uid)
    );

    const q2 = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUser.uid)
    );

    let list1: CallSession[] = [];
    let list2: CallSession[] = [];

    const merge = () => {
      const map = new Map<string, CallSession>();
      [...list1, ...list2].forEach((c) => map.set(c.id, c));
      const all = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCalls(all);
      setLoading(false);
    };

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        list1 = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CallSession));
        merge();
      },
      (error) => {
        console.warn('Calls q1 notice:', error.message);
        setLoading(false);
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        list2 = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CallSession));
        merge();
      },
      (error) => {
        console.warn('Calls q2 notice:', error.message);
        setLoading(false);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUser]);

  // Load contacts for new call
  useEffect(() => {
    if (!isNewCallOpen || !currentUser) return;
    const fetchContacts = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(50)));
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          if (d.id !== currentUser.uid) {
            list.push(d.data() as UserProfile);
          }
        });
        setContacts(list);
      } catch (err) {
        console.warn('Failed to load contacts for calls:', err);
      }
    };
    fetchContacts();
  }, [isNewCallOpen, currentUser]);

  const handleDeleteCallLog = async (callId: string) => {
    try {
      await deleteDoc(doc(db, 'calls', callId));
    } catch (err) {
      console.warn('Failed to delete call record:', err);
    }
  };

  const handleClearAllCalls = async () => {
    if (!currentUser || calls.length === 0) return;
    setIsClearing(true);
    try {
      const batch = writeBatch(db);
      calls.forEach((c) => {
        batch.delete(doc(db, 'calls', c.id));
      });
      await batch.commit();
      setShowClearConfirm(false);
    } catch (err) {
      console.warn('Failed to clear calls:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredCalls = calls.filter((c) => {
    const isCaller = c.callerId === currentUser?.uid;
    const isMissed = c.status === 'missed' || c.status === 'rejected';

    if (filter === 'missed' && !isMissed) return false;
    if (filter === 'incoming' && (isCaller || isMissed)) return false;
    if (filter === 'outgoing' && !isCaller) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const otherName = (isCaller ? c.receiverName : c.callerName)?.toLowerCase() || '';
      return otherName.includes(q);
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111b21] border-r border-neutral-800 overflow-hidden text-neutral-200">
      {/* WhatsApp Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#202c33]/50">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Calls</h2>
          <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-end encrypted voice & video</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {calls.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2 rounded-xl bg-[#202c33] hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition-colors"
              title="Clear Call History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsNewCallOpen(true)}
            className="p-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Call</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Search Bar */}
      <div className="px-4 py-2.5 border-b border-neutral-800 bg-[#111b21]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start a new call..."
            className="w-full bg-[#202c33] border border-neutral-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* WhatsApp Signature "Create Call Link" Action Row */}
      <div
        onClick={() => setIsCallLinkOpen(true)}
        className="px-4 py-3.5 border-b border-neutral-800 flex items-center gap-3.5 hover:bg-[#202c33]/70 transition-colors cursor-pointer select-none group"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/30 group-hover:scale-105 transition-transform">
          <Link2 className="w-6 h-6 -rotate-45" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">Create call link</div>
          <div className="text-xs text-neutral-400">Share a link for your Chatcon call</div>
        </div>
      </div>

      {/* Filter Tabs (All / Missed / Incoming / Outgoing) */}
      <div className="px-4 py-2 border-b border-neutral-800 flex gap-2 overflow-x-auto custom-scrollbar bg-[#111b21]">
        {(['all', 'missed', 'incoming', 'outgoing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold capitalize transition-all whitespace-nowrap ${
              filter === tab
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-[#202c33] text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Recent Calls Section Header */}
      <div className="px-4 py-2 text-[11px] font-bold text-neutral-400 uppercase tracking-wider bg-[#111b21]/80">
        Recent
      </div>

      {/* Calls Log List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 custom-scrollbar">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading call history...</span>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#202c33] flex items-center justify-center text-emerald-400 shadow-inner">
              <Phone className="w-6 h-6" />
            </div>
            <p className="max-w-xs leading-relaxed">
              {searchQuery
                ? `No calls matching "${searchQuery}"`
                : filter === 'missed'
                ? 'No missed calls.'
                : 'No call logs found. Start a voice or video call with anyone!'}
            </p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isCaller = call.callerId === currentUser?.uid;
            const otherName = isCaller ? call.receiverName : call.callerName;
            const otherPhoto = isCaller ? call.receiverPhoto : call.callerPhoto;
            const otherId = isCaller ? call.receiverId : call.callerId;
            const isMissed = call.status === 'missed' || call.status === 'rejected';

            return (
              <div
                key={call.id}
                onClick={() => setSelectedCallDetails(call)}
                className="p-3.5 flex items-center justify-between hover:bg-[#202c33]/50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={otherPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherName}`}
                      alt={otherName}
                      className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 object-cover shadow-sm"
                    />
                  </div>

                  <div className="min-w-0">
                    <h4
                      className={`text-sm font-semibold truncate ${
                        isMissed ? 'text-rose-400' : 'text-white'
                      }`}
                    >
                      {otherName}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                      {isMissed ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      ) : isCaller ? (
                        <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}

                      <span className="capitalize">{call.type}</span>
                      <span>•</span>
                      <span>{formatMessageTime(call.createdAt)}</span>
                      {call.duration && call.duration > 0 ? (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-neutral-300">
                            {formatDuration(call.duration)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right Call Action Buttons */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => startCall(otherId, otherName, otherPhoto || '', 'voice')}
                    className="p-2.5 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-[#202c33] transition-colors"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => startCall(otherId, otherName, otherPhoto || '', 'video')}
                    className="p-2.5 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-[#202c33] transition-colors"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setSelectedCallDetails(call)}
                    className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-[#202c33] transition-colors"
                    title="Call Details"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteCallLog(call.id)}
                    className="p-2.5 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-[#202c33] transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* WhatsApp New Call Modal */}
      {isNewCallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#111b21] border border-neutral-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[80vh] text-neutral-200">
            <button
              onClick={() => setIsNewCallOpen(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-xl hover:bg-neutral-800/60"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">New Call</h2>

            {/* Create Call Link Shortcut inside New Call Modal */}
            <div
              onClick={() => {
                setIsNewCallOpen(false);
                setIsCallLinkOpen(true);
              }}
              className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#202c33] hover:bg-[#2a3942] transition-colors cursor-pointer mb-4"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 -rotate-45" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">New call link</div>
                <div className="text-[11px] text-neutral-400">Share a link for your call</div>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search name or username..."
                className="w-full bg-[#202c33] border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[200px]">
              {contacts
                .filter(
                  (c) =>
                    c.displayName?.toLowerCase().includes(contactSearch.toLowerCase()) ||
                    c.username?.toLowerCase().includes(contactSearch.toLowerCase())
                )
                .map((contact) => (
                  <div
                    key={contact.uid}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#202c33]/60 border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={contact.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${contact.username}`}
                        alt={contact.displayName}
                        className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {contact.displayName}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">@{contact.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setIsNewCallOpen(false);
                          startCall(contact.uid, contact.displayName, contact.photoURL, 'voice');
                        }}
                        className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                        title="Voice Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setIsNewCallOpen(false);
                          startCall(contact.uid, contact.displayName, contact.photoURL, 'video');
                        }}
                        className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                        title="Video Call"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Clear Call History Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#111b21] border border-neutral-800 rounded-3xl p-6 shadow-2xl text-neutral-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Clear Call History?</h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              This will permanently delete all your voice and video call logs from your account. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllCalls}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
              >
                {isClearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Link Modal */}
      <CallLinkModal
        isOpen={isCallLinkOpen}
        onClose={() => setIsCallLinkOpen(false)}
      />

      {/* Call Details Modal */}
      <CallDetailsModal
        call={selectedCallDetails}
        currentUserId={currentUser?.uid || ''}
        onClose={() => setSelectedCallDetails(null)}
        onStartVoice={(id, name, photo) => startCall(id, name, photo, 'voice')}
        onStartVideo={(id, name, photo) => startCall(id, name, photo, 'video')}
        onOpenChat={(userId) => openChat(userId, 'private')}
        onDelete={(callId) => handleDeleteCallLog(callId)}
      />
    </div>
  );
};
