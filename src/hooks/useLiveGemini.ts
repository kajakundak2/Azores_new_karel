import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioProcessor } from '../utils/audioUtils';
import { searchPlacesAsync } from './usePlacesSearch';
import { geminiKeyManager } from '../utils/geminiKeyManager';
import { getToolDeclarations } from '../utils/saraTools';

interface UseLiveGeminiProps {
  onUpdateItinerary?: (data: any) => Promise<void> | void;
  onUpdateTripDetails?: (data: any) => Promise<void> | void;
  onRemoveFromItinerary?: (data: { day: number; activity: string }) => Promise<void> | void;
  onClearDay?: (data: { day: number }) => Promise<void> | void;
  onClearItinerary?: () => Promise<void> | void;
  onTriggerSmartItinerary?: (intensity: string, dayNumbers?: number[]) => Promise<void> | void;
  onToolCall?: (name: string, args: any) => Promise<any>;
  onUploadDoc?: (file: File) => void;
  onRemoteVolumeChange?: (volume: number) => void;
  onVolumeChange?: (volume: number) => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'connected' | 'error', message?: string) => void;
  onShowUICard?: (card: any) => void;
  onMessage?: (text: string) => void;
  onUserMessage?: (text: string, isFinal?: boolean) => void;
  onCallInterrupt?: () => void;
  systemInstruction?: string;
  lang?: string;
  destination?: string;
}

/**
 * Live voice interaction with Gemini 3.1 Flash Live API via WebSocket.
 * Audio Format: 16-bit PCM, 16kHz input → 24kHz PCM output.
 */
