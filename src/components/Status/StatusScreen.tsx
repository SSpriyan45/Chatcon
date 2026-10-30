import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { StatusStory } from '../../types';
import { fileToBase64, compressImageFile } from '../../utils/media';
import { formatMessageTime } from '../../utils/formatters';
import {
  Plus,
  Eye,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Camera,
  Type,
  Palette,
  Clock,
  Lock,
  CornerUpLeft
} from 'lucide-react';

const BG_GRADIENTS = [
  'from-red-700 to-teal-900',
  'from-indigo-700 to-purple-900',
  'from-pink-700 to-rose-900',
  'from-amber-600 to-orange-800',
  'from-cyan-700 to-blue-900',
  'from-neutral-900 to-black',
];

export const StatusScreen: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const { openChat } = useUI();

  const [statuses, setStatuses] = useState<StatusStory[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);

  // Status Creation Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'text' | 'media'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [caption, setCaption] = useState('');
  const [mediaDataUrl, setMediaDataUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [privacy, setPrivacy] = useState<'everyone' | 'contacts'>('everyone');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch valid statuses from past 24 hours
  useEffect(() => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const q = query(collection(db, 'statuses'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StatusStory[] = [];
      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() } as StatusStory;
        if (data.createdAt >= twentyFourHoursAgo) {
          list.push(data);
        }
      });
      setStatuses(list);
    }, (error) => {
      console.warn('Statuses listener notice:', error.message);
    });

    return () => unsubscribe();
  }, []);

  const myStatuses = statuses.filter((s) => s.userId === currentUser?.uid);
  const otherStatuses = statuses.filter((s) => s.userId !== currentUser?.uid);

  // Active Story Player Progress Bar
  useEffect(() => {
    if (activeStoryIndex === null) {
      setStoryProgress(0);
      return;
    }

    if (isPaused) return;

    progressTimerRef.current = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          // Advance to next story or close
          if (activeStoryIndex < statuses.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
            return 0;
          } else {
            setActiveStoryIndex(null);
            return 0;
          }
        }
        return prev + 2; // 50 ticks * 100ms = 5 seconds
      });
    }, 100);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [activeStoryIndex, isPaused, statuses.length]);

  // Record view when opening a story
  useEffect(() => {
    if (activeStoryIndex === null || !currentUser || !profile) return;
    const currentStory = statuses[activeStoryIndex];
    if (!currentStory || currentStory.userId === currentUser.uid) return;

    // Check if already viewed
    const alreadyViewed = currentStory.viewers?.some((v) => v.userId === currentUser.uid);
    if (!alreadyViewed) {
      const storyRef = doc(db, 'statuses', currentStory.id);
      const newViewer = {
        userId: currentUser.uid,
        displayName: profile.displayName || profile.username,
        photoURL: profile.photoURL,
        viewedAt: Date.now(),
      };
      updateDoc(storyRef, {
        viewers: [...(currentStory.viewers || []), newViewer],
      }).catch(() => {});
    }
  }, [activeStoryIndex, currentUser, profile, statuses]);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [compressingMedia, setCompressingMedia] = useState(false);

  // Handle Create Status
  const handleMediaPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setStatusError(null);

    const isVid = file.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');

    try {
      setCompressingMedia(true);
      if (!isVid) {
        const compressed = await compressImageFile(file, {
          maxWidth: 1080,
          maxHeight: 1920,
          maxSizeBytes: 450 * 1024,
        });
        setMediaDataUrl(compressed.dataUrl);
      } else {
        if (file.size > 700 * 1024) {
          setStatusError(`Video is ${Math.round(file.size / 1024)} KB. Please select a video clip under 700 KB.`);
          return;
        }
        const data = await fileToBase64(file);
        setMediaDataUrl(data);
      }
      setCreateType('media');
    } catch (err: any) {
      console.error('Status media error:', err);
      setStatusError(err?.message || 'Failed to process media.');
    } finally {
      setCompressingMedia(false);
    }
  };

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile) return;
    if (createType === 'text' && !textContent.trim()) return;
    if (createType === 'media' && !mediaDataUrl) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'statuses'), {
        userId: currentUser.uid,
        authorName: profile.displayName || profile.username,
        authorPhoto: profile.photoURL,
        type: createType === 'text' ? 'text' : mediaType,
        content: createType === 'text' ? textContent.trim() : mediaDataUrl,
        caption: caption.trim(),
        bgColor: createType === 'text' ? selectedBg : null,
        viewers: [],
        privacy,
        createdAt: Date.now(),
      });

      // Reset form
      setIsCreateOpen(false);
      setTextContent('');
      setMediaDataUrl(null);
      setCaption('');
    } catch (err) {
      console.error('Post status error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    try {
      await deleteDoc(doc(db, 'statuses', statusId));
      setActiveStoryIndex(null);
    } catch (err) {
      console.error('Failed to delete status:', err);
    }
  };

  const handleReplyToStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeStoryIndex === null || !replyText.trim() || !currentUser || !profile) return;
    const currentStory = statuses[activeStoryIndex];
    if (!currentStory) return;

    const partnerUid = currentStory.userId;
    const sorted = [currentUser.uid, partnerUid].sort();
    const chatId = `chat_${sorted[0]}_${sorted[1]}`;

    // Send reply message quoting the status
    await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
      senderId: currentUser.uid,
      senderName: profile.displayName || profile.username,
      senderPhoto: profile.photoURL,
      text: replyText.trim(),
      type: 'text',
      replyTo: {
        id: currentStory.id,
        text: currentStory.type === 'text' ? currentStory.content : `[Status ${currentStory.type}] ${currentStory.caption || ''}`,
        senderName: currentStory.authorName,
        type: 'text',
      },
      createdAt: Date.now(),
      readBy: [currentUser.uid],
      deliveredTo: [currentUser.uid],
    });

    setReplyText('');
    setActiveStoryIndex(null);
    openChat(chatId, 'private');
  };

  const activeStory = activeStoryIndex !== null ? statuses[activeStoryIndex] : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-900 border-r border-neutral-800 overflow-hidden">
      {/* Hidden Media Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaPick}
        className="hidden"
      />

      {/* Top Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Status</h2>
          <p className="text-xs text-neutral-400">Stories automatically disappear after 24 hours</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setCreateType('text');
              setIsCreateOpen(true);
            }}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            title="Create Text Story"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 transition-all"
            title="Upload Photo or Video Story"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* My Status Section */}
        <div>
          <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => {
                if (myStatuses.length > 0) {
                  const idx = statuses.findIndex((s) => s.id === myStatuses[0].id);
                  setActiveStoryIndex(idx >= 0 ? idx : 0);
                  setStoryProgress(0);
                } else {
                  setIsCreateOpen(true);
                }
              }}
            >
              <div className="relative">
                <img
                  src={profile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.uid}`}
                  alt="My Avatar"
                  className={`w-12 h-12 rounded-full bg-neutral-800 object-cover ${
                    myStatuses.length > 0 ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-neutral-950' : ''
                  }`}
                />
                {myStatuses.length === 0 && (
                  <span className="absolute bottom-0 right-0 p-1 bg-red-500 rounded-full text-neutral-950 shadow">
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white">My Status</h4>
                <p className="text-xs text-neutral-400">
                  {myStatuses.length > 0
                    ? `${myStatuses.length} active updates • Tap to view`
                    : 'Tap to add status update'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Recent Updates from Contacts */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
            Recent Updates ({otherStatuses.length})
          </h3>

          {otherStatuses.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 rounded-2xl bg-neutral-950/40 border border-neutral-800/60">
              No recent updates from friends. Be the first to post a status!
            </div>
          ) : (
            <div className="space-y-2">
              {otherStatuses.map((item) => {
                const isViewed = item.viewers?.some((v) => v.userId === currentUser?.uid);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      const idx = statuses.findIndex((s) => s.id === item.id);
                      setActiveStoryIndex(idx >= 0 ? idx : 0);
                      setStoryProgress(0);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-950/50 hover:bg-neutral-800/80 border border-neutral-800/80 cursor-pointer transition-all"
                  >
                    <div className="relative">
                      <img
                        src={item.authorPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.authorName}`}
                        alt={item.authorName}
                        className={`w-11 h-11 rounded-full bg-neutral-800 object-cover ${
                          isViewed
                            ? 'ring-2 ring-neutral-700'
                            : 'ring-2 ring-red-500 ring-offset-2 ring-offset-neutral-950'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {item.authorName}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        {formatMessageTime(item.createdAt)}
                      </p>
                    </div>

                    {isViewed && <span className="text-[10px] text-neutral-500">Viewed</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl select-none"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div className="relative w-full h-full max-w-md flex flex-col justify-between p-4">
            {/* Story Progress Bar */}
            <div className="w-full flex items-center gap-1.5 pt-2 z-20">
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 transition-all duration-100 ease-linear"
                  style={{ width: `${storyProgress}%` }}
                />
              </div>
            </div>

            {/* Top Story Header */}
            <div className="flex items-center justify-between py-3 z-20">
              <div className="flex items-center gap-3">
                <img
                  src={activeStory.authorPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeStory.authorName}`}
                  alt={activeStory.authorName}
                  className="w-10 h-10 rounded-full bg-neutral-800 border border-white/20 object-cover"
                />
                <div>
                  <h4 className="text-sm font-bold text-white leading-tight">
                    {activeStory.authorName}
                  </h4>
                  <span className="text-[11px] text-white/70">
                    {formatMessageTime(activeStory.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeStory.userId === currentUser?.uid && (
                  <button
                    onClick={() => handleDeleteStatus(activeStory.id)}
                    className="p-2 text-white/80 hover:text-red-400 transition-colors"
                    title="Delete Status"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setActiveStoryIndex(null)}
                  className="p-2 text-white hover:text-white/80 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden my-4 rounded-3xl">
              {activeStory.type === 'text' ? (
                <div className={`w-full h-full bg-gradient-to-br ${activeStory.bgColor || 'from-red-700 to-teal-900'} p-8 flex items-center justify-center text-center shadow-2xl`}>
                  <p className="text-2xl sm:text-3xl font-bold text-white tracking-wide leading-relaxed">
                    {activeStory.content}
                  </p>
                </div>
              ) : activeStory.type === 'image' ? (
                <div className="w-full h-full flex flex-col items-center justify-center relative bg-black">
                  <img
                    src={activeStory.content}
                    alt="Status"
                    className="w-full h-full object-contain"
                  />
                  {activeStory.caption && (
                    <div className="absolute bottom-6 inset-x-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl text-center text-sm text-white">
                      {activeStory.caption}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center relative bg-black">
                  <video
                    src={activeStory.content}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>

            {/* Bottom Controls / Viewers Drawer */}
            <div className="pb-4 z-20">
              {activeStory.userId === currentUser?.uid ? (
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setShowViewersDrawer((p) => !p)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Seen by {activeStory.viewers?.length || 0}</span>
                  </button>

                  {/* Viewers Drawer list */}
                  {showViewersDrawer && (
                    <div className="w-full mt-3 p-3 bg-neutral-900 border border-neutral-800 rounded-2xl max-h-40 overflow-y-auto text-xs text-white">
                      <h5 className="font-semibold text-neutral-400 mb-2">Viewers</h5>
                      {(!activeStory.viewers || activeStory.viewers.length === 0) ? (
                        <p className="text-neutral-500">No views yet.</p>
                      ) : (
                        activeStory.viewers.map((v) => (
                          <div key={v.userId} className="flex items-center justify-between py-1">
                            <span>{v.displayName}</span>
                            <span className="text-[10px] text-neutral-400">{formatMessageTime(v.viewedAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleReplyToStatus} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to status..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-xs text-white placeholder-white/60 focus:outline-none focus:border-red-400 backdrop-blur-md"
                  />
                  <button
                    type="submit"
                    className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Status Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">Create Status Update</h2>

            {statusError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {statusError}
              </div>
            )}

            {compressingMedia && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                <span>Optimizing media...</span>
              </div>
            )}

            <form onSubmit={handlePostStatus} className="space-y-4">
              {createType === 'text' ? (
                <>
                  <div className={`w-full h-44 rounded-2xl bg-gradient-to-br ${selectedBg} p-4 flex items-center justify-center shadow-inner relative`}>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Type your status story..."
                      rows={3}
                      className="w-full bg-transparent text-center text-xl font-bold text-white placeholder-white/50 focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-red-400" />
                      Choose Color Theme
                    </label>
                    <div className="flex gap-2">
                      {BG_GRADIENTS.map((bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => setSelectedBg(bg)}
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${bg} border-2 transition-transform ${
                            selectedBg === bg ? 'border-white scale-110' : 'border-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {mediaDataUrl && (
                    <div className="w-full h-48 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                      {mediaType === 'image' ? (
                        <img src={mediaDataUrl} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <video src={mediaDataUrl} controls className="w-full h-full object-contain" />
                      )}
                    </div>
                  )}

                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              {/* Privacy settings selector */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-neutral-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  Status Privacy
                </span>
                <select
                  value={privacy}
                  onChange={(e: any) => setPrivacy(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts Only</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || (createType === 'text' && !textContent.trim())}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {submitting ? 'Sharing Status...' : 'Share Status Update'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
