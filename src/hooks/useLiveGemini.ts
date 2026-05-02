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
  onStatusChange?: (status: 'idle' | 'connecting' | 'connected' | 'error') => void;
  onShowUICard?: (card: any) => void;
  onMessage?: (text: string) => void;
  onUserMessage?: (text: string, isFinal?: boolean) => void;
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
  systemInstruction,
  lang = 'en',
  destination = ''
}: UseLiveGeminiProps) {
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
    onUserMessage
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
      onUserMessage
    };
  }, [
    onUpdateItinerary, 
    onUpdateTripDetails, 
    onRemoveFromItinerary, 
    onClearDay, 
    onClearItinerary, 
    onTriggerSmartItinerary, 
    onUploadDoc, 
    onShowUICard, 
    onStatusChange, 
    onRemoteVolumeChange, 
    onVolumeChange, 
    onMessage, 
    onUserMessage
  ]);

  // Keep ref in sync
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Removing session_update useEffect as it is not supported/needed in mid-call for v1beta Bidi
  // and was causing "Unknown name session_update" errors.

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  // Queue and scheduler for audio playback
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlayingRef = useRef(false);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
    onStatusChange?.('idle');
    stopAllAudio();

    if (wsRef.current) {
      wsRef.current.close();
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
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [onStatusChange, stopAllAudio]);

  // Handle unmount
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        stopCall();
      }
    };
  }, [stopCall]);

  /**
   * Play raw PCM audio data (24kHz, 16-bit, LE) by converting to Float32 AudioBuffer.
   */
  const playPCMAudio = useCallback((base64Audio: string) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') return;

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
        // Small padding to avoid click/pop on first chunk
        nextStartTimeRef.current = now + 0.05;
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

  const startCall = useCallback(async () => {
    if (geminiKeyManager.isServiceDown()) {
      setError('Gemini AI is currently under heavy load (503). Please try again in 5-10 minutes.');
      onStatusChange?.('error');
      return;
    }

    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) {
      setError('No API keys available or service is cooling down.');
      onStatusChange?.('error');
      return;
    }

    try {
      setError(null);
      setIsActive(true);
      onStatusChange?.('connecting');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // 1. Initialize Audio Context (16kHz for input)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContextRef.current = audioContext;

      // Create Analyser for remote volume (sync)
      const remoteAnalyser = audioContext.createAnalyser();
      remoteAnalyser.fftSize = 256;
      remoteAnalyser.smoothingTimeConstant = 0.5; // Smoother transitions
      remoteAnalyser.connect(audioContext.destination);
      remoteAnalyserRef.current = remoteAnalyser;

      // Start the volume analysis loop
      const volumeData = new Float32Array(remoteAnalyser.fftSize);
      let smoothedVolume = 0;
      
      const analyzeVolume = () => {
        if (!remoteAnalyserRef.current) return;
        remoteAnalyser.getFloatTimeDomainData(volumeData);
        
        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < volumeData.length; i++) {
          sum += volumeData[i] * volumeData[i];
        }
        const rms = Math.sqrt(sum / volumeData.length);
        
        // Exponential smoothing (Low-pass filter)
        // Adjust 0.3 to change how "fast" she responds. Higher = snappier, Lower = smoother.
        smoothedVolume = smoothedVolume * 0.85 + rms * 0.15;
        
        // Only report if above noise floor and significantly different from 0
        const noiseFloor = 0.005;
        const finalVol = smoothedVolume > noiseFloor ? smoothedVolume : 0;
        if (finalVol > 0 || smoothedVolume > 0.01) {
           callbacksRef.current.onRemoteVolumeChange?.(finalVol);
        }
        
        animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      };
      
      analyzeVolume();

      const source = audioContext.createMediaStreamSource(stream);
      
      // Migration to AudioWorklet (removes ScriptProcessorNode deprecation)
      await audioContext.audioWorklet.addModule('/pcm-processor.worklet.js');
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      processorRef.current = workletNode;

      // 2. Initialize WebSocket to Gemini Live API (Use v1beta for 3.1)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send Setup Message as first message (per AI instructions.md and server error 1007)
        // Reverting to models/gemini-3.1-flash-live-preview and using snake_case as required by v1beta Bidi
        const setupMessage = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generation_config: {
              response_modalities: ["AUDIO"],
              speech_config: {
                voice_config: { 
                  prebuilt_voice_config: { voice_name: "Aoede" } 
                }
              }
            },
            // thinking_config: { thinking_level: 'minimal' }, // From AI instructions.md
            system_instruction: {
              parts: [{
                text: systemInstruction || 'You are "Sara," a knowledgeable and friendly travel planning assistant.'
              }]
            },
            tools: [{
              functionDeclarations: getToolDeclarations(destination)
            }]
          }
        };
        ws.send(JSON.stringify(setupMessage));

        // Wait for setup complete before streaming audio
        // The first server message after setup is the setupComplete confirmation
      };

      let setupComplete = false;

      ws.onmessage = async (event) => {
        try {
          let messageText: string;
          if (typeof event.data === 'string') {
            messageText = event.data;
          } else if (event.data instanceof Blob) {
            messageText = await event.data.text();
          } else {
            return;
          }

          const response = JSON.parse(messageText);
          const isSetupComplete = response.setupComplete || response.setup_complete;
          const serverContent = response.serverContent || response.server_content;
          const toolCall = response.toolCall || response.tool_call;

          if (isSetupComplete) {
            setupComplete = true;
            onStatusChange?.('connected');
            const workletNode = processorRef.current as AudioWorkletNode;
            if (workletNode) {
              source.connect(workletNode);

              const silentGain = audioContext.createGain();
              silentGain.gain.value = 0;
              workletNode.connect(silentGain);
              silentGain.connect(audioContext.destination);

              workletNode.port.onmessage = (event) => {
                if (ws.readyState === WebSocket.OPEN && setupComplete) {
                  const inputData = event.data as Float32Array;
                  const pcmData = AudioProcessor.toPCM16(inputData);
                  const base64Audio = AudioProcessor.arrayBufferToBase64(pcmData.buffer);

                  ws.send(JSON.stringify({
                    realtime_input: {
                      audio: {
                        mime_type: "audio/pcm;rate=16000",
                        data: base64Audio
                      }
                    }
                  }));

                  let sum = 0;
                  for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                  const vol = Math.sqrt(sum / inputData.length);
                  if (vol > 0.05) {
                    onVolumeChange?.(vol);
                  } else if (vol < 0.01) {
                     onVolumeChange?.(0);
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
                if (part.inlineData?.data || part.inline_data?.data) {
                  playPCMAudio(part.inlineData?.data || part.inline_data?.data);
                }
                if (part.text) {
                  onMessage?.(part.text);
                }
              }
            }

            // 2. Handle User Transcription
            if (input_trans) {
              onUserMessage?.(input_trans.text, input_trans.isFinal || input_trans.is_final);
            }

            // 3. Handle Model Transcription
            if (output_trans) {
              onMessage?.(output_trans.text);
            }
          }

          // Handle Function Call responses
          const functionCalls = toolCall?.functionCalls || toolCall?.function_calls;
          if (functionCalls) {
            for (const functionCall of functionCalls) {
              const { name, args, id } = functionCall;
              console.log('Gemini Live Tool Call:', name, args);

              const sendResponse = (resp: any) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    tool_response: {
                      function_responses: [{
                        id,
                        name,
                        response: resp
                      }]
                    }
                  }));
                }
              };

              // If onToolCall is available, route everything through it (unified tool handling)
              if (callbacksRef.current.onToolCall) {
                const processGeneric = async () => {
                  try {
                    const result = await callbacksRef.current.onToolCall!(name, args || {});
                    sendResponse({ success: true, message: result?.message || `Executed ${name}.` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                processGeneric();
                continue;
              }

              if (name === 'trigger_smart_itinerary_generation' && args) {
                const processSmart = async () => {
                  try {
                    await callbacksRef.current.onTriggerSmartItinerary?.(args.intensity, args.dayNumbers);
                    sendResponse({ success: true, message: `Started smart generation with intensity: ${args.intensity || 'balanced'}.` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                processSmart();
              } else if (name === 'update_itinerary' && args) {
                const processUpdate = async () => {
                  try {
                    // Route to bulk update agent via onToolCall or legacy onUpdateItinerary
                    if (callbacksRef.current.onToolCall) {
                      await callbacksRef.current.onToolCall(name, args);
                    } else {
                      await callbacksRef.current.onUpdateItinerary?.(args as any);
                    }
                    sendResponse({ success: true, message: `Bulk itinerary update applied.` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                processUpdate();
              } else if (name === 'remove_from_itinerary' && args) {
                const processRemove = async () => {
                  try {
                    await callbacksRef.current.onRemoveFromItinerary?.(args as any);
                    sendResponse({ success: true, message: `Removed "${args.activity}" from Day ${args.day}` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed to remove: ${err.message}` });
                  }
                };
                processRemove();
              } else if (name === 'update_trip_details' && args) {
                const p = async () => {
                  try {
                    await callbacksRef.current.onUpdateTripDetails?.(args as any);
                    sendResponse({ success: true, message: `Updated trip parameters.` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                p();
              } else if (name === 'clear_day' && args) {
                const p = async () => {
                  try {
                    await callbacksRef.current.onClearDay?.(args as any);
                    sendResponse({ success: true, message: `Cleared Day ${args.day}` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                p();
              } else if (name === 'clear_itinerary') {
                const p = async () => {
                  try {
                    await callbacksRef.current.onClearItinerary?.();
                    sendResponse({ success: true, message: `Cleared entire itinerary.` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                p();
              } else if (name === 'searchGooglePlaces' && args) {
                searchPlacesAsync(args.query).then(results => {
                  if (results.length > 0) callbacksRef.current.onShowUICard?.(results[0]);
                  sendResponse({ results: results.slice(0, 3) });
                }).catch(err => sendResponse({ success: false, message: err.message }));
              } else {
                // Route all other tools (atomic mutations) through onToolCall
                const processGeneric = async () => {
                  try {
                    const result = await callbacksRef.current.onToolCall?.(name, args || {});
                    sendResponse({ success: true, message: result?.message || `Executed ${name}.` });
                  } catch (err: any) {
                    sendResponse({ success: false, message: `Failed: ${err.message}` });
                  }
                };
                processGeneric();
              }
            }
          }
        } catch (err) {
          console.warn('WS message parse error:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('WS Error:', e);
        geminiKeyManager.markKeyFailed(apiKey, true); // Assume 429 or similar on error for safety
        setError('Voice connection failed. Check your API key and try again.');
        onStatusChange?.('error');
        stopCall();
      };

      ws.onclose = (e) => {
        // Use ref to check active status to avoid stale closure
        if (isActiveRef.current) {
          console.error('WS closed unexpectedly:', e.code, e.reason);
          setError(`Call ended. Reason: ${e.reason || 'Server disconnected'} (Code: ${e.code})`);
          onStatusChange?.('error');
          stopCall();
        }
      };

    } catch (err: any) {
      console.error('Call failed:', err);
      setError(err.message || 'Failed to start voice call');
      onStatusChange?.('error');
      stopCall();
    }
  }, [onUpdateItinerary, onVolumeChange, onRemoteVolumeChange, onStatusChange, stopCall, playPCMAudio, isActive, onShowUICard, systemInstruction, lang]);

  return {
    isActive,
    error,
    startCall,
    stopCall
  };
}
