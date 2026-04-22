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
  onReadyToLaunch?: () => void;
}

export function usePlannerChat({ onDataExtracted, onReadyToLaunch }: UsePlannerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractedParams, setExtractedParams] = useState<TripParams>({
    stays: [],
    previewDays: {}
  });

  const sendMessage = useCallback(async (text: string) => {
    setLoading(true);
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);

    let retryCount = 0;
    const maxRetries = 3;

    const executeGeneration = async (): Promise<boolean> => {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) {
        setMessages(prev => [...prev, { role: 'model', text: "No API keys available. Please check your configuration." }]);
        return true;
      }

      try {
        const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `You are "Sára," the intelligent travel planning assistant.
      
      YOUR GOAL:
      Help the traveler define their trip parameters. Guide them through necessary and optional questions with a friendly, conversational tone.
      
      TRIP LOGISTICS:
      - Mandatory Fields: Destination, Start Date, End Date, and Traveler Group (Adults, Kids, Kids' Ages).
      - If they have kids, ask for their ages to customize the suggestions.
      - We track accommodations ("Stays"). If they have a stay booked, ask for the name and dates.
      - Helpful Advice: If they stay longer than a week, suggest if they want to plan activities in different geographic clusters to minimize driving time.
      
      CORE TOOLS:
      1. Use "set_trip_details" for basic params (Destination, Dates, Travelers, Prefs).
      2. Use "add_stay" when they mention where they are staying.
      3. Use "propose_day_plan" to suggest a thematic bundle for a specific day (e.g. "Beach & Sun").
      4. Use "set_traveler_profiles" when the user tells you who is traveling (names, genders, ages). This updates the packing list — each person gets a personalized AI-generated packing list based on their gender.
      5. Once everything is set, ask "Ready to create your itinerary?" and call "launch_expedition" if they agree.
      
      PACKING LIST: When the user says who is traveling with them (e.g. "I'm going with my wife Monika and daughter Natalka"), always call "set_traveler_profiles" immediately with all travelers' details so their personalized packing lists can be generated.
      
      TONE: Friendly, collaborative, and helpful. Address the user naturally by their name if provided, or simply as a fellow traveler.`;

      const contents = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: "set_trip_details",
                description: "Update primary expedition parameters.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    destination: { type: "STRING" },
                    startDate: { type: "STRING", description: "YYYY-MM-DD" },
                    endDate: { type: "STRING", description: "YYYY-MM-DD" },
                    adults: { type: "NUMBER" },
                    kids: { type: "NUMBER" },
                    kidsAges: { type: "ARRAY", items: { type: "NUMBER" }, description: "Age of each child in the group" },
                    preferences: { type: "STRING", description: "Interests like 'hiking', 'food', 'relaxing'." }
                  }
                } as any
              },
              {
                name: "add_stay",
                description: "Record an accommodation/base camp.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING", description: "Hotel name or 'AirBnB' or Booking.com" },
                    address: { type: "STRING" },
                    checkIn: { type: "STRING", description: "YYYY-MM-DD" },
                    checkOut: { type: "STRING", description: "YYYY-MM-DD" }
                  },
                  required: ["name", "checkIn", "checkOut"]
                } as any
              },
              {
                name: "propose_day_plan",
                description: "Propose a thematic itinerary for a specific day to show as a preview.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    dayNumber: { type: "NUMBER" },
                    theme: { type: "STRING" },
                    activities: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          title: { type: "STRING" },
                          category: { type: "STRING", enum: ["Sightseeing", "Food", "Activity", "Transport", "Special", "Event"] }
                        }
                      }
                    }
                  }
                } as any
              },
              {
                name: "set_traveler_profiles",
                description: "Record individual traveler details including name, gender, and age. Call when the user shares who is traveling.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    travelers: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          name: { type: "STRING", description: "Traveler name" },
                          gender: { type: "STRING", enum: ["male", "female", "child"], description: "Gender or child" },
                          age: { type: "NUMBER", description: "Optional age" }
                        },
                        required: ["name", "gender"]
                      }
                    }
                  },
                  required: ["travelers"]
                } as any
              },
              {
                name: "set_packing_requirements",
                description: "Update specific requirements for the packing list (e.g. 'extra warm clothes for hiking', 'formal wear for dinner').",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    requirements: { type: "STRING" }
                  },
                  required: ["requirements"]
                } as any
              },
              {
                name: "launch_expedition",
                description: "Confirm mission readiness and finalize creation.",
                parameters: { type: "OBJECT", properties: {} } as any
              }
            ]
          }]
        }
      });

      let modelText = result.text || "Updating your trip details...";

      if (result.functionCalls && result.functionCalls.length > 0) {
        let updatedParams = { ...extractedParams };

        for (const fc of result.functionCalls) {
          if (fc.name === 'set_trip_details') {
            updatedParams = { ...updatedParams, ...fc.args };
          }
          if (fc.name === 'add_stay') {
            const newStay = { id: 'stay-' + Date.now(), ...fc.args };
            updatedParams.stays = [...(updatedParams.stays || []), newStay];
          }
          if (fc.name === 'propose_day_plan') {
            const { dayNumber, theme, activities } = fc.args as any;
            updatedParams.previewDays = {
              ...(updatedParams.previewDays || {}),
              [`day-${dayNumber}`]: { theme, activities }
            };
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
          if (fc.name === 'set_packing_requirements') {
            updatedParams.packingRequirements = (fc.args as any).requirements;
          }
          if (fc.name === 'launch_expedition') {
            onReadyToLaunch?.();
          }
        }

        setExtractedParams(updatedParams);
        onDataExtracted?.(updatedParams);

        if (!result.text) {
          modelText = "Trip updated! We've got " +
            (updatedParams.destination ? `the destination for ${updatedParams.destination} ` : "") +
            (updatedParams.stays?.length ? `and ${updatedParams.stays.length} stay(s) recorded. ` : "but no stays yet. ") +
            "What should we plan next?";
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: modelText }]);
      return true;
    } catch (err: any) {
        const isRateLimit = err?.message?.includes('429') || err?.status === 429;
        geminiKeyManager.markKeyFailed(apiKey, isRateLimit);

        if (isRateLimit && retryCount < maxRetries) {
          retryCount++;
          console.warn(`usePlannerChat: Rate limited. Retrying with next key (attempt ${retryCount}/${maxRetries})...`);
          return await executeGeneration();
        }

        console.error('Planner Chat Error:', err);
        setMessages(prev => [...prev, { role: 'model', text: "I'm having a little trouble connecting. Could you try that again?" }]);
        return true;
      }
    };

    await executeGeneration();
    setLoading(false);
  }, [messages, extractedParams, onDataExtracted, onReadyToLaunch]);

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
