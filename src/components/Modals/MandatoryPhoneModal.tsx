import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { validatePhoneNumber, COMMON_COUNTRY_CODES } from '../../utils/phone';
import { Phone, ShieldCheck, AlertCircle, ArrowRight, LogOut, Check } from 'lucide-react';

export const MandatoryPhoneModal: React.FC = () => {
  const { currentUser, profile, savePhoneNumber, logout } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+1');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is not logged in or profile is still loading, or user already has a phone number, do not show
  if (!currentUser || !profile) return null;
  if (profile.phoneNumber && profile.phoneNumber.trim().length > 0) return null;

  const handleCountryCodeChange = (code: string) => {
    setSelectedCountryCode(code);
    // If the phone doesn't start with +, or has old code, update cleanly
    const rawNumber = phoneNumber.replace(/^\+\d+[\s-]*/, '').trim();
    if (rawNumber) {
      setPhoneNumber(`${code} ${rawNumber}`);
    } else {
      setPhoneNumber(`${code} `);
    }
  };

  const handlePhoneInputChange = (val: string) => {
    setPhoneNumber(val);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      setError(validation.error || 'Please enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePhoneNumber(validation.formatted);
      if (!res.success) {
        setError(res.error || 'Failed to save phone number. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while saving your phone number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-left">
        {/* Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-blue-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shadow-lg">
            <Phone className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Phone Number Required
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                Compulsory
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Welcome, <span className="text-white font-medium">@{profile.username}</span>! Complete your setup.
            </p>
          </div>
        </div>

        {/* Informative notice */}
        <div className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 text-neutral-300 text-xs mb-5 space-y-1.5">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-[11px] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-red-400" />
            <span>Public Identity & Direct Calling</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-400">
            A valid phone number is compulsory for all Chatcon users. Your phone number is displayed to other users on your profile, in chat headers, and member lists to enable direct calling and seamless contact connection.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick country code selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Popular Dial Codes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_COUNTRY_CODES.slice(0, 7).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountryCodeChange(c.code)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    selectedCountryCode === c.code
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold shadow-sm'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.code}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Phone Number Input */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Your Phone Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Phone className="w-4 h-4 text-neutral-400" />
              </div>
              <input
                type="tel"
                required
                autoFocus
                value={phoneNumber}
                onChange={(e) => handlePhoneInputChange(e.target.value)}
                placeholder="+1 555-019-2834"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono tracking-wide"
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Include country code (e.g. +1 555 123 4567, +91 98765 43210). Minimum 7 digits.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !phoneNumber.trim()}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs mt-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Save & Continue to Chatcon</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Logout alternative if user wants to change account */}
        <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
          <span>Signed in as {currentUser.email || profile.username}</span>
          <button
            type="button"
            onClick={logout}
            className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
