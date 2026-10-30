import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete, Check, AlertCircle } from 'lucide-react';
import { soundManager } from '../../utils/sound';

interface AppLockScreenProps {
  onUnlock: () => void;
}

const REQUIRED_PASSCODE = '4268';
const PIN_LENGTH = 4;

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus hidden input so physical & virtual keyboards work immediately
  useEffect(() => {
    hiddenInputRef.current?.focus();
    const handleGlobalClick = () => {
      hiddenInputRef.current?.focus();
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleDigit = (digit: string) => {
    if (isSuccess || isError) return;
    if (pin.length >= PIN_LENGTH) return;

    soundManager.playKeypress();
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      validatePin(newPin);
    }
  };

  const handleDelete = () => {
    if (isSuccess) return;
    if (pin.length > 0) {
      soundManager.playKeypress();
      setPin((prev) => prev.slice(0, -1));
      setIsError(false);
    }
  };

  const handleClear = () => {
    if (isSuccess) return;
    soundManager.playKeypress();
    setPin('');
    setIsError(false);
  };

  const validatePin = (inputPin: string) => {
    if (inputPin === REQUIRED_PASSCODE) {
      setIsSuccess(true);
      setIsError(false);
      soundManager.playUnlock();
      setTimeout(() => {
        onUnlock();
      }, 400);
    } else {
      setIsError(true);
      soundManager.playError();
      setTimeout(() => {
        setPin('');
        setIsError(false);
      }, 700);
    }
  };

  // Keyboard support for hardware keyboard users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess) return;
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        handleClear();
      } else if (e.key === 'Enter' && pin.length === PIN_LENGTH) {
        validatePin(pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isSuccess, isError]);

  const keypadButtons = [
    { num: '1', letters: '' },
    { num: '2', letters: 'ABC' },
    { num: '3', letters: 'DEF' },
    { num: '4', letters: 'GHI' },
    { num: '5', letters: 'JKL' },
    { num: '6', letters: 'MNO' },
    { num: '7', letters: 'PQRS' },
    { num: '8', letters: 'TUV' },
    { num: '9', letters: 'WXYZ' },
    { type: 'clear', label: 'Clear' },
    { num: '0', letters: '+' },
    { type: 'delete', label: 'Del' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/98 backdrop-blur-2xl text-white select-none overflow-y-auto p-4 sm:p-6">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Hidden input to facilitate native mobile and accessibility keyboards */}
      <input
        ref={hiddenInputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={PIN_LENGTH}
        value={pin}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
          setPin(val);
          if (val.length === PIN_LENGTH) {
            validatePin(val);
          }
        }}
        className="opacity-0 absolute pointer-events-none w-0 h-0"
        aria-label="Enter passcode"
        autoFocus
      />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center z-10 py-6">
        {/* App Logo */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-2xl shadow-red-600/20 ring-4 ring-neutral-800 bg-neutral-950 p-1 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Chatcon Logo"
              className="w-full h-full object-cover scale-[1.05] rounded-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-neutral-950 transition-all duration-300 ${
              isSuccess
                ? 'bg-emerald-500 text-white scale-110'
                : isError
                ? 'bg-red-500 text-white animate-bounce'
                : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {isSuccess ? (
              <Check className="w-4 h-4 stroke-[3]" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Branding header */}
        <div className="mb-2">
          <h1
            className="text-2xl font-black tracking-wide text-white flex items-center justify-center gap-1.5"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <span>CHAT</span>
            <span className="bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">
              CON
            </span>
          </h1>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mt-1">
            Application Locked
          </p>
        </div>

        <p className="text-xs text-neutral-400 mb-6 max-w-xs">
          Enter the 4-digit security password to access Chatcon
        </p>

        {/* PIN Indicators */}
        <div
          className={`flex items-center justify-center gap-4 mb-4 transition-transform duration-200 ${
            isError ? 'animate-shake' : ''
          }`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isSuccess
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110 ring-2 ring-emerald-400/40'
                    : isError
                    ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110 ring-2 ring-red-400/40'
                    : isFilled
                    ? 'bg-white shadow-lg shadow-white/40 scale-105'
                    : 'bg-neutral-800 border border-neutral-700/60'
                }`}
              />
            );
          })}
        </div>

        {/* Status message */}
        <div className="h-6 mb-4 flex items-center justify-center">
          {isSuccess && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              Access Granted. Opening Chatcon...
            </span>
          )}
          {isError && (
            <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5" />
              Incorrect password. Try again.
            </span>
          )}
          {!isSuccess && !isError && (
            <span className="text-[11px] text-neutral-400 font-medium">
              Use on-screen keypad or physical keyboard
            </span>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mb-5">
          {keypadButtons.map((btn, index) => {
            if (btn.type === 'clear') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleClear}
                  disabled={pin.length === 0 || isSuccess}
                  className="h-16 rounded-2xl flex flex-col items-center justify-center text-xs font-bold text-neutral-400 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  Clear
                </button>
              );
            }

            if (btn.type === 'delete') {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleDelete}
                  disabled={pin.length === 0 || isSuccess}
                  className="h-16 rounded-2xl flex flex-col items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="Delete last digit"
                >
                  <Delete className="w-5 h-5" />
                </button>
              );
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleDigit(btn.num!)}
                disabled={isSuccess || isError}
                className="h-16 rounded-2xl bg-neutral-900/90 border border-neutral-800/80 hover:bg-neutral-850 hover:border-neutral-700 active:bg-neutral-800 active:scale-95 transition-all flex flex-col items-center justify-center shadow-md shadow-black/40 group"
              >
                <span className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
                  {btn.num}
                </span>
                {btn.letters ? (
                  <span className="text-[9px] font-semibold text-neutral-400 tracking-wider">
                    {btn.letters}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
