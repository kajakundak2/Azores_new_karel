import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, POI, ParsedDay, Category, BilingualString } from '../utils/types';
import { geminiKeyManager } from '../utils/geminiKeyManager';
import { GoogleGenAI } from '@google/genai';
import { ensureBilingual, ensureBilingualAsync, translate, stripCodeFences } from '../utils/bilingualUtils';
import { applyItineraryUpdate } from '../utils/aiUpdateAgent';
import { parseItineraryDocument, generateItineraryFromScratch } from '../utils/itineraryParser';
import { toLocalIso } from '../useItineraryState';

interface UseItineraryAIProps {
  activeTrip: any;
  activeTripId: string | null;
  itinerary: Record<string, POI[]>;
  addPoi: (dayIso: string, poi: POI) => void;
  removePoi: (dayIso: string, poiId: string) => void;
  clearDay: (dayIso: string) => Promise<void>;
  clearItinerary: () => Promise<void>;
  getJsonContext: () => string;
  updateTrip: (id: string, data: any) => Promise<void>;
  lang: string;
  t: (key: string) => string;
  setNotification: (msg: string | null) => void;
  searchPlacesAsync: (query: string) => Promise<POI[]>;
}

export function useItineraryAI({
  activeTrip,
  activeTripId,
  itinerary,
  addPoi,
  removePoi,
  clearDay,
  clearItinerary,
  getJsonContext,
  updateTrip,
  lang,
  t,
  setNotification,
  searchPlacesAsync
}: UseItineraryAIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const modelRotationRef = useRef(0);
  const lastIntroTripId = useRef<string | null>(null);

  /**
   * Generates a rich context object for the AI models, 
   * including trip details, participants, and current itinerary state.
   */
  const generatePromptContext = useCallback(() => {
    if (!activeTrip) return "No active trip.";
    
    // Attempt to get context from hook
    const itinerarySummary = getJsonContext?.() || "{}";
    const referenceDocs = activeTrip.referenceDocs?.map((d: any) => `- ${d.name}: ${d.content.substring(0, 5000)}...`).join('\n') || "None";
    
    const travelerProfiles = activeTrip.travelerProfiles?.map((p: any) => `- ${p.name} (${p.gender}, ${p.age}y)`).join('\n') || "None";
    
    return `
=== IMPORTANT: MANUAL TRIP DETAILS (PRIORITY) ===
- TRIP TITLE: ${activeTrip.title || 'Mission'}
- DESTINATION: ${activeTrip.destination}
- DATES: ${activeTrip.startDate} to ${activeTrip.endDate} (ISO format)
- PARTICIPANTS: ${activeTrip.travelers} people (${activeTrip.adults || activeTrip.travelers} adults, ${activeTrip.kids || 0} kids)
${activeTrip.kidsAges ? `- KIDS AGES: ${activeTrip.kidsAges.join(', ')}` : ''}
${activeTrip.preferences ? `- PREFERENCES: ${activeTrip.preferences}` : ''}

=== TRAVELER PROFILES ===
${travelerProfiles}

=== REFERENCE DOCUMENTS UPLOADED ===
${referenceDocs}

=== CURRENT ITINERARY STATE (JSON) ===
${itinerarySummary}
================================================
`;
  }, [activeTrip, getJsonContext]);

  const handleSmartGeneration = useCallback(async (intensityValue: string = 'balanced', targetDayNumbers?: number[]) => {
    if (!activeTrip) return;
    
    const intensity = (['relaxed', 'balanced', 'packed'].includes(intensityValue) ? intensityValue : 'balanced') as 'relaxed' | 'balanced' | 'packed';
    const isPartial = targetDayNumbers && targetDayNumbers.length > 0;
    setNotification(isPartial ? `🤖 Regenerating Day(s) ${targetDayNumbers.join(', ')}...` : t('notification_planning'));
    setIsChatLoading(true);

    const onProgress = (msg: string) => {
      setNotification(msg);
      console.log('[SmartGen]', msg);
    };

    try {
      const hasReferenceDocs = activeTrip.referenceDocs && activeTrip.referenceDocs.length > 0;
      let parsedDays: ParsedDay[];

      const tripMetadataContext = `
TRAVELER DETAILS:
- Total: ${activeTrip.travelers} people
- Composition: ${activeTrip.adults || 0} adults, ${activeTrip.kids || 0} kids
- Kids Ages: ${activeTrip.kidsAges?.join(', ') || 'N/A'}
${activeTrip.travelerProfiles && activeTrip.travelerProfiles.length > 0 ? `
PARTICIPANT PROFILES:
${activeTrip.travelerProfiles.map((p: any) => `- ${p.name} (${p.gender}${p.age ? `, age ${p.age}` : ''})`).join('\n')}
` : ''}
${activeTrip.originalRequest ? `USER INITIAL REQUEST: ${activeTrip.originalRequest}` : ''}
`;

      if (hasReferenceDocs) {
        const fullDocText = activeTrip.referenceDocs!.map((d: any) => d.content).join('\n\n---\n\n');
        parsedDays = await parseItineraryDocument(
          fullDocText + '\n\n' + tripMetadataContext,
          activeTrip.destination,
          activeTrip.travelers,
          onProgress,
          targetDayNumbers
        );
      } else {
        parsedDays = await generateItineraryFromScratch(
          activeTrip.destination,
          activeTrip.startDate,
          activeTrip.endDate,
          activeTrip.travelers,
          intensity,
          tripMetadataContext,
          onProgress,
          targetDayNumbers
        );
      }

      if (parsedDays.length > 0) {
        onProgress(t('notification_searching'));

        let totalPois = 0;
        let enrichedCount = 0;
        const dest = activeTrip.destination || '';

        for (const day of parsedDays) {
          const startAt = new Date(activeTrip.startDate);
          startAt.setHours(0, 0, 0, 0);
          startAt.setDate(startAt.getDate() + (day.dayNumber - 1));
          const dayIso = toLocalIso(startAt);
          
          await clearDay(dayIso);

          onProgress(lang === 'cs'
            ? `Den ${day.dayNumber}: Hledám ${day.activities.length} míst na mapě...`
            : `Day ${day.dayNumber}: Looking up ${day.activities.length} places on map...`);

          for (const act of day.activities) {
            const skipLookup = act.category === 'Transport' || act.category === 'Special';
            let placeData: POI | null = null;
            if (!skipLookup) {
              try {
                const titleStr = typeof act.title === 'string' ? act.title : act.title.en;
                const searchQuery = `${titleStr} ${dest}`;
                const results = await searchPlacesAsync(searchQuery);
                if (results.length > 0) {
                  placeData = results[0];
                  enrichedCount++;
                }
              } catch (e) {
                console.warn(`Places lookup failed for "${act.title}":`, e);
              }
              await new Promise(r => setTimeout(r, 200));
            }

            // SPEED: Parser already returns bilingual {en, cs}. Use ensureBilingual (sync) instead of ensureBilingualAsync (API call)
            const bTitle = ensureBilingual(act.title);
            const bDesc = ensureBilingual(act.description);
            const bTips = act.practicalTips ? ensureBilingual(act.practicalTips) : null;

            const fullDescription: BilingualString = {
              en: bDesc.en + (bTips ? `\n\n💡 ${bTips.en}` : ''),
              cs: bDesc.cs + (bTips ? `\n\n💡 ${bTips.cs}` : '')
            };

            // Parse AI-extracted cost
            const aiCost = act.cost ? parseFloat(String(act.cost).replace(/[^0-9.,]/g, '').replace(',', '.')) || undefined : undefined;

            const newActivity: POI = {
              id: `smartgen-${day.dayNumber}-${totalPois}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              title: bTitle,
              description: fullDescription,
              category: (act.category as Category) || 'Sightseeing',
              duration: act.duration || 60,
              cost: aiCost !== undefined ? aiCost : undefined,
              priceInEuro: placeData?.priceInEuro || (act.cost ? String(act.cost) : undefined),
              startTime: act.startTime || undefined,
              address: placeData?.address || act.address || (typeof act.title === 'string' ? act.title : act.title.en),
              imageUrl: placeData?.imageUrl
                || (act.imageKeyword
                  ? `https://source.unsplash.com/800x600/?${encodeURIComponent(act.imageKeyword)}`
                  : `https://images.unsplash.com/photo-1596422846543-75c6fc197bf8?auto=format&fit=crop&w=800&q=80`),
              location: placeData?.location || (act.coords ? { lat: act.coords.lat, lng: act.coords.lng } : undefined),
              rating: placeData?.rating,
              reviewCount: placeData?.reviewCount,
              googleMapsUrl: placeData?.googleMapsUrl,
              images: placeData?.images,
            };
            addPoi(dayIso, newActivity);
            totalPois++;
          }

          if (day.dayNotes) {
            // SPEED: Use sync ensureBilingual — parser already returns bilingual
            addPoi(dayIso, {
              id: `daynotes-${day.dayNumber}-${Date.now()}`,
              title: { en: `📋 Day ${day.dayNumber} Tips`, cs: `📋 Tipy pro den ${day.dayNumber}` },
              description: ensureBilingual(day.dayNotes),
              category: 'Special' as Category,
              duration: 0,
            });
          }
        }

        const msgEn = `📝 Done! ${totalPois} activities across ${parsedDays.length} days (${enrichedCount} enriched from Google Maps).`;
        const msgCs = `📝 Hotovo! ${totalPois} aktivit vygenerováno pro ${parsedDays.length} dní (${enrichedCount} obohaceno z Google Maps).`;
        const bMsg = { en: msgEn, cs: msgCs };
        
        setNotification(lang === 'cs' ? msgCs : msgEn);
        setMessages(prev => [...prev, { role: 'model', text: bMsg }]);
      }
    } catch (err: any) {
      console.error('SmartGeneration error:', err);
      const errMsg = `❌ ${err.message || 'Generation failed.'}`;
      setNotification(errMsg);
      // SPEED: Hardcode bilingual error
      const bError: BilingualString = { en: errMsg, cs: `❌ ${err.message || 'Generování selhalo.'}` };
      setMessages(prev => [...prev, { role: 'model', text: bError }]);
    }
    setIsChatLoading(false);
  }, [activeTrip, lang, addPoi, setNotification, t, clearDay, searchPlacesAsync]);

  const handleItineraryUpdate = useCallback(async (request: string) => {
    if (!activeTrip || !activeTripId) return;
    setIsChatLoading(true);
    setNotification(lang === 'cs' ? '🤖 Sára upravuje itinerář...' : '🤖 Sára is adjusting the itinerary...');
    try {
      const { updatedItinerary, summary } = await applyItineraryUpdate(
        itinerary,
        request,
        activeTrip.destination,
        (msg) => setNotification(`🤖 ${msg}`)
      );
      await updateTrip(activeTripId, { itinerary: updatedItinerary });
      // SPEED: summary from applyItineraryUpdate is already bilingual
      const bMsg = ensureBilingual(summary);
      setMessages(prev => [...prev, { role: 'model', text: bMsg }]);
      setNotification(lang === 'cs' ? '✨ Itinerář aktualizován!' : '✨ Itinerary updated!');
    } catch (err: any) {
      console.error('Update error:', err);
      // SPEED: Hardcode bilingual error instead of translating
      const errMsg: BilingualString = { en: `❌ Failed to update itinerary: ${err.message}`, cs: `❌ Nepodařilo se aktualizovat itinerář: ${err.message}` };
      setMessages(prev => [...prev, { role: 'model', text: errMsg }]);
    }
    setIsChatLoading(false);
  }, [activeTrip, activeTripId, itinerary, lang, updateTrip, setNotification]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput;
    setChatInput('');
    // SPEED: Skip translation for user messages — display raw text as-is
    const userText: BilingualString = { en: userMsg, cs: userMsg };
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsChatLoading(true);

    let retryCount = 0;
    const maxRetries = 6;
    const chatModels = ['gemini-3.1-flash-lite-preview'];

    while (retryCount < maxRetries) {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) {
        setMessages(prev => [...prev, {
          role: 'model',
          text: { en: '⚠️ No Gemini API keys available.', cs: '⚠️ Nejsou k dispozici žádné klíče Gemini API.' },
        }]);
        setIsChatLoading(false);
        return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey });
        const dest = activeTrip?.destination || 'Unknown Destination';
        const tripTitle = activeTrip?.title || 'Trip';
        const activeModel = chatModels[(modelRotationRef.current + retryCount) % chatModels.length];
        const itineraryContext = generatePromptContext();
        
        const systemInstruction = `You are "Sára," an intelligent travel assistant helping with the trip "${tripTitle}" to ${dest}.
        
        ${itineraryContext}
        
        - CORE KNOWLEDGE: You have access to the full itinerary and ALL uploaded reference documents above. Use them!
        - VISUAL PRIORITY: Suggest visually stunning spots and viral viewpoints perfect for memories.
        - Always use searchGooglePlaces for real recommendations.
        - All costs in €.
        - SMART PLANNING: 
           - If the user asks for a WHOLE NEW trip, call trigger_smart_itinerary_generation.
           - If the user asks for COMPLEX CHANGES, call update_itinerary.
        
        RESPONSE FORMAT: You MUST respond in BOTH English and Czech in every reply.
        Format your reply as JSON: {"en": "your English reply", "cs": "your Czech reply"}
        ALWAYS respond in this JSON format. Never respond in plain text.`;

        const contents = messages
          .map(m => ({ 
            role: m.role === 'model' ? 'model' : 'user', 
            parts: [{ text: JSON.stringify(m.text) }] 
          }))
          .concat({ role: 'user', parts: [{ text: userMsg }] });

        const result = await ai.models.generateContent({
          model: activeModel,
          contents,
          // removed: responseMimeType — not forcing JSON to allow function calls
          config: {
            systemInstruction,
            tools: [{
              functionDeclarations: [
                {
                  name: 'searchGooglePlaces',
                  description: `Search for a real point of interest near ${dest}.`,
                  parameters: {
                    type: 'OBJECT',
                    properties: { query: { type: 'STRING' } },
                    required: ['query']
                  } as any
                },
                {
                  name: 'generateFullItinerary',
                  description: `Generate a full day itinerary for a specific day.`,
                  parameters: {
                    type: 'OBJECT',
                    properties: { 
                      dayDescription: { type: 'STRING' },
                      numPlaces: { type: 'NUMBER' }
                    },
                    required: ['dayDescription']
                  } as any
                },
                {
                  name: 'remove_from_itinerary',
                  description: `Remove a specific activity.`,
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      dayIso: { type: 'STRING' },
                      poiId: { type: 'STRING' }
                    },
                    required: ['dayIso', 'poiId']
                  } as any
                },
                {
                  name: 'trigger_smart_itinerary_generation',
                  description: 'Generate or Re-generate a complete detailed day-by-day itinerary.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      intensity: { type: 'STRING', enum: ['relaxed', 'balanced', 'packed'] },
                      dayNumbers: { type: 'ARRAY', items: { type: 'NUMBER' } }
                    }
                  } as any
                },
                {
                  name: 'clear_day',
                  description: 'Clear all activities from a specific day.',
                  parameters: {
                    type: 'OBJECT',
                    properties: { dayIso: { type: 'STRING' } },
                    required: ['dayIso']
                  } as any
                },
                {
                  name: 'update_itinerary',
                  description: 'Update or replan large portions.',
                  parameters: {
                    type: 'OBJECT',
                    properties: { request: { type: 'STRING' } },
                    required: ['request']
                  } as any
                },
                {
                  name: 'clear_itinerary',
                  description: 'Clear the entire itinerary for all days.',
                  parameters: { type: 'OBJECT', properties: {} }
                }
              ]
            }]
          }
        });

        if (result.functionCalls && result.functionCalls.length > 0) {
          const fc = result.functionCalls[0];
          let replyText: BilingualString = { en: 'Searching...', cs: 'Hledám...' };
          let uiCards: POI[] | undefined;

          if (fc.name === 'searchGooglePlaces') {
            const query = (fc.args as any).query;
            const places = await searchPlacesAsync(query);
            if (places.length > 0) {
              replyText = { en: `I found ${places.length} results:`, cs: `Našla jsem ${places.length} výsledků:` };
              uiCards = places.slice(0, 5);
            }
          } else if (fc.name === 'generateFullItinerary') {
            const desc = (fc.args as any).dayDescription;
            const num = (fc.args as any).numPlaces || 4;
            const places = await searchPlacesAsync(`${desc} in ${dest}`);
            if (places.length > 0) {
              replyText = { en: `Here's a ${desc} plan:`, cs: `Tady je plán pro ${desc}:` };
              uiCards = places.slice(0, num);
            }
          } else if (fc.name === 'remove_from_itinerary') {
            const { dayIso, poiId } = fc.args as any;
            removePoi(dayIso, poiId);
            replyText = { en: 'Removed.', cs: 'Odstraněno.' };
          } else if (fc.name === 'trigger_smart_itinerary_generation') {
            const intensity = (fc.args as any)?.intensity || 'balanced';
            const dayNumbers = (fc.args as any)?.dayNumbers as number[] | undefined;
            handleSmartGeneration(intensity, dayNumbers);
            return;
          } else if (fc.name === 'clear_day') {
            const { dayIso } = fc.args as any;
            await clearDay(dayIso);
            replyText = { en: 'Cleared.', cs: 'Vyčištěno.' };
          } else if (fc.name === 'clear_itinerary') {
            await clearItinerary();
            replyText = { en: 'The entire itinerary has been cleared.', cs: 'Celý itinerář byl vymazán.' };
          } else if (fc.name === 'update_itinerary') {
            const { request } = fc.args as any;
            handleItineraryUpdate(request);
            return;
          }

          // SPEED: No translation call needed — hardcoded bilingual responses
          setMessages(prev => [...prev, { role: 'model', text: replyText, uiCards }]);
        } else {
          // SPEED: Parse bilingual JSON from model instead of translating
          const rawReply = result.text ?? '{"en": "How can I help?", "cs": "Jak vám mohu pomoci?"}';
          let bilingualReply: BilingualString;
          try {
            const cleaned = stripCodeFences(rawReply);
            const parsed = JSON.parse(cleaned);
            if (parsed.en && parsed.cs) {
              bilingualReply = parsed as BilingualString;
            } else {
              bilingualReply = { en: rawReply, cs: rawReply };
            }
          } catch {
            // Model didn't return JSON — use raw text for both languages
            bilingualReply = { en: rawReply, cs: rawReply };
          }
          setMessages(prev => [...prev, { role: 'model', text: bilingualReply }]);
        }
        
        modelRotationRef.current = (modelRotationRef.current + 1) % chatModels.length;
        break; 

      } catch (err: any) {
        console.error('AI Error:', err);
        if ((err.message?.includes('429') || err.message?.includes('503')) && retryCount < maxRetries - 1) {
          geminiKeyManager.markKeyFailed(apiKey, true, 60); 
          retryCount++;
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, retryCount)));
          continue; 
        }
        // SPEED: Hardcode bilingual error
        const errorMsg: BilingualString = { en: `❌ Error: ${err.message || 'Error.'}`, cs: `❌ Chyba: ${err.message || 'Chyba.'}` };
        setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
        break;
      }
    }
    setIsChatLoading(false);
  }, [chatInput, isChatLoading, messages, lang, activeTrip, generatePromptContext, handleSmartGeneration, handleItineraryUpdate, clearDay, removePoi, searchPlacesAsync]);

  const handleFileUpload = async (file: File, addReferenceDoc: any) => {
    if (!activeTripId) return;
    try {
      const { name, content } = await file.text().then(txt => ({ name: file.name, content: txt }));
      await addReferenceDoc({ name, content });
      setNotification(lang === 'cs' ? `Dokument ${file.name} nahrán!` : `Uploaded ${file.name}!`);
      setMessages(prev => [...prev, 
        { role: 'user', text: { en: `[System: User uploaded ${file.name}]`, cs: `[Systém: Nahrán ${file.name}]` } },
        { role: 'model', text: { en: `Received "${file.name}".`, cs: `Přijala jsem "${file.name}".` } }
      ]);
    } catch (err) {
      console.error(err);
      setNotification("Failed to read file.");
    }
  };

  // Persistence Logic: Save messages to Firestore when they change
  useEffect(() => {
    if (!activeTripId || !activeTrip || messages.length === 0) return;
    
    // Only save if history actually changed to avoid infinite loops or redundant writes
    const prevHistory = activeTrip.chatHistory || [];
    if (JSON.stringify(prevHistory) === JSON.stringify(messages)) return;

    const timer = setTimeout(() => {
      updateTrip(activeTripId, { chatHistory: messages });
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [messages, activeTripId, activeTrip, updateTrip]);

  // Sync Logic: Load messages when switching trips
  useEffect(() => {
    if (!activeTripId) {
      lastIntroTripId.current = null;
      return;
    }

    if (activeTripId && activeTrip) {
      if (lastIntroTripId.current === activeTripId) return;
      lastIntroTripId.current = activeTripId;
      
      if (activeTrip.chatHistory && activeTrip.chatHistory.length > 0) {
        setMessages(activeTrip.chatHistory.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          text: m.text,
          uiCards: m.uiCards
        })));
      } else {
        setMessages([{ role: 'model', text: { en: `Welcome to ${activeTrip.destination}!`, cs: `Vítejte v destinaci ${activeTrip.destination}!` } }]);
      }
    }
  }, [activeTripId, activeTrip]);

  return {
    messages,
    setMessages,
    chatInput,
    setChatInput,
    isChatLoading,
    handleSendMessage,
    handleSmartGeneration,
    handleItineraryUpdate,
    handleFileUpload,
    generatePromptContext
  };
}