export function useLiveGemini({ 
  onUpdateItinerary, 
  onUpdateTripDetails,
  onRemoveFromItinerary, 
  onClearDay,
  onClearItinerary,
  onTriggerSmartItinerary,
  onToolCall,
  onUploadDoc,
  onRemoteVolumeChange,
  onVolumeChange, 
  onStatusChange, 
  onShowUICard, 
  onMessage, 
  onUserMessage, 
  onCallInterrupt,
  systemInstruction,
  lang = 'en',
  destination = ''
}: UseLiveGeminiProps) {
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const maxReconnects = 3;

  // Callbacks refs to avoid stale closures in long-running WebSocket
  const callbacksRef = useRef({
    onUpdateItinerary,
    onUpdateTripDetails,
    onRemoveFromItinerary,
    onClearDay,
    onClearItinerary,
    onTriggerSmartItinerary,
    onToolCall,
    onUploadDoc,
    onShowUICard,
    onStatusChange,
    onRemoteVolumeChange,
    onVolumeChange,
    onMessage,
    onUserMessage,
    onCallInterrupt
  });

  useEffect(() => {
    callbacksRef.current = {
      onUpdateItinerary,
      onUpdateTripDetails,
      onRemoveFromItinerary,
      onClearDay,
      onClearItinerary,
      onTriggerSmartItinerary,
      onToolCall,
      onUploadDoc,
      onShowUICard,
      onStatusChange,
      onRemoteVolumeChange,
      onVolumeChange,
      onMessage,
      onUserMessage,
      onCallInterrupt
    };
  }, [
    onUpdateItinerary, 
    onUpdateTripDetails, 
    onRemoveFromItinerary, 
    onClearDay, 
    onClearItinerary, 
    onTriggerSmartItinerary, 
    onToolCall,
    onUploadDoc, 
    onShowUICard, 
    onStatusChange, 
    onRemoteVolumeChange, 
    onVolumeChange, 
    onMessage, 
    onUserMessage,
    onCallInterrupt
  ]);

  // Keep ref in sync
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const systemInstructionRef = useRef(systemInstruction);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Keep isMountedRef in sync
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep systemInstructionRef in sync
  useEffect(() => {
    systemInstructionRef.current = systemInstruction;
  }, [systemInstruction]);

  // Queue and scheduler for audio playback
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlayingRef = useRef(false);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sessionHandleRef = useRef<string | null>(null);
  const messageBufferRef = useRef<{ index: number, payload: any }[]>([]);
  const nextMessageIndexRef = useRef(1);
  const lastConsumedIndexRef = useRef(0);
  const isResumingRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const lastLocalVolumeUpdateRef = useRef<number>(0);

  // Unified send function that handles indexing and buffering for transparent resumption
  const sendToWS = useCallback((payload: any, skipBuffer: boolean = false) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Gemini Live: [SEND_FAIL] WebSocket is not open. State:', wsRef.current?.readyState, 'Payload:', payload);
      return;
    }

    if (skipBuffer) {
      // realtimeInput chunks are too large and frequent to log fully
      if (!payload.realtimeInput) {
        console.log('Gemini Live: [SEND_UNBUFFERED]', payload);
      }
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch (err) {
        console.error('Gemini Live: [SEND_ERR] Unbuffered send failed:', err);
      }
      return;
    }

    const nextIndex = nextMessageIndexRef.current;
    messageBufferRef.current.push({ index: nextIndex, payload });
    nextMessageIndexRef.current++;

    console.log('Gemini Live: [SEND_BUFFERED] Index:', nextIndex, payload);
    try {
      wsRef.current.send(JSON.stringify(payload));
    } catch (err) {
      console.error('Gemini Live: [SEND_ERR] Buffered send failed:', err);
    }
  }, []);

  const stopAllAudio = useCallback(() => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    isPlayingRef.current = false;
  }, []);

  const stopCall = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    callbacksRef.current.onStatusChange?.('idle');
    stopAllAudio();

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // Track might already be stopped
        }
      });
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }

    // Reset session handle only on explicit manual stop or fatal error
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
       console.log('Gemini Live: [CLEANUP] Clearing session state.');
       sessionHandleRef.current = null; 
       messageBufferRef.current = [];
       nextMessageIndexRef.current = 1;
       lastConsumedIndexRef.current = 0;
       setupCompleteRef.current = false;
    }
  }, [stopAllAudio]);

  // Handle unmount
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        stopCall();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Play raw PCM audio data (24kHz, 16-bit, LE) by converting to Float32 AudioBuffer.
   */
  const playPCMAudio = useCallback((base64Audio: string) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') {
      console.warn('Cannot play audio: context is closed or missing');
      return;
    }

    try {
      // Decode base64 to raw bytes
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Interpret as 16-bit signed PCM
      const pcm16 = new Int16Array(bytes.buffer);

      // Convert Int16 PCM to Float32 (-1.0 to 1.0)
      const floatData = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        floatData[i] = pcm16[i] / 32768.0;
      }
      
      // Gemini Live API outputs 24kHz audio
      const outputSampleRate = 24000;
      const audioBuffer = new AudioBuffer({
        length: floatData.length,
        sampleRate: outputSampleRate,
        numberOfChannels: 1,
      });
      audioBuffer.copyToChannel(floatData, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      // Connect to the remote analyser for sync
      if (remoteAnalyserRef.current) {
        source.connect(remoteAnalyserRef.current);
      } else {
        source.connect(ctx.destination);
      }

      // Scheduling logic
      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) {
        // Reduced padding for lower latency (from 0.05 to 0.01)
        nextStartTimeRef.current = now + 0.01;
      }

      const startTime = nextStartTimeRef.current;
      source.start(startTime);

      // Update next start time
      nextStartTimeRef.current += audioBuffer.duration;

      // Track active sources for interruption
      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
      };

    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }, []);

  const startCall = useCallback(async (isManual: boolean = false) => {
    if (isManual) reconnectCountRef.current = 0;
    if (!isMountedRef.current || isActiveRef.current || isStartingRef.current) return;

    if (geminiKeyManager.isServiceDown()) {
      setError('Gemini AI is currently under heavy load (503). Please try again in 5-10 minutes.');
      callbacksRef.current.onStatusChange?.('error');
      return;
    }

    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) {
      setError('No API keys available or service is cooling down.');
      callbacksRef.current.onStatusChange?.('error');
      return;
    }

    try {
      setError(null);
      isStartingRef.current = true;
      setIsActive(true);
      isActiveRef.current = true;
      callbacksRef.current.onStatusChange?.('connecting');

      // 1. Initialize Audio Context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioContext;

      console.log('AudioContext initialized. State:', audioContext.state);

      // Guard: Ensure context is not closed immediately
      if (audioContext.state === 'closed') {
        throw new Error('AudioContext was closed unexpectedly during initialization. Check browser permissions.');
      }

      // 2. Ensure AudioContext is running BEFORE loading modules or creating nodes
      // Browsers often start context as 'suspended' until a user gesture (which startCall is).
      if (audioContext.state === 'suspended') {
        console.log('Resuming AudioContext early...');
        await audioContext.resume();
        // Polling wait for 'running' state if resume() didn't resolve it immediately
        let retries = 10;
        while (audioContext.state !== 'running' && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
          retries--;
        }
        console.log('AudioContext state after early resume:', audioContext.state);
      }

      // 3. Load the Audio Worklet Module
      try {
        if (!audioContext.audioWorklet) {
          throw new Error('AudioWorklet is not supported in this browser or context.');
        }

        console.log('Loading AudioWorklet module...');
        // Using a cache-busting or absolute path if necessary, but '/pcm-processor.worklet.js' is usually fine
        await audioContext.audioWorklet.addModule('/pcm-processor.worklet.js');
        console.log('AudioWorklet module loaded.');
      } catch (e: any) {
        console.error('Worklet module addition failed:', e);
        throw new Error(`Could not load audio processor: ${e.message || 'Unknown error'}`);
      }

      // Re-check if still active after async addModule
      if (!isMountedRef.current || !isActiveRef.current || audioContext.state === 'closed') {
        if (audioContext.state !== 'closed') await audioContext.close();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Re-check if still active after async getUserMedia
      if (!isMountedRef.current || !isActiveRef.current || audioContext.state === 'closed') {
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== 'closed') await audioContext.close();
        return;
      }
      streamRef.current = stream;

      // Ensure context is STILL running after getUserMedia (which might have taken time)
      if (audioContext.state !== 'running') {
        console.log('Resuming AudioContext again...');
        await audioContext.resume();
      }

      // Create Analyser for remote volume (sync)
      const remoteAnalyser = audioContext.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.5;
      remoteAnalyser.connect(audioContext.destination);
      remoteAnalyserRef.current = remoteAnalyser;

      // Start the volume analysis loop
      const volumeData = new Float32Array(remoteAnalyser.fftSize);
      let smoothedVolume = 0;
      
      const analyzeVolume = () => {
        if (!remoteAnalyserRef.current || audioContext.state === 'closed') return;
        remoteAnalyser.getFloatTimeDomainData(volumeData);
        
        let sum = 0;
        for (let i = 0; i < volumeData.length; i++) {
          sum += volumeData[i] * volumeData[i];
        }
        const rms = Math.sqrt(sum / volumeData.length);
        smoothedVolume = smoothedVolume * 0.85 + rms * 0.15;
        
        const noiseFloor = 0.005;
        const finalVol = smoothedVolume > noiseFloor ? smoothedVolume : 0;
        if (finalVol > 0 || smoothedVolume > 0.01) {
           callbacksRef.current.onRemoteVolumeChange?.(finalVol);
        }
        
        animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      };
      
      analyzeVolume();

      // Final safety check before creating AudioWorkletNode
      if (!isMountedRef.current || audioContext.state === 'closed' || !isActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== 'closed') await audioContext.close();
        return;
      }

      const source = audioContext.createMediaStreamSource(stream);

      let workletNode: AudioWorkletNode;
      try {
        console.log('Creating AudioWorkletNode... Final state check:', audioContext.state);
        
        // Final attempt to ensure it's running
        if (audioContext.state !== 'running') {
          await audioContext.resume();
        }

        if (audioContext.state !== 'running') {
           throw new Error(`Audio engine could not be started (Current state: ${audioContext.state}).`);
        }

        workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        processorRef.current = workletNode;
        console.log('AudioWorkletNode created successfully.');
      } catch (e: any) {
        console.error('Failed to create AudioWorkletNode:', e);
        throw new Error(`Audio engine could not be initialized: ${e.message || 'Unknown error'}`);
      }


      // 2. Initialize WebSocket to Gemini Live API (Use v1beta for 3.1)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      console.log('Gemini Live: Connecting to WebSocket...', wsUrl.replace(apiKey, apiKey.substring(0, 5) + '...'));
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Gemini Live: WebSocket opened. Resuming:', !!sessionHandleRef.current);
        isResumingRef.current = !!sessionHandleRef.current;
        
        // Using gemini-3.1-flash-live-preview (no stable GA replacement yet as of May 2026)
        // IMPORTANT: Raw WebSocket protocol requires camelCase field names
        const setupMessage: any = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: { 
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { 
                  prebuiltVoiceConfig: { voiceName: "Aoede" } 
                }
              }
            },
            systemInstruction: {
              parts: [{
                text: systemInstructionRef.current || 'You are "Sara," a knowledgeable and friendly travel planning assistant.'
              }]
            },
            tools: [{
              functionDeclarations: getToolDeclarations(destination)
            }]
          }
        };

        // Handle session resumption if we have a handle
        if (sessionHandleRef.current) {
          console.log('Gemini Live: [SESSION_RESUME] Attempting resumption with handle:', sessionHandleRef.current);
          setupMessage.setup.sessionResumption = {
            handle: sessionHandleRef.current
          };
        }

        console.log('Gemini Live: [SEND_SETUP] Sending setup message:', JSON.stringify(setupMessage, null, 2));
        try {
          ws.send(JSON.stringify(setupMessage));
        } catch (err) {
          console.error('Gemini Live: [SETUP_ERR] Failed to send setup:', err);
        }
      };

      ws.onmessage = async (event) => {
        try {
          let messageText: string;
          if (typeof event.data === 'string') {
            messageText = event.data;
          } else if (event.data instanceof Blob) {
            messageText = await event.data.text();
          } else {
            console.warn('Gemini Live: [MSG] Received unknown data type:', typeof event.data);
            return;
          }

          const response = JSON.parse(messageText);
          
          // Enhanced Logging for Debugging
          if (response.setupComplete || response.setup_complete) {
            console.log('Gemini Live: [RECV] Setup Complete:', response.setupComplete || response.setup_complete);
          } else if (response.serverContent || response.server_content) {
            const content = response.serverContent || response.server_content;
            if (content.modelTurn?.parts?.some((p: any) => p.inlineData)) {
               // Audio chunks summary
               console.log('Gemini Live: [RECV] Audio chunk received');
            } else {
               console.log('Gemini Live: [RECV] Server Content:', content);
            }
          } else if (response.toolCall || response.tool_call) {
            console.log('Gemini Live: [RECV] Tool Call:', response.toolCall || response.tool_call);
          } else if (response.sessionResumptionUpdate || response.session_resumption_update) {
            console.log('Gemini Live: [RECV] Session Resumption Update:', response.sessionResumptionUpdate || response.session_resumption_update);
          } else if (response.inputTranscription || response.input_transcription) {
            console.log('Gemini Live: [RECV] Input Transcription:', response.inputTranscription || response.input_transcription);
          } else if (response.outputTranscription || response.output_transcription) {
            console.log('Gemini Live: [RECV] Output Transcription:', response.outputTranscription || response.output_transcription);
          } else {
            console.log('Gemini Live: [RECV] Other message:', response);
          }

          const isSetupComplete = response.setupComplete || response.setup_complete;
          const serverContent = response.serverContent || response.server_content;
          const toolCall = response.toolCall || response.tool_call;
          const sessionResUpdate = response.sessionResumptionUpdate || response.session_resumption_update;
          const goAway = response.goAway || response.go_away;

          if (goAway) {
            console.log('Gemini Live: Received go_away. Reconnecting proactively...');
            // Proactive reconnect: close will trigger the onclose logic which has reconnect
            ws.close(4000, "Proactive Reconnect");
            return;
          }

          if (sessionResUpdate) {
            console.log('Gemini Live: [SESSION_RES_UPDATE] Received update:', sessionResUpdate);
            // The API might return token in various fields depending on version/snake/camel
            const newToken = sessionResUpdate.token || 
                            sessionResUpdate.sessionResumptionToken || 
                            sessionResUpdate.session_resumption_token || 
                            sessionResUpdate.newHandle || 
                            sessionResUpdate.new_handle;
            
            if (newToken) {
              console.log('Gemini Live: [SESSION_RES_UPDATE] Saving new handle:', newToken);
              sessionHandleRef.current = newToken;
            }

            const lastConsumed = sessionResUpdate.lastConsumedClientMessageIndex ?? 
                               sessionResUpdate.last_consumed_client_message_index;
            
            if (lastConsumed !== undefined) {
              console.log('Gemini Live: [SESSION_RES_UPDATE] Server consumed up to index:', lastConsumed);
              lastConsumedIndexRef.current = lastConsumed;
              // Prune buffer of messages server has already seen
              const beforePrune = messageBufferRef.current.length;
              messageBufferRef.current = messageBufferRef.current.filter(m => m.index > lastConsumed);
              console.log(`Gemini Live: [SESSION_RES_UPDATE] Pruned buffer: ${beforePrune} -> ${messageBufferRef.current.length} items remaining`);
            }
          }

          if (isSetupComplete) {
            setupCompleteRef.current = true;
            console.log('Gemini Live: [STATE] Setup complete, engine ready.');
            callbacksRef.current.onStatusChange?.('connected');
            
            // Replay unconsumed messages if resuming
            if (isResumingRef.current && messageBufferRef.current.length > 0) {
              console.log(`Gemini Live: [RESUME_REPLAY] Replaying ${messageBufferRef.current.length} unconsumed messages`);
              messageBufferRef.current.forEach(msg => {
                console.log('Gemini Live: [REPLAYING_INDEX]', msg.index);
                ws.send(JSON.stringify(msg.payload));
              });
            }
            isResumingRef.current = false;

            const workletNode = processorRef.current as AudioWorkletNode;
            if (workletNode) {
              source.connect(workletNode);

              const silentGain = audioContext.createGain();
              silentGain.gain.value = 0;
              workletNode.connect(silentGain);
              silentGain.connect(audioContext.destination);

              workletNode.port.onmessage = (event) => {
                if (ws.readyState === WebSocket.OPEN && setupCompleteRef.current) {
                  const inputData = event.data as Float32Array;
                  const pcmData = AudioProcessor.toPCM16(inputData);
                  const base64Audio = AudioProcessor.arrayBufferToBase64(pcmData.buffer);

                  sendToWS({
                    realtimeInput: {
                      audio: {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio
                      }
                    }
                  }, true);

                  let sum = 0;
                  for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                  const vol = Math.sqrt(sum / inputData.length);
                  const now = Date.now();
                  if (now - lastLocalVolumeUpdateRef.current > 100) {
                    if (vol > 0.05) {
                      callbacksRef.current.onVolumeChange?.(vol);
                      lastLocalVolumeUpdateRef.current = now;
                    } else if (vol < 0.01) {
                      callbacksRef.current.onVolumeChange?.(0);
                      lastLocalVolumeUpdateRef.current = now;
                    }
                  }
                }
              };
            }
            return;
          }

          // Handle interruption
          if (serverContent?.interrupted) {
            console.log('Gemini Live: Interrupted by user speech');
            stopAllAudio();
            callbacksRef.current.onCallInterrupt?.();
          }

          // Handle Audio & Text responses
          if (serverContent) {
            const { modelTurn, userContent, inputTranscription, outputTranscription } = serverContent;
            const model_turn = modelTurn || serverContent.model_turn;
            const input_trans = inputTranscription || serverContent.input_transcription;
            const output_trans = outputTranscription || serverContent.output_transcription;

            // 1. Handle Model Audio Response
            if (model_turn?.parts) {
              for (const part of model_turn.parts) {
                const inlineData = part.inlineData || part.inline_data;
                if (inlineData?.data) {
                  playPCMAudio(inlineData.data);
                }
                if (part.text) {
                  callbacksRef.current.onMessage?.(part.text);
                }
                
                // Handle Function Calls embedded in parts (newer spec)
                const fCall = part.functionCall || part.function_call;
                if (fCall) {
                  console.log('Gemini Live: Found function call in model turn parts:', fCall);
                  handleFunctionCall(fCall);
                }
              }
            }

            // 2. Handle User Transcription
            if (input_trans) {
              const text = input_trans.text;
              const isFinal = input_trans.isFinal ?? input_trans.is_final;
              callbacksRef.current.onUserMessage?.(text, isFinal);
            }

            // 3. Handle Model Transcription
            if (output_trans) {
              callbacksRef.current.onMessage?.(output_trans.text);
            }
          }

          // Handle Top-Level Tool Call responses (legacy/alternative spec)
          const functionCalls = toolCall?.functionCalls || toolCall?.function_calls;
          if (functionCalls) {
            for (const functionCall of functionCalls) {
              handleFunctionCall(functionCall);
            }
          }
        } catch (err) {
          console.warn('Gemini Live: [PARSE_ERROR] WS message parse error:', err);
        }
      };

      // Unified Function Call Handler
      const handleFunctionCall = (functionCall: any) => {
        const { name, args, id } = functionCall;
        console.log('Gemini Live Tool Call:', name, args);

        const sendResponse = (resp: any) => {
          sendToWS({
            toolResponse: {
              functionResponses: [{
                id,
                name,
                response: resp
              }]
            }
          });
        };

        // Notify UI that a tool is being processed
        callbacksRef.current.onStatusChange?.('connected', `Processing ${name}...`);

        // Route all tools through the unified onToolCall handler if provided
        if (callbacksRef.current.onToolCall) {
          const processTool = async () => {
            try {
              console.log(`Gemini Live: [TOOL_START] ${name}`, args);
              const result = await callbacksRef.current.onToolCall!(name, args || {});
              console.log(`Gemini Live: [TOOL_SUCCESS] ${name} Result:`, result);
              
              const msg = result?.replyText 
                ? (typeof result.replyText === 'string' ? result.replyText : result.replyText.en)
                : (result?.message || `Executed ${name}.`);

              // Send success response back to the model
              sendResponse({ 
                success: true, 
                message: msg 
              });
              // Clear tool status
              callbacksRef.current.onStatusChange?.('connected');
            } catch (err: any) {
              console.error(`Gemini Live: [TOOL_ERROR] ${name} Failed:`, err);
              sendResponse({ 
                success: false, 
                message: `Failed: ${err.message}` 
              });
              callbacksRef.current.onStatusChange?.('connected');
            }
          };
          processTool();
        } else {
          // Fallback for standalone usage without TravelPortal/onToolCall
          console.warn(`Gemini Live: [TOOL_WARN] No onToolCall handler for ${name}. Model will be notified of failure.`);
          sendResponse({ success: false, message: "Tool execution not implemented in this context." });
        }
      };

      ws.onerror = (e) => {
        console.error('Gemini Live: [WS_ERROR] WebSocket Error:', e);
        geminiKeyManager.markKeyFailed(apiKey, true); 
        setError('Voice connection failed. Check your API key and console for details.');
        callbacksRef.current.onStatusChange?.('error');
        stopCall();
      };

      ws.onclose = (e) => {
        // Use ref to check active status to avoid stale closure
        if (isActiveRef.current) {
          console.log('Gemini Live: [WS_CLOSED] Code:', e.code, 'Reason:', e.reason || 'No reason provided');
          
          const isLeaked = e.code === 1008 && e.reason && e.reason.toLowerCase().includes('leaked');
          if (isLeaked) {
            console.log(`Gemini Live: [LEAKED_KEY] Key ${apiKey.substring(0, 8)}... leaked. Blocking and rotating.`);
            geminiKeyManager.markKeyFailed(apiKey, true, 60, true);
          }

          // Codes to NOT reconnect: 1000 (normal), 1008 (policy violation/bad key unless leaked), 400x (manual/proactive)
          const hasMoreKeys = geminiKeyManager.getAvailableCount() > 0;
          const isFatal = (!isLeaked && e.code === 1008) || (isLeaked && !hasMoreKeys) || e.code === 4001; 
          
          if (!isFatal && reconnectCountRef.current < maxReconnects && e.code !== 1000) {
            const isProactive = e.code === 4000;
            console.log(`Gemini Live: [RECONNECTING] ${isProactive ? 'Proactive' : 'Unexpected'} reconnect ${reconnectCountRef.current + 1}/${maxReconnects}...`);
            
            if (!isProactive && !isLeaked) reconnectCountRef.current++;
            
            callbacksRef.current.onStatusChange?.('connecting', isProactive ? 'Refreshing session...' : (isLeaked ? 'Switching API key...' : 'Reconnecting...'));
            
            setTimeout(() => {
              if (isActiveRef.current) {
                console.log('Gemini Live: [RETRY_START] Attempting startCall again.');
                startCall(false);
              }
            }, isProactive ? 100 : 2000);
          } else {
            // Fatal or Max Reconnects or Normal Close (1000)
            if (e.code !== 1000) {
              console.log('Gemini Live: [FATAL_STOP] Not reconnecting. Code:', e.code);
              setError(`Call ended. Reason: ${e.reason || 'Server disconnected'} (Code: ${e.code})`);
              callbacksRef.current.onStatusChange?.('error');
            } else {
              console.log('Gemini Live: [NORMAL_STOP] Session closed normally.');
            }
            // Clear session state
            sessionHandleRef.current = null;
            messageBufferRef.current = [];
            nextMessageIndexRef.current = 1;
            setupCompleteRef.current = false;
            stopCall();
          }
        } else {
          console.log('Gemini Live: [WS_CLOSED_INACTIVE] WebSocket closed while inactive. Code:', e.code);
          // If already inactive (manual stop), ensure state is cleared if code is final
          if (e.code === 1000 || e.code === 1008 || e.code === 4001) {
            sessionHandleRef.current = null;
            messageBufferRef.current = [];
            nextMessageIndexRef.current = 1;
            setupCompleteRef.current = false;
          }
        }
      };

    } catch (err: any) {
      console.error('Call failed:', err);
      setError(err.message || 'Failed to start voice call');
      callbacksRef.current.onStatusChange?.('error');
      stopCall();
    } finally {
      isStartingRef.current = false;
    }
  }, [stopCall, playPCMAudio, destination]);

  // System instruction mid-session handling:
  // Gemini 3.1 Flash Live does NOT support clientContent with role "system" mid-session.
  // The SI is set in the setup message. systemInstructionRef is already kept in sync
  // (line ~136), so the next connection/reconnect will automatically use the latest SI.
  // No action needed here — avoid reconnecting just for SI changes.

  return {
    isActive,
    error,
    startCall,
    stopCall,
    resetReconnection: () => { reconnectCountRef.current = 0; }
  };
}
