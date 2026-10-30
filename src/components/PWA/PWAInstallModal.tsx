import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { AppLogo } from '../Common/AppLogo';
import {
  Download,
  Share,
  PlusSquare,
  X,
  Smartphone,
  Laptop,
  CheckCircle2,
  Sparkles,
  Zap,
  Bell,
  ShieldCheck
} from 'lucide-react';

interface PWAInstallModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  forceOpen = false,
  onClose,
}) => {
  const { isInstalled, isStandalone, isIOS, hasPrompt, promptInstall } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // If explicitly opened by user click
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // Don't auto-open if already running as an installed standalone app
    if (isStandalone || isInstalled) {
      setIsOpen(false);
      return;
    }

    // Check if dismissed in this session
    const dismissedThisSession = sessionStorage.getItem('chatcon_pwa_dismissed');
    if (!dismissedThisSession) {
      // Auto-open download prompt 1.5 seconds after web page opens
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [forceOpen, isStandalone, isInstalled]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('chatcon_pwa_dismissed', 'true');
    if (onClose) onClose();
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowManualGuide(true);
      return;
    }

    if (hasPrompt) {
      const result = await promptInstall();
      if (result === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } else {
      setShowManualGuide(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-full hover:bg-neutral-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {installSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-bold text-white">App Installed!</h3>
            <p className="text-sm text-neutral-400">
              Chatcon is now installed on your device. You can launch it from your home screen or app launcher.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header with App Logo */}
            <div className="flex items-center gap-4">
              <AppLogo size="lg" withText={false} />

              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] font-semibold text-blue-400 mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Chrome Web App Ready</span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight flex items-baseline">
                  <span>Download&nbsp;</span>
                  <span className="font-extrabold text-white" style={{ fontFamily: "'Nunito', sans-serif" }}>CHAT</span>
                  <span className="font-extrabold bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent ml-0.5" style={{ fontFamily: "'Nunito', sans-serif" }}>CON</span>
                </h3>
                <p className="text-xs text-neutral-400">Install as native app on Chrome, PC, Mac & Mobile</p>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-3 gap-2 py-1 text-center">
              <div className="p-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col items-center">
                <Zap className="w-4 h-4 text-cyan-400 mb-1" />
                <span className="text-[11px] font-bold text-white">Instant Open</span>
                <span className="text-[9px] text-neutral-400">No URL bar</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col items-center">
                <Bell className="w-4 h-4 text-fuchsia-400 mb-1" />
                <span className="text-[11px] font-bold text-white">Alerts</span>
                <span className="text-[9px] text-neutral-400">Calls & chats</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col items-center">
                <ShieldCheck className="w-4 h-4 text-blue-400 mb-1" />
                <span className="text-[11px] font-bold text-white">2-User Locks</span>
                <span className="text-[9px] text-neutral-400">End-to-end</span>
              </div>
            </div>

            {/* Manual Guide for iOS or Browsers without automatic trigger */}
            {showManualGuide ? (
              <div className="p-4 rounded-2xl bg-neutral-950/90 border border-cyan-500/30 space-y-2 text-xs">
                {isIOS ? (
                  <>
                    <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4" />
                      Install on iPhone / iPad:
                    </h4>
                    <ol className="list-decimal list-inside space-y-1 text-neutral-300">
                      <li>
                        Tap the <strong className="text-white">Share</strong> button{' '}
                        <Share className="inline w-3.5 h-3.5 text-cyan-400" /> at bottom of Safari.
                      </li>
                      <li>
                        Scroll down and tap <strong className="text-white">Add to Home Screen</strong>{' '}
                        <PlusSquare className="inline w-3.5 h-3.5 text-cyan-400" />.
                      </li>
                      <li>
                        Tap <strong className="text-white">Add</strong> in top right corner.
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Laptop className="w-4 h-4" />
                      Install on PC, Mac or Android:
                    </h4>
                    <ul className="space-y-1 text-neutral-300 list-disc list-inside">
                      <li>
                        Click the <strong className="text-white">Install</strong> icon in your browser address bar (top right).
                      </li>
                      <li>
                        Or click your browser menu <strong className="text-white">(⋮)</strong> and select <strong className="text-white">Install Chatcon</strong>.
                      </li>
                    </ul>
                  </>
                )}
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleInstallClick}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>Download & Install App</span>
              </button>

              <button
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white font-medium text-xs transition-colors"
              >
                Continue in Browser
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
