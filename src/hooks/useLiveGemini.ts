import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioProcessor } from '../utils/audioUtils';
import { searchPlacesAsync } from './usePlacesSearch';
import { geminiKeyManager } from '../utils/geminiKeyManager';

interface UseLiveGeminiProps {
  onUpdateItinerary?: (data: { day: number; activity: string; description?: string; category?: string; type?: string; intensity?: string }) => void;
  onUpdateTripDetails?: (data: { destination?: string; startDate?: string; endDate?: string; adults?: number; kids?: number; preferences?: string }) => void;
  onRemoveFromItinerary?: (data: { day: number; activity: string }) => void;
  onClearDay?: (data: { day: number }) => void;
  onClearItinerary?: () => void;
  onTriggerSmartItinerary?: (intensity: string) => void;
  onUploadDoc?: (file: File) => void;
  onRemoteVolumeChange?: (volume: number) => void;
  onVolumeChange?: (volume: number) => void;
  onStatusChange?: (status: 'idle' | 'connecting' | 'connected' | 'error') => void;
  onShowUICard?: (card: any) => void;
  onMessage?: (text: string) => void;
  onUserMessage?: (text: string, isFinal?: boolean) => void;
  systemInstruction?: string;
  lang?: string;
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
  onUploadDoc,
  onRemoteVolumeChange,
  onVolumeChange, 
  onStatusChange, 
  onShowUICard, 
  onMessage, 
  onUserMessage, 
  systemInstruction,
  lang = 'en'
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
      onUploadDoc,
      onShowUICard,
      onStatusChange,
      onRemoteVolumeChange,
      onVolumeChange,
      onMessage,
      onUserMessage
    };
  }, [onUpdateItinerary, onRemoveFromItinerary, onClearDay, onClearItinerary, onTriggerSmartItinerary, onUploadDoc, onShowUICard, onStatusChange, onRemoteVolumeChange, onVolumeChange, onMessage, onUserMessage]);

  // Keep ref in sync
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

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
    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) {
      setError('No API keys available. Please check .env file.');
      onStatusChange?.('error');
      return;
    }

    try {
      setError(null);
      setIsActive(true);
      onStatusChange?.('connecting');

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
        
        // Only report if above noise floor
        const noiseFloor = 0.005;
        callbacksRef.current.onRemoteVolumeChange?.(smoothedVolume > noiseFloor ? smoothedVolume : 0);
        
        animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      };
      
      analyzeVolume();

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

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // 2. Initialize WebSocket to Gemini Live API
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send Setup Message as first message (per AI instructions.md)
        const setupMessage = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
                languageCode: lang === 'cs' ? 'cs-CZ' : 'en-US'
              },
              // Use thinkingLevel for 3.1 Flash Live inside generationConfig
              thinkingConfig: {
                thinkingLevel: "minimal"
              }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{
                text: systemInstruction || 'You are "Sara," a knowledgeable and friendly travel planning assistant.'
              }]
            },
            tools: [{
              functionDeclarations: [
                {
                  name: "trigger_smart_itinerary_generation",
                  description: "Triggers the system to automatically generate a highly detailed, smart, day-by-day itinerary with connected activities, food stops, and optimal routing. Use this when the user asks you to plan everything, pack the days, or create the whole trip plan.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      intensity: { type: "STRING", enum: ["relaxed", "balanced", "packed"], description: "The pace of the trip." }
                    }
                  }
                },
                {
                  name: "update_itinerary",
                  description: "Modifies the trip schedule when the user wants to add, change, or remove an activity for a specific day.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      day: { type: "NUMBER", description: "Day number (1-10)" },
                      activity: { type: "STRING", description: "Short title of the activity" },
                      description: { type: "STRING", description: "A one-sentence engaging description." },
                      category: { type: "STRING", enum: ["Sightseeing", "Activity", "Food", "Transport", "Special", "City"], description: "The type of activity." },
                      address: { type: "STRING", description: "Street address or area name of the location." },
                      location: {
                        type: "OBJECT",
                        description: "Approximate GPS coordinates of the activity.",
                        properties: {
                          lat: { type: "NUMBER", description: "Latitude" },
                          lng: { type: "NUMBER", description: "Longitude" }
                        }
                      }
                    },
                    required: ["day", "activity"]
                  }
                },
                {
                  name: "update_trip_details",
                  description: "Updates high-level trip parameters such as destination, dates, and number of travelers based on the conversation.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      destination: { type: "STRING", description: "The trip destination (e.g., 'São Miguel, Azores')" },
                      startDate: { type: "STRING", description: "Start date in YYYY-MM-DD format" },
                      endDate: { type: "STRING", description: "End date in YYYY-MM-DD format" },
                      adults: { type: "NUMBER", description: "Number of adult travelers" },
                      kids: { type: "NUMBER", description: "Number of children" },
                      preferences: { type: "STRING", description: "General travel preferences or requests." },
                      planningMode: { type: "STRING", enum: ["full", "suggestions_only"], description: "Whether to plan all days or just give suggestions." }
                    }
                  }
                },
                {
                  name: "clear_day",
                  description: "Clear all activities from a specific day in the itinerary.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      day: { type: "NUMBER", description: "The day number to clear (e.g., 1 for Day 1)" }
                    },
                    required: ["day"]
                  }
                },
                {
                  name: "clear_itinerary",
                  description: "Clear all non-fixed activities from the entire itinerary.",
                  parameters: {
                    type: "OBJECT",
                    properties: {}
                  }
                },
                {
                  name: "generate_itinerary",
                  description: "Finalizes the planning phase and creates the actual trip itinerary. Use this when the user is satisfied and wants to see the plan.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      planningMode: { type: "STRING", enum: ["full", "suggestions_only"], description: "The user's choice: 'full' for a day-by-day plan, 'suggestions_only' for just a list of POIs." }
                    }
                  }
                },
                {
                  name: "remove_from_itinerary",
                  description: "Removes an activity/POI from the itinerary. Requires exact day number and exact activity title.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      day: { type: "NUMBER", description: "Day number to remove from (1-10)" },
                      activity: { type: "STRING", description: "Title or name of activity to remove" }
                    },
                    required: ["day", "activity"]
                  }
                },
                {
                  name: 'searchGooglePlaces',
                  description: 'Search for a real point of interest (restaurant, trail, location, city, event etc.). Returns real places with photos and ratings.',
                  parameters: {
                    type: 'OBJECT',
                    properties: { query: { type: 'STRING' } },
                    required: ['query']
                  }
                },
                {
                  name: 'searchFlights',
                  description: 'Search for flight options to the destination.',
                  parameters: {
                    type: 'OBJECT',
                    properties: { origin: { type: 'STRING' }, date: { type: "STRING" } },
                    required: ['origin', 'date']
                  }
                },
                {
                  name: "set_traveler_profiles",
                  description: "Record individual traveler details including name, gender, and age.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      travelers: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            name: { type: "STRING" },
                            gender: { type: "STRING", enum: ["male", "female", "child"] },
                            age: { type: "NUMBER" }
                          },
                          required: ["name", "gender"]
                        }
                      }
                    },
                    required: ["travelers"]
                  }
                },
                {
                  name: "set_packing_requirements",
                  description: "Update specific requirements for the packing list (e.g. 'hiking gear', 'formal wear').",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      requirements: { type: "STRING" }
                    },
                    required: ["requirements"]
                  }
                }
              ]
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
          // Handle both string and Blob data
          let messageText: string;
          if (typeof event.data === 'string') {
            messageText = event.data;
          } else if (event.data instanceof Blob) {
            messageText = await event.data.text();
          } else {
            return;
          }

          const response = JSON.parse(messageText);
          console.log('Gemini WS Message:', response);

          if (response.setupComplete) {
            setupComplete = true;
            onStatusChange?.('connected');

            // Start streaming audio after setup
            source.connect(processor);

            // Connect processor to a silent gain node to fire onaudioprocess without audio feedback
            const silentGain = audioContext.createGain();
            silentGain.gain.value = 0;
            processor.connect(silentGain);
            silentGain.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
              if (ws.readyState === WebSocket.OPEN && setupComplete) {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = AudioProcessor.toPCM16(inputData);
                const base64Audio = AudioProcessor.arrayBufferToBase64(pcmData.buffer);

                ws.send(JSON.stringify({
                  realtimeInput: {
                    audio: {
                      mimeType: "audio/pcm;rate=16000",
                      data: base64Audio
                    }
                  }
                }));

                // Volume meter for UI
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                onVolumeChange?.(Math.sqrt(sum / inputData.length));
              }
            };
            return;
          }

          // Handle interruption
          if (response.serverContent?.interrupted) {
            console.log('Gemini Live: Interrupted by user speech');
            stopAllAudio();
          }

          // Handle Audio & Text responses
          if (response.serverContent) {
            const { modelTurn, userContent, inputTranscription, outputTranscription } = response.serverContent;

            // 1. Handle Model Audio Response (modelTurn)
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                if (part.inlineData?.data) {
                  playPCMAudio(part.inlineData.data);
                }
                // Note: Standard parts might also contain text if responseModalities=["TEXT"]
                if (part.text) {
                  onMessage?.(part.text);
                }
              }
            }

            // 2. Handle User Transcription (the words you just said)
            const inputTrans = inputTranscription || (response.serverContent as any).input_transcription;
            if (inputTrans) {
              console.log('Gemini Live User:', inputTrans.text);
              onUserMessage?.(inputTrans.text, inputTrans.isFinal);
            }

            // 3. Handle Model Transcription (the words AI is speaking)
            const outputTrans = outputTranscription || (response.serverContent as any).output_transcription;
            if (outputTrans) {
              console.log('Gemini Live AI:', outputTrans.text);
              onMessage?.(outputTrans.text);
            }
          }

          // Handle Function Call responses
          if (response.toolCall?.functionCalls) {
            for (const functionCall of response.toolCall.functionCalls) {
              const { name, args, id } = functionCall;
              if (name === 'update_itinerary' && args) {
                // Await the callback so we can catch errors and report them back to Gemini
                const processCall = async () => {
                  try {
                    await callbacksRef.current.onUpdateItinerary?.(args as any);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: true, message: `Updated Day ${args.day} with: ${args.activity}` }
                          }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    console.error('Voice assistant tool execution failed:', err);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: false, message: `Failed to update itinerary: ${err.message || 'Unknown error'}` }
                          }]
                        }
                      }));
                    }
                  }
                };
                processCall();
              } else if (name === 'remove_from_itinerary' && args) {
                const processRemove = async () => {
                  try {
                    await callbacksRef.current.onRemoveFromItinerary?.(args as any);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: true, message: `Removed "${args.activity}" from Day ${args.day}` }
                          }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: false, message: `Failed to remove: ${err.message}` }
                          }]
                        }
                      }));
                    }
                  }
                }
                processRemove();
              } else if (name === 'update_trip_details' && args) {
                const processUpdate = async () => {
                  try {
                    await callbacksRef.current.onUpdateTripDetails?.(args as any);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: true, message: `Updated trip parameters: ${Object.keys(args).join(', ')}` }
                          }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: false, message: `Failed to update details: ${err.message}` }
                          }]
                        }
                      }));
                    }
                  }
                }
                processUpdate();
              } else if (name === 'clear_day' && args) {
                const processClearDay = async () => {
                  try {
                    await callbacksRef.current.onClearDay?.(args as any);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{ id, name, response: { success: true, message: `Cleared activities for Day ${args.day}` } }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: { functionResponses: [{ id, name, response: { success: false, message: `Failed to clear: ${err.message}` } }] }
                      }));
                    }
                  }
                };
                processClearDay();
              } else if (name === 'clear_itinerary') {
                const processClearAll = async () => {
                  try {
                    await callbacksRef.current.onClearItinerary?.();
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{ id, name, response: { success: true, message: `Cleared entire itinerary successfully.` } }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: { functionResponses: [{ id, name, response: { success: false, message: `Failed to clear: ${err.message}` } }] }
                      }));
                    }
                  }
                };
                processClearAll();
              } else if (name === 'trigger_smart_itinerary_generation' && args) {
                const processSmart = async () => {
                  try {
                    await callbacksRef.current.onTriggerSmartItinerary?.((args as any).intensity);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{ id, name, response: { success: true, message: `Started smart generation with intensity: ${args.intensity}. Tell the user to wait a few seconds.` } }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{ id, name, response: { success: false, message: `Failed: ${err.message}` } }]
                        }
                      }));
                    }
                  }
                };
                processSmart();
              } else if (name === 'generate_itinerary' && args) {
                const processLaunch = async () => {
                  try {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: true, message: `Launching itinerary with mode: ${args.planningMode}` }
                          }]
                        }
                      }));
                    }
                    // Small delay to ensure the WS message is sent before state changes potentially unmount this component
                    await new Promise(r => setTimeout(r, 100));
                    await callbacksRef.current.onUpdateItinerary?.({ ...args, type: 'launch_itinerary' });
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: false, message: `Failed to launch: ${err.message}` }
                          }]
                        }
                      }));
                    }
                  }
                }
                processLaunch();
              } else if (name === 'searchGooglePlaces' && args) {
                const query = (args as any).query;
                // Use the standalone search helper
                searchPlacesAsync(query).then(results => {
                  if (results.length > 0) {
                    callbacksRef.current.onShowUICard?.(results[0]);
                  }
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      toolResponse: {
                        functionResponses: [{
                          id,
                          name,
                          response: { success: true, message: `Displayed card for ${results[0]?.title.en || query}` }
                        }]
                      }
                    }));
                  }
                }).catch(err => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      toolResponse: {
                        functionResponses: [{
                          id,
                          name,
                          response: { success: false, message: `Search failed: ${err.message}` }
                        }]
                      }
                    }));
                  }
                });
              } else if (name === 'searchFlights' && args) {
                const { origin, date } = args as any;
                callbacksRef.current.onShowUICard?.({
                  id: 'mock-flight-' + Date.now(),
                  title: { en: `Flight: ${origin} ✈️ Destination`, cs: `Let: ${origin} ✈️ Cíl` },
                  category: 'Transport',
                  duration: 240,
                  imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a615061c443?auto=format&fit=crop&q=80&w=800',
                });
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [{
                        id,
                        name,
                        response: { success: true, message: `Showed flights for ${origin}` }
                      }]
                    }
                  }));
                }
              } else if (name === 'set_traveler_profiles' && args) {
                const processProfiles = async () => {
                  try {
                    await callbacksRef.current.onUpdateTripDetails?.(args as any);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: true, message: `Updated ${args.travelers.length} traveler profiles.` }
                          }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: false, message: `Failed to update traveler profiles: ${err.message}` }
                          }]
                        }
                      }));
                    }
                  }
                };
                processProfiles();
              } else if (name === 'set_packing_requirements' && args) {
                const processPacking = async () => {
                  try {
                    await callbacksRef.current.onUpdateTripDetails?.({ packingRequirements: (args as any).requirements });
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: true, message: `Updated packing requirements.` }
                          }]
                        }
                      }));
                    }
                  } catch (err: any) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id,
                            name,
                            response: { success: false, message: `Failed to update packing requirements: ${err.message}` }
                          }]
                        }
                      }));
                    }
                  }
                };
                processPacking();
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
