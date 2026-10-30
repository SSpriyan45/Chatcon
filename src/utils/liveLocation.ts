import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface ActiveLiveTrack {
  watchId: number;
  timerId: NodeJS.Timeout;
  chatId: string;
  chatType: 'private' | 'group';
  messageId: string;
  expiresAt: number;
}

class LiveLocationManager {
  private activeTracks: Map<string, ActiveLiveTrack> = new Map();
  private lastUpdateTimes: Map<string, number> = new Map();

  startTracking(
    chatType: 'private' | 'group',
    chatId: string,
    messageId: string,
    expiresAt: number
  ) {
    if (!navigator.geolocation) return;
    this.stopTracking(messageId);

    const collName = chatType === 'private' ? 'privateChats' : 'groups';

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now >= expiresAt) {
          this.stopTracking(messageId, true);
          return;
        }

        // Throttle updates to at most once every 8 seconds to save Firestore writes
        const lastTime = this.lastUpdateTimes.get(messageId) || 0;
        if (now - lastTime < 8000) return;
        this.lastUpdateTimes.set(messageId, now);

        try {
          const msgRef = doc(db, collName, chatId, 'messages', messageId);
          await updateDoc(msgRef, {
            'location.latitude': pos.coords.latitude,
            'location.longitude': pos.coords.longitude,
            'location.accuracy': Math.round(pos.coords.accuracy || 0),
            'location.speed': pos.coords.speed || 0,
            updatedAt: now,
          });
        } catch (err) {
          console.warn('Failed to update live location:', err);
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    const remainingMs = Math.max(1000, expiresAt - Date.now());
    const timerId = setTimeout(() => {
      this.stopTracking(messageId, true);
    }, remainingMs);

    this.activeTracks.set(messageId, {
      watchId,
      timerId,
      chatId,
      chatType,
      messageId,
      expiresAt,
    });
  }

  async stopTracking(messageId: string, markEndedInFirestore: boolean = false) {
    const track = this.activeTracks.get(messageId);
    if (track) {
      navigator.geolocation.clearWatch(track.watchId);
      clearTimeout(track.timerId);
      this.activeTracks.delete(messageId);
      this.lastUpdateTimes.delete(messageId);

      if (markEndedInFirestore) {
        const collName = track.chatType === 'private' ? 'privateChats' : 'groups';
        try {
          const msgRef = doc(db, collName, track.chatId, 'messages', messageId);
          await updateDoc(msgRef, {
            'location.liveEnded': true,
            updatedAt: Date.now(),
          });
        } catch (err) {
          console.warn('Failed to mark live location ended:', err);
        }
      }
    }
  }

  isTracking(messageId: string): boolean {
    return this.activeTracks.has(messageId);
  }
}

export const liveLocationManager = new LiveLocationManager();
