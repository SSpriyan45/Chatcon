import React, { createContext, useContext, useState, useEffect } from 'react';

export type MainTab = 'chats' | 'status' | 'calls' | 'groups' | 'settings' | 'admin';

export interface ViewingLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  accuracy?: number;
  isLive?: boolean;
  liveUntil?: number;
  liveEnded?: boolean;
  senderName?: string;
  senderPhoto?: string;
  senderId?: string;
  messageId?: string;
  chatId?: string;
  chatType?: 'private' | 'group';
}

interface UIContextType {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  selectedChatId: string | null;
  selectedChatType: 'private' | 'group' | null;
  openChat: (chatId: string, type: 'private' | 'group') => void;
  closeChat: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isPrivateRoomModalOpen: boolean;
  setIsPrivateRoomModalOpen: (open: boolean) => void;
  isNewChatModalOpen: boolean;
  setIsNewChatModalOpen: (open: boolean) => void;
  isNewGroupModalOpen: boolean;
  setIsNewGroupModalOpen: (open: boolean) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  viewingLocation: ViewingLocation | null;
  openLocationViewer: (loc: ViewingLocation) => void;
  closeLocationViewer: () => void;
  isReportModalOpen: boolean;
  reportTarget: { type: 'user' | 'message' | 'group' | 'status'; id: string; name?: string } | null;
  openReportModal: (type: 'user' | 'message' | 'group' | 'status', id: string, name?: string) => void;
  closeReportModal: () => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<MainTab>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatType, setSelectedChatType] = useState<'private' | 'group' | null>(null);
  const [isPrivateRoomModalOpen, setIsPrivateRoomModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [viewingLocation, setViewingLocation] = useState<ViewingLocation | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'message' | 'group' | 'status'; id: string; name?: string } | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('cc_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('cc_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const openChat = (chatId: string, type: 'private' | 'group') => {
    setSelectedChatId(chatId);
    setSelectedChatType(type);
  };

  const closeChat = () => {
    setSelectedChatId(null);
    setSelectedChatType(null);
  };

  const openReportModal = (type: 'user' | 'message' | 'group' | 'status', id: string, name?: string) => {
    setReportTarget({ type, id, name });
    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setReportTarget(null);
    setIsReportModalOpen(false);
  };

  const openLocationViewer = (loc: ViewingLocation) => {
    setViewingLocation(loc);
  };

  const closeLocationViewer = () => {
    setViewingLocation(null);
  };

  return (
    <UIContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedChatId,
        selectedChatType,
        openChat,
        closeChat,
        theme,
        toggleTheme,
        isPrivateRoomModalOpen,
        setIsPrivateRoomModalOpen,
        isNewChatModalOpen,
        setIsNewChatModalOpen,
        isNewGroupModalOpen,
        setIsNewGroupModalOpen,
        isLocationModalOpen,
        setIsLocationModalOpen,
        viewingLocation,
        openLocationViewer,
        closeLocationViewer,
        isReportModalOpen,
        reportTarget,
        openReportModal,
        closeReportModal,
        isNotificationsOpen,
        setIsNotificationsOpen,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
