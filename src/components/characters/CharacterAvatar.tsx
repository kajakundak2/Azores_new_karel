import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SARA_ASSETS, SIDEKICK_ASSETS } from '../../hooks/useCharacterState';
import type { SaraAnimation } from '../../hooks/useCharacterState';

// ═══════════════════════════════════════════════════
// CharacterAvatar — Reusable character renderer
// ═══════════════════════════════════════════════════

interface CharacterAvatarProps {
  /** Current image source path */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** CSS animation class to apply */
  animation?: SaraAnimation | string;
  /** Optional speech bubble text */
  speechBubble?: string | null;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether the character is interactive (shows cursor pointer + hover effect) */
  interactive?: boolean;
  /** Custom inline style */
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  sm: { width: 80, height: 100 },
  md: { width: 160, height: 200 },
  lg: { width: 280, height: 350 },
  xl: { width: 400, height: 500 },
};

const ANIMATION_CLASSES: Record<string, string> = {
  idle: 'animate-character-idle',
  bounce: 'animate-character-bounce',
  float: 'animate-character-float',
  wave: 'animate-character-wave',
  shake: 'animate-character-shake',
  breathe: 'animate-character-breathe',
  'phone-ring': 'animate-phone-ring',
};

// These frames are used frequently during lip-sync.
// We render them as siblings and toggle visibility to avoid "flashing" (white gaps during src swap).
const OPTIMIZED_FRAMES = [...Object.values(SARA_ASSETS), ...Object.values(SIDEKICK_ASSETS)];

export function CharacterAvatar({
  src,
  alt,
  animation = 'idle',
  speechBubble,
  onClick,
  className = '',
  size = 'lg',
  interactive = false,
  style,
}: CharacterAvatarProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const dimensions = SIZE_MAP[size];

  // Preload optimized frames on mount
  useEffect(() => {
    OPTIMIZED_FRAMES.forEach(frameSrc => {
      const img = new Image();
      img.src = frameSrc;
    });
  }, []);

  // Is the current source part of the optimized "no-flash" set?
  const isOptimized = useMemo(() => OPTIMIZED_FRAMES.includes(src), [src]);

  // Transition speed is handled by just switching classes
  useEffect(() => {
    if (src !== prevSrc) {
       setPrevSrc(src);
    }
  }, [src, prevSrc]);

  const animationClass = ANIMATION_CLASSES[animation] || '';

  return (
    <div
      className={`relative inline-flex flex-col items-center ${interactive ? 'cursor-pointer group' : ''} ${className}`}
      onClick={onClick}
      style={style}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => e.key === 'Enter' && onClick?.() : undefined}
    >
      {/* Speech Bubble */}
      {speechBubble && (
        <div className="animate-fade-in-up mb-2 relative z-10">
          <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
            {speechBubble}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white dark:bg-slate-800 border-r border-b border-slate-200 dark:border-white/10 rotate-45" />
        </div>
      )}

      {/* Character Image Container */}
      <div
        className={`relative ${animationClass}`}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {/* OPTIMIZED LAYER: All frequent frames rendered statically, visibility toggled */}
        {OPTIMIZED_FRAMES.map(frameSrc => (
          <img
            key={frameSrc}
            src={frameSrc}
            alt={alt}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${src === frameSrc ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={src !== frameSrc}
            draggable={false}
          />
        ))}

        {/* FALLBACK for any dynamic frames not in optimized set */}
        {!isOptimized && (
           <img
             src={src}
             alt={alt}
             className="w-full h-full object-contain"
             draggable={false}
             loading="eager"
           />
        )}

        {/* Interactive hover overlay */}
        {interactive && (
          <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-emerald-500/5 ring-2 ring-emerald-500/20 ring-inset pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export default CharacterAvatar;

