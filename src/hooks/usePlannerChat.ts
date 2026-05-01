import { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from '../utils/geminiKeyManager';
import type { TravelerProfile } from '../data';

export interface TripParams {
  destination?: string;
  startDate?: string;
  endDate?: string;
  adults?: number;
  kids?: number;
  kidsAges?: number[];
  preferences?: string;
  stays?: any[];
  previewDays?: Record<string, { theme: string; activities: any[] }>;
  travelerProfiles?: TravelerProfile[];
  packingRequirements?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface UsePlannerChatProps {
  onDataExtracted?: (params: TripParams) => void;
  onReadyToLaunch?: (mode?: 'full' | 'suggestions_only', intensity?: string) => void;
  systemInstruction: string;
}

export function usePlannerChat({ onDataExtracted, onReadyToLaunch, systemInstruction: baseSystemInstruction }: UsePlannerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractedParams, setExtractedParams] = useState<TripParams>({
    stays: [],
    previewDays: {},
    adults: 1,
    kids: 0,
    kidsAges: []
  });

  const sendMessage = useCallback(async (text: string) => {
    setLoading(true);
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);

    let retryCount = 0;
    const maxRetries = 3;

    const executeGeneration = async (): Promise<boolean> => {
      let retryCount = 0;
      const maxRetries = 6;
      let success = false;
      
      // Models to try in order of complexity/quota
      const modelStack = [
        'gemini-3.1-flash-lite-preview'
      ];

      while (!success && retryCount < maxRetries) {
        const apiKey = geminiKeyManager.getNextKey();
        const modelToUse = modelStack[Math.min(retryCount, modelStack.length - 1)];

        if (!apiKey) {
          setMessages(prev => [...prev, { role: 'model', text: "No API keys available. Please check your configuration." }]);
          return true;
        }

        try {
          const ai = new GoogleGenAI({ apiKey });
          
          // Enrich system instruction with trip context if provided
          const finalSystemInstruction = `${baseSystemInstruction || 'You are "Sára," an intelligent travel assistant.'}
          
${baseSystemInstruction ? '' : `YOUR GOAL:
Help the traveler define their trip parameters. Guide them through necessary and optional questions with a friendly, conversational tone.

TRIP LOGISTICS:
- Mandatory Fields: Destination, Start Date, End Date, and Traveler Group (Adults, Kids, Kids' Ages).
- If they have kids, ask for their ages to customize the suggestions.
- We track accommodations ("Stays"). If they have a stay booked, ask for the name and dates.

CORE TOOLS:
1. Use "set_trip_details" for basic params.
2. Use "add_stay" when they mention where they are staying.
3. Use "set_traveler_profiles" when the user tells you who is traveling (names, genders, ages).
4. Once everything is set, ask "Ready to create your itinerary?" and call "launch_expedition" if they agree.`}

TONE: Friendly, collaborative, and helpful.`;

          const contents = newMessages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          }));

          const result = await ai.models.generateContent({
            model: modelToUse,
            contents,
            config: {
              systemInstruction: finalSystemInstruction,
              tools: [{
                functionDeclarations: [
                  {
                    name: "update_trip_details",
                    description: "Update primary expedition parameters.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        destination: { type: "STRING" },
                        startDate: { type: "STRING", description: "YYYY-MM-DD" },
                        endDate: { type: "STRING", description: "YYYY-MM-DD" },
                        adults: { type: "NUMBER" },
                        kids: { type: "NUMBER" },
                        kidsAges: { type: "ARRAY", items: { type: "NUMBER" } },
                        preferences: { type: "STRING" }
                      }
                    } as any
                  },
                  {
                    name: "add_stay",
                    description: "Record an accommodation.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        address: { type: "STRING" },
                        checkIn: { type: "STRING" },
                        checkOut: { type: "STRING" }
                      },
                      required: ["name", "checkIn", "checkOut"]
                    } as any
                  },
                  {
                    name: "set_traveler_profiles",
                    description: "Record individual traveler details.",
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
                    } as any
                  },
                  {
                    name: "trigger_smart_itinerary_generation",
                    description: "Finalize parameters and trigger full itinerary generation.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        intensity: { type: "STRING", enum: ["relaxed", "balanced", "packed"], description: "The pace of the trip." },
                        dayNumbers: { type: "ARRAY", items: { type: "NUMBER" }, description: "Specific day numbers to regenerate (1-based). Leave empty for full trip." }
                      }
                    } as any
                  },
                  {
                    name: "generate_itinerary",
                    description: "Alias for trigger_smart_itinerary_generation.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        planningMode: { type: "STRING", enum: ["full", "suggestions_only"], description: "The choice: 'full' (day-by-day) or 'suggestions_only' (POIs only)." }
                      }
                    } as any
                  }
                ]
              }]
            }
          });

          let modelText = result.text || "Updating your trip details...";

          if (result.functionCalls && result.functionCalls.length > 0) {
            let updatedParams = { ...extractedParams };

            for (const fc of result.functionCalls) {
              if (fc.name === 'update_trip_details' || fc.name === 'set_trip_details') {
                updatedParams = { ...updatedParams, ...fc.args };
              }
              if (fc.name === 'add_stay') {
                const newStay = { id: 'stay-' + Date.now(), ...fc.args };
                updatedParams.stays = [...(updatedParams.stays || []), newStay];
              }
              if (fc.name === 'set_traveler_profiles') {
                const profiles = ((fc.args as any).travelers || []).map((t: any, i: number) => ({
                  id: `traveler-${Date.now()}-${i}`,
                  name: t.name,
                  gender: t.gender,
                  age: t.age
                }));
                updatedParams.travelerProfiles = profiles;
              }
              if (fc.name === 'trigger_smart_itinerary_generation' || fc.name === 'generate_itinerary' || fc.name === 'launch_expedition') {
                const args = fc.args as any;
                onReadyToLaunch?.(args?.planningMode || 'full', args?.intensity);
              }
            }

            setExtractedParams(updatedParams);
            onDataExtracted?.(updatedParams);

            if (!result.text) {
              modelText = "Trip updated! What should we plan next?";
            }
          }

          setMessages(prev => [...prev, { role: 'model', text: modelText }]);
          success = true;
          return true;
        } catch (err: any) {
          const isRateLimit = err?.message?.includes('429') || err?.status === 429;
          console.warn(`Planner Chat Error (Model: ${modelToUse}, Key: ${apiKey.substring(0, 5)}...):`, err.message);

          if (isRateLimit || err.message?.includes('503')) {
            geminiKeyManager.markKeyFailed(apiKey, true, 60);
            retryCount++;
            if (retryCount < maxRetries) {
              // Switch model and retry immediately with next key
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
          } else if (err.message?.includes('429')) {
            geminiKeyManager.markKeyFailed(apiKey, true, 60);
            retryCount++;
            continue;
          } else {
            geminiKeyManager.markKeyFailed(apiKey, false);
            retryCount++;
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: "I'm having a little trouble connecting. Could you try that again in a moment? (Rate limit reached)" }]);
      return false;
    };

    await executeGeneration();
    setLoading(false);
  }, [messages, extractedParams, onDataExtracted, onReadyToLaunch, baseSystemInstruction]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setExtractedParams({});
  }, []);

  /** Summarize the conversation for injecting into the Trip object */
  const getConversationSummary = useCallback(() => {
    if (messages.length === 0) return '';
    return messages.map(m => `${m.role === 'user' ? 'User' : 'Sára'}: ${m.text}`).join('\n');
  }, [messages]);

  /** Get the original user request (first user message) */
  const getOriginalRequest = useCallback(() => {
    const first = messages.find(m => m.role === 'user');
    return first?.text || '';
  }, [messages]);

  return {
    messages,
    setMessages,
    loading,
    extractedParams,
    sendMessage,
    resetChat,
    getConversationSummary,
    getOriginalRequest
  };
}
