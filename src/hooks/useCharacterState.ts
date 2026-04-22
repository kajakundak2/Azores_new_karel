import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type SaraState =
  | 'idle'
  | 'waving'
  | 'bored'
  | 'thinking'
  | 'typing'
  | 'phone_ringing'
  | 'phone_excited'
  | 'phone_listening'
  | 'talking_closed'
  | 'talking_slightly_open'
  | 'talking_open';

export type SaraAnimation =
  | 'idle'
  | 'bounce'
  | 'float'
  | 'wave'
  | 'shake'
  | 'breathe'
  | 'phone-ring';

export type SidekickScene =
  | 'lost'
  | 'found'
  | 'packing_struggle'
  | 'packing_success'
  | 'jeep'
  | 'kaja_surfing'
  | 'kaja_skiing'
  | 'kaja_waving'
  | 'pedro_diving'
  | 'pedro_map'
  | 'pedro_waving'
  | 'pedro_suitcase'
  | 'pedro_suitcase_packed';

// ═══════════════════════════════════════════════════
// ASSET PATHS
// ═══════════════════════════════════════════════════

const GUIDES_PATH = '/pictures/Guides';

export const SARA_ASSETS: Record<string, string> = {
  idle: `${GUIDES_PATH}/sara_idle.png`,
  waving: `${GUIDES_PATH}/sara_desk_waving.png`,
  bored: `${GUIDES_PATH}/sara_bored_awaiting_call.png`,
  thinking: `${GUIDES_PATH}/sara_desk_thinking.png`,
  typing: `${GUIDES_PATH}/sara_desk_typing.png`,
  phone_ringing: `${GUIDES_PATH}/sara_phone_ringing.png`,
  phone_excited: `${GUIDES_PATH}/sara_desk_listening_excited.png`,
  phone_listening: `${GUIDES_PATH}/sara_desk_listening.png`,
  talking_closed: `${GUIDES_PATH}/sara_talking_mouth_closed.png`,
  talking_slightly_open: `${GUIDES_PATH}/sara_talking_mouth_slightly_open.png`,
  talking_open: `${GUIDES_PATH}/sara_talking_mouth_open.png`,
  // Standalone poses for small avatar
  excited: `${GUIDES_PATH}/sara_excited.png`,
  reading: `${GUIDES_PATH}/sara_reading.png`,
  standalone_waving: `${GUIDES_PATH}/sara_waving.png`,
  standalone_thinking: `${GUIDES_PATH}/sara_thinking.png`,
};

export const SIDEKICK_ASSETS: Record<SidekickScene, string> = {
  lost: `${GUIDES_PATH}/kaja_pedro_lost.png`,
  found: `${GUIDES_PATH}/kaja_pedro_found.png`,
  packing_struggle: `${GUIDES_PATH}/kaja_pedro_packing_unsuccessful.png`,
  packing_success: `${GUIDES_PATH}/kaja_pedro_packing_successful.png`,
  jeep: `${GUIDES_PATH}/Pedro_karel_jeep.png`,
  kaja_surfing: `${GUIDES_PATH}/kaja_surfing.png`,
  kaja_skiing: `${GUIDES_PATH}/kaja_skiing.png`,
  kaja_waving: `${GUIDES_PATH}/kaja_waiving.png`,
  pedro_diving: `${GUIDES_PATH}/pedro_diving.png`,
  pedro_map: `${GUIDES_PATH}/pedro_map.png`,
  pedro_waving: `${GUIDES_PATH}/pedro_waving.png`,
  pedro_suitcase: `${GUIDES_PATH}/pedro_suitcase.png`,
  pedro_suitcase_packed: `${GUIDES_PATH}/pedro_suitcase_packed.png`,
};

// ═══════════════════════════════════════════════════
// SARA STATE MACHINE
// ═══════════════════════════════════════════════════

interface UseSaraStateProps {
  callStatus: 'idle' | 'connecting' | 'connected' | 'error';
  voiceVolume: number;
  remoteVoiceVolume: number;
  isVoiceActive: boolean;
  isChatLoading: boolean;
  isChatOpen?: boolean;
}

interface SaraStateResult {
  state: SaraState;
  animation: SaraAnimation;
  imageSrc: string;
  speechBubble: string | null;
}

