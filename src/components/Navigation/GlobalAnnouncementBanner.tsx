import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { GlobalAnnouncement } from '../../types';
import { Megaphone, X, AlertTriangle } from 'lucide-react';

export const GlobalAnnouncementBanner: React.FC = () => {
  const [announcement, setAnnouncement] = useState<GlobalAnnouncement | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'appSettings'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        if (data.type === 'announcement') {
          setAnnouncement({ id: doc.id, ...data } as GlobalAnnouncement);
        }
      } else {
        setAnnouncement(null);
      }
    }, (error) => {
      console.warn('Announcements banner notice:', error.message);
    });

    return () => unsub();
  }, []);

  if (!announcement || announcement.id === dismissedId) return null;

  return (
    <div
      className={`px-4 py-2 border-b text-xs flex items-center justify-between z-30 transition-all ${
        announcement.urgent
          ? 'bg-rose-950/90 border-rose-800 text-rose-200'
          : 'bg-red-950/60 border-red-800 text-red-200'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden mr-2">
        {announcement.urgent ? (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        ) : (
          <Megaphone className="w-4 h-4 text-red-400 shrink-0" />
        )}
        <span className="font-bold truncate">{announcement.title}:</span>
        <span className="truncate">{announcement.message}</span>
      </div>

      <button
        onClick={() => setDismissedId(announcement.id)}
        className="p-1 rounded text-neutral-400 hover:text-white shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
