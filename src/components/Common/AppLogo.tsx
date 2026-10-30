import React, { useState } from 'react';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withText?: boolean;
  className?: string;
  useSvg?: boolean;
  variant?: 'wordmark' | 'mark-only';
}

/**
 * High-fidelity vector SVG mark matching the exact CHATCON 3D gradient 'C'
 * with inner speech bubble and glowing message dots.
 */
export const ChatconMarkSvg: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 48,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Outer 'C' sweeping gradient: cyan -> royal blue -> vivid purple */}
        <linearGradient id="chatconCGradient" x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="35%" stopColor="#2563EB" />
          <stop offset="70%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Top ribbon highlight */}
        <linearGradient id="topRibbonShine" x1="120" y1="35" x2="40" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>

        {/* Bottom purple glow */}
        <linearGradient id="bottomPurpleGlow" x1="70" y1="120" x2="150" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>

        {/* Chat bubble background */}
        <linearGradient id="bubbleBg" x1="75" y1="65" x2="135" y2="135" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B132B" />
          <stop offset="100%" stopColor="#070C1B" />
        </linearGradient>

        {/* Dot glow filter */}
        <filter id="dotGlow" x="65" y="80" width="70" height="40" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Main 3D 'C' Ribbon Body */}
      <path
        d="M 140 68 
           C 134 50, 118 36, 96 36 
           C 58 36, 28 66, 28 104 
           C 28 142, 58 172, 98 172 
           C 122 172, 142 156, 148 136 
           C 150 128, 142 122, 134 124 
           C 126 126, 118 138, 98 138 
           C 76 138, 62 122, 62 104 
           C 62 86, 76 70, 96 70 
           C 114 70, 122 80, 130 84 
           C 138 88, 144 80, 140 68 Z"
        fill="url(#chatconCGradient)"
      />

      {/* Top curved ribbon layer with 3D highlight */}
      <path
        d="M 140 68 
           C 134 50, 118 36, 96 36 
           C 58 36, 28 66, 28 104 
           C 36 78, 64 62, 96 62 
           C 116 62, 130 70, 140 68 Z"
        fill="url(#topRibbonShine)"
      />

      {/* Bottom violet sweep layer */}
      <path
        d="M 38 116 
           C 46 148, 68 172, 98 172 
           C 122 172, 142 156, 148 136 
           C 150 128, 142 122, 134 124 
           C 126 126, 118 138, 98 138 
           C 74 138, 56 126, 48 110 Z"
        fill="url(#bottomPurpleGlow)"
      />

      {/* Embedded Speech Bubble in Center of 'C' */}
      <path
        d="M 98 68 
           C 120 68, 136 82, 136 100 
           C 136 118, 120 132, 98 132 
           C 92 132, 87 130, 82 128 
           L 72 136 
           C 70 137, 68 136, 68 134 
           L 70 124 
           C 64 118, 60 110, 60 100 
           C 60 82, 76 68, 98 68 Z"
        fill="url(#bubbleBg)"
        stroke="#1E293B"
        strokeWidth="2"
      />

      {/* Three Glowing Message Dots */}
      <g filter="url(#dotGlow)">
        <circle cx="84" cy="100" r="5" fill="#E0F2FE" />
        <circle cx="98" cy="100" r="5" fill="#E0F2FE" />
        <circle cx="112" cy="100" r="5" fill="#E0F2FE" />
      </g>
    </svg>
  );
};

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  withText = false,
  className = '',
  useSvg = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: 'w-6 h-6 rounded-lg',
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-16 h-16 rounded-3xl',
    xl: 'w-24 h-24 rounded-3xl',
  };

  const svgSizes = {
    xs: 24,
    sm: 32,
    md: 44,
    lg: 64,
    xl: 96,
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon Emblem Container */}
      <div
        className={`${sizeMap[size]} overflow-hidden shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/40 bg-neutral-950 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
      >
        {useSvg || imgError ? (
          <ChatconMarkSvg size={svgSizes[size]} />
        ) : (
          <img
            src="/logo.png"
            alt="CHATCON"
            className="w-full h-full object-cover scale-[1.05] origin-center"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Nunito ExtraBold CHATCON Logotype matching user reference */}
      {withText && (
        <span
          className={`font-brand font-extrabold tracking-wider text-white flex items-center leading-none ${textSizes[size]}`}
          style={{ fontFamily: "'Nunito', sans-serif" }}
        >
          {/* CHAT in pure white */}
          <span className="text-white drop-shadow-sm">CHAT</span>
          {/* CON in electric cyan-to-purple gradient */}
          <span className="bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm ml-0.5">
            CON
          </span>
        </span>
      )}
    </div>
  );
};