export function useSaraState({
  callStatus,
  voiceVolume,
  remoteVoiceVolume,
  isVoiceActive,
  isChatLoading,
  isChatOpen,
}: UseSaraStateProps): SaraStateResult {
  const [currentState, setCurrentState] = useState<SaraState>('waving');
  const [animation, setAnimation] = useState<SaraAnimation>('wave');
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const lastInteractionRef = useRef(Date.now());
  const boredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoteTalkRef = useRef(0);

  // Reset interaction timer on any state change
  const resetIdleTimer = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  // Priority-based state resolution
  useEffect(() => {
    resetIdleTimer();

    // Clear any pending bounce timeout
    if (bounceTimeoutRef.current) {
      clearTimeout(bounceTimeoutRef.current);
      bounceTimeoutRef.current = null;
    }

    // P1: Voice call states (highest priority)
    if (callStatus === 'connecting') {
      setCurrentState('phone_ringing');
      setAnimation('phone-ring');
      setSpeechBubble('📞 Connecting...');
      return;
    }

    if (callStatus === 'connected' && isVoiceActive) {
      // Determine if she should be talking or listening
      // We prioritize Gemini's voice (remoteVolume) for lip-sync
      const isGeminiTalking = remoteVoiceVolume > 0.05;
      const isUserTalking = voiceVolume > 0.05;

      if (isGeminiTalking) {
        lastRemoteTalkRef.current = Date.now();
        // Lip-sync based on remote volume
        if (remoteVoiceVolume > 0.15) {
          setCurrentState('talking_open');
        } else if (remoteVoiceVolume > 0.1) {
          setCurrentState('talking_slightly_open');
        } else {
          setCurrentState('talking_closed');
        }
        setAnimation('breathe');
        setSpeechBubble(null);
      } else if (isUserTalking && (Date.now() - lastRemoteTalkRef.current > 500)) {
        // User is talking, she is listening attentively
        setCurrentState('phone_excited');
        setAnimation('bounce');
        setSpeechBubble(null);
      } else {
        // Silence
        setCurrentState('phone_listening');
        setAnimation('idle');
        setSpeechBubble(null);
      }
      return;
    }

    // P2: Chat states
    if (isChatLoading) {
      setCurrentState('typing');
      setAnimation('idle');
      setSpeechBubble('✍️ Typing...');
      return;
    }

    // P3: Default idle state
    if (isChatOpen) {
      setCurrentState('thinking');
      setAnimation('idle');
      setSpeechBubble(null);
      return;
    }

    // P4: Default — waving
    setCurrentState('waving');
    setAnimation('wave');
    setSpeechBubble(null);
  }, [callStatus, voiceVolume, remoteVoiceVolume, isVoiceActive, isChatLoading, isChatOpen, resetIdleTimer]);

  // Bored timer: after 15s of 'waving' state, switch to bored
  useEffect(() => {
    if (currentState === 'waving') {
      boredTimerRef.current = setTimeout(() => {
        setCurrentState('bored');
        setAnimation('float');
        setSpeechBubble('💤 Click me!');
      }, 15000);
    }
    return () => {
      if (boredTimerRef.current) clearTimeout(boredTimerRef.current);
    };
  }, [currentState]);

  const imageSrc = SARA_ASSETS[currentState] || SARA_ASSETS.waving;

  return { state: currentState, animation, imageSrc, speechBubble };
}

// ═══════════════════════════════════════════════════
// SIDEKICK AMBIENT ROTATION
// ═══════════════════════════════════════════════════

const AMBIENT_SOLO_SCENES: SidekickScene[] = [
  'kaja_surfing', 'kaja_skiing', 'kaja_waving',
  'pedro_diving', 'pedro_map', 'pedro_waving',
  'jeep',
];

interface UseSidekickStateProps {
  hasTrip: boolean;
  packingComplete: boolean;
}

interface SidekickStateResult {
  activeScene: SidekickScene;
  imageSrc: string;
  ambientSoloScene: SidekickScene;
  ambientSoloSrc: string;
}

export function useSidekickState({ hasTrip, packingComplete }: UseSidekickStateProps): SidekickStateResult {
  // Main paired scene
  const mainScene: SidekickScene = packingComplete
    ? 'packing_success'
    : hasTrip
      ? 'found'
      : 'packing_struggle';

  // Random ambient solo character cycling
  const [ambientIndex, setAmbientIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAmbientIndex(prev => (prev + 1) % AMBIENT_SOLO_SCENES.length);
    }, 10000 + Math.random() * 5000); // 10-15s random interval

    return () => clearInterval(interval);
  }, []);

  const ambientScene = AMBIENT_SOLO_SCENES[ambientIndex];

  return {
    activeScene: mainScene,
    imageSrc: SIDEKICK_ASSETS[mainScene],
    ambientSoloScene: ambientScene,
    ambientSoloSrc: SIDEKICK_ASSETS[ambientScene],
  };
}
