import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useNotifications } from '../../context/NotificationContext';
import { soundManager } from '../../utils/sound';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile, PrivacySettings } from '../../types';
import { validatePhoneNumber } from '../../utils/phone';
import { PWAInstallButton } from '../PWA/PWAInstallButton';
import {
  User,
  Shield,
  Moon,
  Sun,
  Bell,
  Lock,
  LogOut,
  Trash2,
  Sparkles,
  Check,
  AlertTriangle,
  UserX,
  Share2,
  Copy,
  ChevronRight,
  Camera,
  Upload,
  Link as LinkIcon,
  RefreshCw,
  X,
  AlertCircle,
  Image as ImageIcon,
  Phone,
  ShieldCheck,
  Volume2,
  Play,
  Square,
  Clock
} from 'lucide-react';
import { getStoredAutoLockSetting, setStoredAutoLockSetting, AUTOLOCK_CHANGED_EVENT } from '../../hooks/useAutoLock';

export const SettingsScreen: React.FC = () => {
  const {
    currentUser,
    profile,
    updateProfileDetails,
    updateUsername,
    checkUsernameAvailability,
    deleteUserAccount,
    logout,
    resetPassword,
    blockedUserIds,
    unblockUser
  } = useAuth();

  const { theme, toggleTheme } = useUI();
  const {
    settings: notifSettings,
    updateSettings: updateNotifSettings,
    hasPushPermission,
    requestPushPermission,
    sendTestAlert,
  } = useNotifications();

  const [previewingRingtone, setPreviewingRingtone] = useState<string | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePreviewRingtone = (melody: 'modern' | 'classic' | 'gentle') => {
    if (previewingRingtone === melody) {
      soundManager.stopRingtone();
      setPreviewingRingtone(null);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      return;
    }
    soundManager.stopRingtone();
    soundManager.startRingtone(melody);
    setPreviewingRingtone(melody);
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = setTimeout(() => {
      soundManager.stopRingtone();
      setPreviewingRingtone(null);
    }, 2500);
  };

  // Profile Form state
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Username validation & availability state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');

  // Custom Photo URL modal & file upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Privacy Settings state
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    profile?.privacySettings || {
      lastSeen: 'everyone',
      profilePhoto: 'everyone',
      about: 'everyone',
      readReceipts: true,
      onlineStatus: 'everyone',
    }
  );

  // Blocked users details
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Auto-Lock Inactivity Configuration
  const [autoLockSetting, setAutoLockSetting] = useState<string>(getStoredAutoLockSetting);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('');
  const [isCustomAutoLock, setIsCustomAutoLock] = useState<boolean>(() => {
    const initial = getStoredAutoLockSetting();
    return !['0.5', '1', '5', '10', '15', '30', '60', 'never'].includes(initial);
  });
  const [autoLockSavedToast, setAutoLockSavedToast] = useState<string | null>(null);

  useEffect(() => {
    const initial = getStoredAutoLockSetting();
    if (!['0.5', '1', '5', '10', '15', '30', '60', 'never'].includes(initial)) {
      setIsCustomAutoLock(true);
      setCustomMinutesInput(initial);
    }

    const handleExternalChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ value: string }>;
      const newVal = customEvent.detail?.value || getStoredAutoLockSetting();
      setAutoLockSetting(newVal);
      if (!['0.5', '1', '5', '10', '15', '30', '60', 'never'].includes(newVal)) {
        setIsCustomAutoLock(true);
        setCustomMinutesInput(newVal);
      } else {
        setIsCustomAutoLock(false);
      }
    };
    window.addEventListener(AUTOLOCK_CHANGED_EVENT, handleExternalChange);
    return () => window.removeEventListener(AUTOLOCK_CHANGED_EVENT, handleExternalChange);
  }, []);

  const handleAutoLockChange = (val: string) => {
    if (val === 'custom') {
      setIsCustomAutoLock(true);
      const current = getStoredAutoLockSetting();
      if (!['0.5', '1', '5', '10', '15', '30', '60', 'never'].includes(current)) {
        setCustomMinutesInput(current);
      } else {
        setCustomMinutesInput('5');
        setStoredAutoLockSetting('5');
        setAutoLockSetting('5');
      }
      return;
    }

    setIsCustomAutoLock(false);
    setAutoLockSetting(val);
    setStoredAutoLockSetting(val);
    showAutoLockSavedFeedback(val);
  };

  const handleApplyCustomMinutes = () => {
    const parsed = parseFloat(customMinutesInput);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid positive number of minutes (e.g. 5, 2.5, 45).');
      return;
    }
    const sanitized = String(Math.round(parsed * 10) / 10);
    setAutoLockSetting(sanitized);
    setStoredAutoLockSetting(sanitized);
    showAutoLockSavedFeedback(sanitized);
  };

  const showAutoLockSavedFeedback = (val: string) => {
    const label = val === 'never' ? 'Disabled' : `${val} minute${parseFloat(val) === 1 ? '' : 's'}`;
    setAutoLockSavedToast(`Auto-lock timeout updated: ${label}`);
    setTimeout(() => {
      setAutoLockSavedToast(null);
    }, 2500);
  };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setUsername(profile.username || '');
      setAbout(profile.about || '');
      setPhoneNumber(profile.phoneNumber || '');
      setPhotoURL(profile.photoURL || '');
      if (profile.privacySettings) {
        setPrivacy(profile.privacySettings);
      }
    }
  }, [profile]);

  // Real-time debounced username checker
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Username cannot be empty');
      return;
    }
    if (clean.length < 3) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Must be at least 3 characters');
      return;
    }
    if (clean.length > 25) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Cannot exceed 25 characters');
      return;
    }
    if (profile && clean === profile.username.toLowerCase()) {
      setUsernameStatus('idle');
      setUsernameFeedback('Your current handle');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Checking availability...');

    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(clean);
        if (available) {
          setUsernameStatus('available');
          setUsernameFeedback(`@${clean} is available!`);
        } else {
          setUsernameStatus('taken');
          setUsernameFeedback(`@${clean} is already taken`);
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  // Load blocked user names
  useEffect(() => {
    const fetchBlocked = async () => {
      const list: UserProfile[] = [];
      for (const uid of blockedUserIds) {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          list.push(snap.data() as UserProfile);
        }
      }
      setBlockedUsers(list);
    };
    fetchBlocked();
  }, [blockedUserIds]);

  // File Upload -> HTML5 Canvas Avatar Compressor
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    setIsProcessingPhoto(true);
    setProfileError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = Math.min(img.width, img.height);
          const targetSize = 256;
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            // Center crop square
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;
            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setPhotoURL(compressed);
          }
        } catch (err) {
          console.error('Error processing image:', err);
          setProfileError('Failed to process image. Try a smaller file or URL.');
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      img.onerror = () => {
        setProfileError('Failed to load image file.');
        setIsProcessingPhoto(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      setProfileError('Please provide a valid web link starting with https://');
      return;
    }
    setPhotoURL(trimmed);
    setShowUrlInput(false);
    setCustomUrl('');
    setProfileError(null);
  };

  const handleChooseStyle = (style: 'bottts' | 'personas' | 'adventurer' | 'fun-emoji' | 'lorelei') => {
    const seed = username.trim() || profile?.username || Math.random().toString(36).substring(7);
    setPhotoURL(`https://api.dicebear.com/7.x/${style}/svg?seed=${seed}_${Date.now()}`);
    setProfileError(null);
  };

  const handleResetPhoto = () => {
    const seed = username.trim() || profile?.username || 'user';
    setPhotoURL(`https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`);
    setProfileError(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingProfile(true);
    setProfileError(null);

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

      // If username changed, update it first
      if (profile && cleanUsername !== profile.username.toLowerCase()) {
        const userRes = await updateUsername(cleanUsername);
        if (!userRes.success) {
          setProfileError(userRes.error || 'Failed to update username');
          setSavingProfile(false);
          return;
        }
      }

      // Phone number is strictly compulsory
      const phoneCheck = validatePhoneNumber(phoneNumber);
      if (!phoneCheck.isValid) {
        setProfileError(phoneCheck.error || 'Phone number is compulsory for all users. Please enter a valid phone number.');
        setSavingProfile(false);
        return;
      }

      await updateProfileDetails({
        displayName: displayName.trim() || 'User',
        username: cleanUsername,
        about: about.trim(),
        phoneNumber: phoneCheck.formatted,
        photoURL,
        privacySettings: privacy,
      });

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message || 'Failed to save profile changes');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrivacyChange = async (key: keyof PrivacySettings, value: any) => {
    const updated = { ...privacy, [key]: value };
    setPrivacy(updated);
    await updateProfileDetails({ privacySettings: updated });
  };

  const handleCopyProfileLink = () => {
    const link = `${window.location.origin}/#${profile?.username}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') return;
    try {
      await deleteUserAccount();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-900 border-r border-neutral-800 overflow-y-auto custom-scrollbar">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-800 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight">Settings</h2>
        <p className="text-xs text-neutral-400">Account, privacy, and preference controls</p>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">
        {/* PWA Download Banner */}
        <PWAInstallButton variant="settings" />

        {/* Profile Card & Avatar */}
        <div className="p-5 rounded-3xl bg-neutral-950/80 border border-neutral-800 shadow-xl space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-red-400" />
                Profile & Identity
              </h3>
              <p className="text-[11px] text-neutral-400">Customize your avatar, unique @username, and display details</p>
            </div>
            <button
              type="button"
              onClick={handleCopyProfileLink}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Share Profile Link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-red-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Hidden native file input for custom profile photo upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Profile Photo Controls */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Avatar Preview */}
                <div className="relative group shrink-0">
                  <img
                    src={photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${username || profile?.username || 'user'}`}
                    alt="Profile Avatar"
                    className="w-24 h-24 rounded-full bg-neutral-800 border-2 border-red-500/80 p-1 object-cover shadow-xl"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-2 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg transition-all"
                    title="Upload Photo from Device"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {isProcessingPhoto && (
                    <div className="absolute inset-0 bg-neutral-950/80 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Avatar Actions */}
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div>
                    <h4 className="text-xs font-bold text-white">Custom Profile Photo</h4>
                    <p className="text-[11px] text-neutral-400">
                      Upload any image from your device, paste a web link, or generate animated avatars
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Image URL</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChooseStyle('bottts')}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 transition-colors"
                      title="Randomize Avatar"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Randomize</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetPhoto}
                      className="px-2 py-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs transition-colors"
                      title="Reset to default avatar"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset Avatar Styles */}
                  <div className="pt-2 flex items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                    <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider mr-1">Styles:</span>
                    <button
                      type="button"
                      onClick={() => handleChooseStyle('bottts')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      🤖 Robots
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseStyle('personas')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      👤 Personas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseStyle('adventurer')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      🧭 Adventurer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseStyle('fun-emoji')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      😄 Emoji
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseStyle('lorelei')}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      🎨 Anime
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Custom Image URL Form */}
              {showUrlInput && (
                <div className="pt-2 border-t border-neutral-800/80 animate-in fade-in duration-150">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="Paste image URL (https://...)"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Username Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  Custom Username
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {usernameStatus === 'checking' && (
                    <span className="text-neutral-400 flex items-center gap-1">
                      <div className="w-2.5 h-2.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                      <span>Checking...</span>
                    </span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-red-400 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{usernameFeedback}</span>
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{usernameFeedback}</span>
                    </span>
                  )}
                  {usernameStatus === 'invalid' && (
                    <span className="text-red-400 font-medium">
                      {usernameFeedback}
                    </span>
                  )}
                  {usernameStatus === 'idle' && (
                    <span className="text-neutral-500 font-mono">
                      {usernameFeedback}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-red-400 font-bold">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="your_handle"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-4 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono tracking-wide"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Other members search and connect with you using your @username. Use lowercase letters, numbers, and underscores (3-25 chars).
              </p>
            </div>

            {/* Display Name Input */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name or nickname"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            {/* About / Bio Input */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">About / Bio</label>
              <input
                type="text"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Hey there! I am using Chatcon."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Phone Number Input (Compulsory & Displayed for all users) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  Phone Number <span className="text-red-400 font-bold">*</span>
                </label>
                <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-red-400" /> Compulsory • Visible to all users
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono transition-colors"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Phone number is compulsory. It is displayed across your profile, chat headers, and member lists so other users can contact and call you directly.
              </p>
            </div>

            {/* Error banner */}
            {profileError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'}
              className="py-2.5 px-5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-red-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {profileSaved ? <Check className="w-4 h-4" /> : null}
              {savingProfile && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{savingProfile ? 'Saving Changes...' : profileSaved ? 'Saved Successfully!' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>

        {/* App Lock Protection */}
        <div className="p-5 rounded-3xl bg-neutral-950/80 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-400" />
              <div>
                <h3 className="text-sm font-bold text-white">App Lock Protection</h3>
                <p className="text-[11px] text-neutral-400">Passcode barrier and inactivity auto-lock</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              Passcode: 4268
            </span>
          </div>

          <p className="text-xs text-neutral-400">
            Chatcon is secured with a 4-digit passcode lock barrier (<code className="text-red-400 font-mono font-bold">4268</code>) to prevent unauthorized access upon opening or leaving the app unattended.
          </p>

          {/* Auto-Lock Inactivity Configuration Setting */}
          <div className="pt-3 border-t border-neutral-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" />
                  <span className="font-semibold text-white text-xs">Auto-Lock on Inactivity</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Automatically lock the app after a period of user inactivity
                </p>
              </div>

              <select
                value={isCustomAutoLock ? 'custom' : autoLockSetting}
                onChange={(e) => handleAutoLockChange(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 hover:border-neutral-600 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                <option value="0.5">30 Seconds (Quick Test)</option>
                <option value="1">1 Minute</option>
                <option value="5">5 Minutes (Default)</option>
                <option value="10">10 Minutes</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="custom">Custom Minutes...</option>
                <option value="never">Never (Disabled)</option>
              </select>
            </div>

            {/* Custom Minutes Input */}
            {isCustomAutoLock && (
              <div className="flex items-center gap-2 bg-neutral-900/60 p-2.5 rounded-2xl border border-neutral-800">
                <label className="text-[11px] text-neutral-300 font-medium shrink-0">
                  Custom minutes:
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="1440"
                  step="0.5"
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-24 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomMinutes}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-red-600/30"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Saved Toast */}
            {autoLockSavedToast && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                <Check className="w-3.5 h-3.5" />
                <span>{autoLockSavedToast}</span>
              </div>
            )}

            {/* Status & Immediate Lock Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <span className={`inline-block w-2 h-2 rounded-full ${autoLockSetting !== 'never' ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                <span>
                  {autoLockSetting === 'never'
                    ? 'Inactivity auto-lock is disabled.'
                    : `Locks automatically after ${
                        autoLockSetting === '0.5'
                          ? '30 seconds'
                          : `${autoLockSetting} minute${parseFloat(autoLockSetting) === 1 ? '' : 's'}`
                      } of inactivity.`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('chatcon_app_unlocked');
                  window.dispatchEvent(new CustomEvent('chatcon:lock-app'));
                }}
                className="py-1.5 px-3 bg-neutral-900 hover:bg-neutral-850 border border-neutral-700 hover:border-red-500/50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm self-start sm:self-auto"
              >
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Lock App Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Controls */}
        <div className="p-5 rounded-3xl bg-neutral-950/80 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-bold text-white">Privacy Controls</h3>
          </div>

          <div className="divide-y divide-neutral-800/80 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Last Seen & Online</span>
                <span className="text-[11px] text-neutral-400">Who can see when you were last active</span>
              </div>
              <select
                value={privacy.lastSeen}
                onChange={(e: any) => handlePrivacyChange('lastSeen', e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Profile Photo</span>
                <span className="text-[11px] text-neutral-400">Who can see your profile photo</span>
              </div>
              <select
                value={privacy.profilePhoto}
                onChange={(e: any) => handlePrivacyChange('profilePhoto', e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Allow users to find me by username</span>
                <span className="text-[11px] text-neutral-400">When enabled, people can discover your profile via @username or name search</span>
              </div>
              <input
                type="checkbox"
                checked={profile?.allowSearchByUsername !== false}
                onChange={async (e) => {
                  await updateProfileDetails({ allowSearchByUsername: e.target.checked });
                }}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
              />
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Read Receipts</span>
                <span className="text-[11px] text-neutral-400">If turned off, you won't send or see blue read ticks</span>
              </div>
              <input
                type="checkbox"
                checked={privacy.readReceipts}
                onChange={(e) => handlePrivacyChange('readReceipts', e.target.checked)}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Blocked Users */}
        <div className="p-5 rounded-3xl bg-neutral-950/80 border border-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <UserX className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-bold text-white">Blocked Contacts ({blockedUsers.length})</h3>
          </div>

          {blockedUsers.length === 0 ? (
            <p className="text-xs text-neutral-500">No blocked contacts.</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((b) => (
                <div key={b.uid} className="flex items-center justify-between p-2 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={b.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${b.username}`}
                      alt={b.displayName}
                      className="w-8 h-8 rounded-full bg-neutral-800"
                    />
                    <div>
                      <div className="text-xs font-medium text-white">{b.displayName}</div>
                      <div className="text-[10px] text-neutral-400">@{b.username}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => unblockUser(b.uid)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification & Call Alerts */}
        <div className="p-5 rounded-3xl bg-neutral-950/80 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Notification & Call Alerts</h3>
                <p className="text-[11px] text-neutral-400">Configure ringtones, sound effects, and push notifications</p>
              </div>
            </div>
            <button
              type="button"
              onClick={sendTestAlert}
              className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-semibold transition-all border border-red-500/30 flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test Alert</span>
            </button>
          </div>

          <div className="divide-y divide-neutral-800/80 text-xs">
            {/* Incoming Call Alerts Toggle */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Incoming Call Alerts</span>
                <span className="text-[11px] text-neutral-400">Receive alerts when someone calls your profile</span>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.callAlerts}
                onChange={(e) => updateNotifSettings({ callAlerts: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
              />
            </div>

            {/* Call Ringtone Sound Toggle */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Call Ringtone Sound</span>
                <span className="text-[11px] text-neutral-400">Play ringing audio melody on incoming calls</span>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.callRingtone}
                onChange={(e) => updateNotifSettings({ callRingtone: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
              />
            </div>

            {/* Ringtone Melody Selection */}
            {notifSettings.callRingtone && (
              <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-neutral-900/40 px-3 rounded-2xl my-1 border border-neutral-800/60">
                <div>
                  <span className="font-semibold text-white block">Ringtone Melody</span>
                  <span className="text-[11px] text-neutral-400">Choose your incoming call ringtone cadence</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={notifSettings.ringtoneType}
                    onChange={(e: any) => updateNotifSettings({ ringtoneType: e.target.value })}
                    className="bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-red-500"
                  >
                    <option value="modern">Modern Digital</option>
                    <option value="classic">Classic Telephone</option>
                    <option value="gentle">Gentle Marimba</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handlePreviewRingtone(notifSettings.ringtoneType)}
                    className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                    title={previewingRingtone ? 'Stop Preview' : 'Preview Ringtone'}
                  >
                    {previewingRingtone ? <Square className="w-3.5 h-3.5 text-red-400" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Device Vibration Toggle */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Call Vibration</span>
                <span className="text-[11px] text-neutral-400">Vibrate mobile & handheld devices on calls</span>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.callVibration}
                onChange={(e) => updateNotifSettings({ callVibration: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
              />
            </div>

            {/* Message Alert Sounds Toggle */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Message Sound Effects</span>
                <span className="text-[11px] text-neutral-400">Play chimes when receiving or sending messages</span>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.soundEffects}
                onChange={(e) => updateNotifSettings({ soundEffects: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
              />
            </div>

            {/* Message Preview in Notifications */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Preview Message Text</span>
                <span className="text-[11px] text-neutral-400">Show message content in alert toasts and push banners</span>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.previewMessage}
                onChange={(e) => updateNotifSettings({ previewMessage: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
              />
            </div>

            {/* Desktop / System Push Notifications */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">Browser Push Notifications</span>
                  {hasPushPermission ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-medium">
                      Not Granted
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-400">Receive system notifications even when the app tab is hidden</span>
              </div>
              {hasPushPermission ? (
                <input
                  type="checkbox"
                  checked={notifSettings.desktopPush}
                  onChange={(e) => updateNotifSettings({ desktopPush: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 bg-neutral-800 border-neutral-700 focus:ring-red-500 cursor-pointer"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => requestPushPermission()}
                  className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors"
                >
                  Enable
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Appearance & Security */}
        <div className="p-5 rounded-3xl bg-neutral-950/80 border border-neutral-800 space-y-3">
          <h3 className="text-sm font-bold text-white mb-2">Preferences & Security</h3>

          <div className="flex items-center justify-between py-2 border-b border-neutral-800 text-xs">
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-red-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <span className="font-semibold text-white">Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 transition-colors text-xs"
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-neutral-800 text-xs">
            <div>
              <span className="font-semibold text-white block">Password & Security</span>
              <span className="text-[11px] text-neutral-400">Reset password via registered email</span>
            </div>
            <button
              onClick={() => {
                if (currentUser?.email) {
                  resetPassword(currentUser.email);
                  alert('Password reset link sent to ' + currentUser.email);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 transition-colors text-xs"
            >
              Reset Password
            </button>
          </div>

          <div className="flex items-center justify-between py-2 text-xs">
            <div>
              <span className="font-semibold text-white block">Sign Out</span>
              <span className="text-[11px] text-neutral-400">Log out of your Chatcon session</span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors text-xs flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Delete Account */}
        <div className="p-5 rounded-3xl bg-red-950/20 border border-red-900/30 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-red-400">Delete Account</h4>
            <p className="text-[11px] text-neutral-400">Permanently delete your profile and credentials</p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Delete Account Permanently?</h3>
            <p className="text-xs text-neutral-400 mb-4">
              This action cannot be undone. To confirm, type <strong>DELETE</strong> below.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-center text-white mb-4 focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                className="flex-1 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-40"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
