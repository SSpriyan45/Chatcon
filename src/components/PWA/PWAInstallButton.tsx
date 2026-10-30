import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';
import { Download } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'settings' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstalled, isStandalone } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  // If already running in standalone mode, no need to show install button
  if (isStandalone || isInstalled) {
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className={`p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600/20 to-fuchsia-600/20 hover:from-cyan-600/30 hover:to-fuchsia-600/30 text-cyan-400 border border-cyan-500/30 flex items-center justify-center transition-all shadow-md group ${className}`}
          title="Download Chatcon App"
        >
          <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>

        {modalOpen && (
          <PWAInstallModal forceOpen={true} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  if (variant === 'settings') {
    return (
      <>
        <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-950 border border-cyan-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Install Web App</h4>
              <p className="text-xs text-neutral-400">
                Install Chatcon as a native application on your device
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-md shadow-cyan-600/20"
          >
            Download App
          </button>
        </div>

        {modalOpen && (
          <PWAInstallModal forceOpen={true} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  // Default: Header / Compact button
  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:to-fuchsia-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${className}`}
        title="Download / Install Chatcon"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Download App</span>
      </button>

      {modalOpen && (
        <PWAInstallModal forceOpen={true} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
};
