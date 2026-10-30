import React, { useState } from 'react';
import {
  X,
  Link2,
  Copy,
  Check,
  Share2,
  MessageSquare,
  Video,
  Phone,
  ShieldCheck,
  Users
} from 'lucide-react';
import { CallType } from '../../types';
import { useCall } from '../../context/CallContext';

interface CallLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendInChat?: (linkText: string) => void;
}

export const CallLinkModal: React.FC<CallLinkModalProps> = ({
  isOpen,
  onClose,
  onSendInChat,
}) => {
  const { createCallLink } = useCall();
  const [callType, setCallType] = useState<CallType>('video');
  const [copied, setCopied] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      createCallLink(callType).then(setLinkUrl);
    }
  }, [isOpen, callType, createCallLink]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (!linkUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Chatcon ${callType === 'video' ? 'Video' : 'Voice'} Call Link`,
          text: `Join my Chatcon ${callType} call:`,
          url: linkUrl,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const handleSendChat = () => {
    const text = `Join my Chatcon ${callType} call:\n${linkUrl}`;
    if (onSendInChat) {
      onSendInChat(text);
      onClose();
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#111b21] border border-neutral-800 rounded-3xl p-6 shadow-2xl relative flex flex-col overflow-hidden text-neutral-200">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-xl hover:bg-neutral-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Link2 className="w-6 h-6 -rotate-45" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Create call link</h3>
            <p className="text-xs text-neutral-400">Share a link for your Chatcon call</p>
          </div>
        </div>

        {/* Call Type Selector: Video vs Voice */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-neutral-400 block mb-2">
            Call type
          </label>
          <div className="grid grid-cols-2 gap-2 bg-[#202c33] p-1.5 rounded-2xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setCallType('video')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                callType === 'video'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Video</span>
            </button>
            <button
              type="button"
              onClick={() => setCallType('voice')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                callType === 'voice'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Voice</span>
            </button>
          </div>
        </div>

        {/* Call Link Box */}
        <div className="p-3.5 rounded-2xl bg-[#0b141a] border border-neutral-800/90 mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-mono text-emerald-400 block truncate">
              {linkUrl || 'Generating secure link...'}
            </span>
            <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> End-to-end encrypted room
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`p-2.5 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 text-xs font-semibold ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#202c33] hover:bg-neutral-700 text-white border-neutral-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* WhatsApp-Style Action List */}
        <div className="space-y-1 mb-5">
          <button
            type="button"
            onClick={handleSendChat}
            className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-[#202c33] transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Send link via Chatcon</div>
              <div className="text-xs text-neutral-400">Send to contacts or active chat</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-[#202c33] transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Copy link</div>
              <div className="text-xs text-neutral-400">Copy to clipboard to share anywhere</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-[#202c33] transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Share link</div>
              <div className="text-xs text-neutral-400">Share via social apps or email</div>
            </div>
          </button>
        </div>

        {/* WhatsApp Disclaimer */}
        <div className="pt-4 border-t border-neutral-800/80 text-center">
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Anyone with Chatcon can use this link to join this call. Only share it with people you trust.
          </p>
        </div>
      </div>
    </div>
  );
};
