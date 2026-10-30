import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { NotificationItem, NotificationSettings } from '../types';
import { soundManager } from '../utils/sound';

const DEFAULT_SETTINGS: NotificationSettings = {
  callAlerts: true,
  callRingtone: true,
  callVibration: true,
  messageAlerts: true,
  soundEffects: true,
  previewMessage: true,
  desktopPush: true,
  ringtoneType: 'modern',
};

const SETTINGS_STORAGE_KEY = 'chatconnect_notification_settings';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  latestToast: NotificationItem | null;
  dismissToast: () => void;
  hasPushPermission: boolean;
  requestPushPermission: () => Promise<boolean>;
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => Promise<void>;
  sendTestAlert: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [latestToast, setLatestToast] = useState<NotificationItem | null>(null);
  const [hasPushPermission, setHasPushPermission] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      } catch {}
    }
    return DEFAULT_SETTINGS;
  });

  // Sync settings with user profile if stored in Firestore
  useEffect(() => {
    if (profile?.notificationSettings) {
      setSettings((prev) => ({ ...prev, ...profile.notificationSettings }));
    }
  }, [profile?.notificationSettings]);

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          notificationSettings: updated,
        });
      } catch (err) {
        console.warn('Failed to sync notification settings to db:', err);
      }
    }
  };

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPushPermission(granted);
      if (granted) {
        updateSettings({ desktopPush: true });
      }
      return granted;
    } catch {
      return false;
    }
  }, []);

  const titleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalTitleRef = useRef<string>(typeof document !== 'undefined' ? document.title : 'Chatcon');

  // Flash title helper when new messages or alerts arrive
  const flashPageTitle = useCallback((alertText: string) => {
    if (typeof document === 'undefined') return;
    if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);

    let isAlert = true;
    titleIntervalRef.current = setInterval(() => {
      document.title = isAlert ? alertText : originalTitleRef.current;
      isAlert = !isAlert;
    }, 1200);

    const stopFlashing = () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
      document.title = originalTitleRef.current;
      window.removeEventListener('focus', stopFlashing);
      window.removeEventListener('click', stopFlashing);
    };

    window.addEventListener('focus', stopFlashing);
    window.addEventListener('click', stopFlashing);
  }, []);

  // Subscribe to user notifications collection
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid)
    );

    let initialLoad = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: NotificationItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<NotificationItem, 'id'>),
        }));

        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setNotifications(list);

        // Process newly arriving notifications
        if (!initialLoad) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = { id: change.doc.id, ...change.doc.data() } as NotificationItem;

              // Check user settings preferences
              const isCallNotif = data.type === 'call';
              if (isCallNotif && !settings.callAlerts) return;
              if (!isCallNotif && !settings.messageAlerts) return;

              setLatestToast(data);

              // Sound alert
              if (settings.soundEffects) {
                if (isCallNotif) {
                  soundManager.playCallAlert();
                } else {
                  soundManager.playReceived();
                }
              }

              // Vibration alert
              if (settings.callVibration && isCallNotif) {
                soundManager.vibrate([300, 150, 300]);
              } else if (settings.soundEffects && !isCallNotif) {
                soundManager.vibrate([100, 50, 100]);
              }

              // Background tab title alert
              if (typeof document !== 'undefined' && document.hidden) {
                flashPageTitle(
                  isCallNotif
                    ? `📞 ${data.title}`
                    : `💬 (1) ${data.title}: ${settings.previewMessage ? data.body : 'New message'}`
                );
              }

              // Desktop Push Notification
              if (
                settings.desktopPush &&
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted' &&
                document.hidden
              ) {
                try {
                  const notification = new Notification(data.title || 'Chatcon', {
                    body: settings.previewMessage ? data.body : 'You have a new update in Chatcon',
                    icon: '/logo.png',
                    badge: '/logo.png',
                    tag: data.id,
                  });
                  notification.onclick = () => {
                    window.focus();
                    notification.close();
                  };
                } catch {
                  // Fallback safely
                }
              }
            }
          });
        }
        initialLoad = false;
      },
      (error) => {
        console.warn('Notifications snapshot notice:', error.message);
      }
    );

    return () => unsubscribe();
  }, [currentUser, settings, flashPageTitle]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.warn('Mark as read error:', err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((item) => {
        batch.update(doc(db, 'notifications', item.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Mark all as read error:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.warn('Delete notification error:', err);
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((item) => {
        batch.delete(doc(db, 'notifications', item.id));
      });
      await batch.commit();
    } catch (err) {
      console.warn('Clear all notifications error:', err);
    }
  };

  const dismissToast = () => {
    setLatestToast(null);
  };

  const sendTestAlert = () => {
    const testItem: NotificationItem = {
      id: 'test_' + Date.now(),
      userId: currentUser?.uid || 'guest',
      type: 'call',
      title: 'Incoming Voice Call (Test)',
      body: 'Testing Chatcon audio alerts and notification system.',
      senderId: 'system',
      read: false,
      createdAt: Date.now(),
    };
    setLatestToast(testItem);
    soundManager.playCallAlert();
    soundManager.vibrate([200, 100, 200]);

    if (
      settings.desktopPush &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const notif = new Notification(testItem.title, {
          body: testItem.body,
          icon: '/logo.png',
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {}
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        latestToast,
        dismissToast,
        hasPushPermission,
        requestPushPermission,
        settings,
        updateSettings,
        sendTestAlert,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
