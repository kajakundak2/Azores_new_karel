import React, { useEffect, useState } from 'react';
import { useSaraState, useSidekickState } from '../../hooks/useCharacterState';
import { CharacterAvatar } from './CharacterAvatar';
import { TEXTS } from '../../data';

interface SaraAssistantProps {
  callStatus: 'idle' | 'connecting' | 'connected' | 'error';
  voiceVolume: number;
  remoteVoiceVolume: number;
  isVoiceActive: boolean;
  isChatLoading: boolean;
  isChatOpen: boolean;
  onCallClick: () => void;
  onAvatarClick: () => void;
  onSidekickClick: () => void;
  packingComplete: boolean;
  hasTrip: boolean;
  awakeMode?: boolean;
  theme?: 'dark' | 'light';
  lang: string;
}

export function SaraAssistant({
  callStatus,
  voiceVolume,
  remoteVoiceVolume,
  isVoiceActive,
  isChatLoading,
  isChatOpen,
  onCallClick,
  onAvatarClick,
  onSidekickClick,
  packingComplete,
  hasTrip,
  awakeMode,
  theme = 'dark',
  lang,
}: SaraAssistantProps) {
  const t = (key: string) => TEXTS[key]?.[lang] || TEXTS[key]?.en || key;

  // Sára's state machine
  const saraState = useSaraState({
    callStatus,
    voiceVolume,
    remoteVoiceVolume,
    isVoiceActive,
    isChatLoading,
    isChatOpen,
  });

  // Override Sara state when in awake mode (waving)
  const effectiveSaraState = awakeMode ? {
    imageSrc: '/pictures/Guides/sara_desk_waving.png',
    animation: 'bounce' as const,
    speechBubble: 'Hey! 👋',
  } : saraState;

  // Sidekick ambient state machine
  const sidekickState = useSidekickState({
    hasTrip,
    packingComplete,
  });

  const [showAmbientSidekick, setShowAmbientSidekick] = useState(false);

  // Randomly show ambient sidekick (every 15-45 seconds)
  useEffect(() => {
    const triggerAmbient = () => {
      setShowAmbientSidekick(true);
      setTimeout(() => setShowAmbientSidekick(false), 5000); // Show for 5 seconds
    };

    const intervalId = setInterval(() => {
      if (Math.random() > 0.5) triggerAmbient();
    }, 15000); // Check every 15s

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4 min-h-[450px]">
      {/* Background glow when connected */}
      {callStatus === 'connected' && (
        <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full animate-pulse pointer-events-none" />
      )}

      {/* Main Sára Avatar */}
      <div className="relative z-10 flex flex-col items-center">
        <CharacterAvatar
          src={effectiveSaraState.imageSrc}
          alt="Sára AI Assistant"
          animation={effectiveSaraState.animation}
          speechBubble={effectiveSaraState.speechBubble}
          size="xl"
          interactive
          onClick={onAvatarClick}
          className="drop-shadow-2xl"
        />

        {/* Action Buttons Hub (Call / Chat) */}
        <div className={`absolute -bottom-10 flex items-center justify-center gap-4 backdrop-blur-md px-6 py-3 rounded-full border shadow-xl transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-zinc-950/80 border-white/10'
            : 'bg-white/60 border-slate-200'
        }`}>
          <button
            onClick={onCallClick}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold transition-all duration-300 shadow-md ${
              callStatus === 'connected'
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'
            }`}
          >
            {callStatus === 'connected' ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
                {t('chat_end_call')}
              </>
            ) : callStatus === 'connecting' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('chat_connecting')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {t('chat_call_sara')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Contextual Sidekicks (Left) */}
      <div className="absolute left-4 lg:left-0 bottom-12 hidden md:block">
        <CharacterAvatar
          src={sidekickState.imageSrc}
          alt="Kaja and Pedro"
          size="lg"
          animation="float"
          interactive
          onClick={onSidekickClick}
          className="opacity-90 hover:opacity-100 transition-opacity drop-shadow-xl"
        />
      </div>

      {/* Ambient Solo Sidekick (Right) - Slides in and out */}
      {showAmbientSidekick && (
        <div className="absolute right-4 lg:right-12 bottom-20 hidden md:block animate-slide-in-right">
          <CharacterAvatar
            src={sidekickState.ambientSoloSrc}
            alt="Sidekick Ambient"
            size="md"
            animation="bounce"
            speechBubble={t('sidekick_woohoo')}
            className="drop-shadow-lg"
          />
        </div>
      )}
    </div>
  );
}

export default SaraAssistant;
