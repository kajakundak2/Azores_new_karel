import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, POI, ParsedDay, Category, BilingualString } from '../utils/types';
import { geminiKeyManager } from '../utils/geminiKeyManager';
import { GoogleGenAI } from '@google/genai';
import { ensureBilingual, ensureBilingualAsync, translate, stripCodeFences } from '../utils/bilingualUtils';
import { applyItineraryUpdate } from '../utils/aiUpdateAgent';
import { parseItineraryDocument, generateItineraryFromScratch } from '../utils/itineraryParser';
import { toLocalIso, getFullTripContext, parseDateString } from '../useItineraryState';
import { getToolDeclarations, SARA_CAPABILITIES_PROMPT, SARA_IDENTITY_PROMPT } from '../utils/saraTools';

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
  // New atomic mutation functions
  movePoi?: (from: string, to: string, id: string) => Promise<void>;
  modifyPoi?: (day: string, id: string, changes: Partial<POI>) => Promise<void>;
  reorderPois?: (day: string, ids: string[]) => Promise<void>;
  addStay?: (stay: any) => Promise<void>;
  removeStay?: (id: string) => Promise<void>;
  modifyStay?: (id: string, changes: any) => Promise<void>;
  addFlight?: (flight: any) => Promise<void>;
  removeFlight?: (id: string) => Promise<void>;
  addDay?: () => Promise<void>;
  removeDay?: (dayIso: string) => Promise<void>;
  setDayTheme?: (dayIso: string, theme: string) => Promise<void>;
  addToLibrary?: (poi: POI) => Promise<void>;
  removeFromLibrary?: (id: string) => Promise<void>;
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
  searchPlacesAsync,
  movePoi,
  modifyPoi,
  reorderPois,
  addStay,
  removeStay,
  modifyStay,
  addFlight,
  removeFlight,
  addDay,
  removeDay,
  setDayTheme,
  addToLibrary,
  removeFromLibrary
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
    return getFullTripContext(activeTrip, itinerary) + '\n' + SARA_CAPABILITIES_PROMPT;
  }, [activeTrip, itinerary]);

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

  // Unified tool call handler for both text chat and voice chat
  const handleToolCall = useCallback(async (name: string, args: any) => {
    if (!activeTrip) throw new Error("No active trip");
    
    let replyText: BilingualString = { en: 'Executing...', cs: 'Provádím...' };
    let uiCards: POI[] | undefined;
    
    const dayNumToIso = (dayNum: number) => {
      const d = parseDateString(activeTrip.startDate);
      d.setDate(d.getDate() + (dayNum - 1));
      return toLocalIso(d);
    };

    if (name === 'searchGooglePlaces') {
      const places = await searchPlacesAsync(args.query);
      if (places.length > 0) {
        replyText = { en: `I found ${places.length} results:`, cs: `Našla jsem ${places.length} výsledků:` };
        uiCards = places.slice(0, 5);
      } else {
        replyText = { en: `No results found for ${args.query}.`, cs: `Žádné výsledky pro ${args.query}.` };
      }
    } else if (name === 'remove_from_itinerary') {
      const dayIso = dayNumToIso(args.day);
      const dayPois = itinerary[dayIso] || [];
      const target = dayPois.find(p => (typeof p.title === 'string' ? p.title : p.title.en).toLowerCase().includes(args.activity.toLowerCase()));
      if (target) removePoi(dayIso, target.id);
      replyText = { en: 'Removed.', cs: 'Odstraněno.' };
    } else if (name === 'trigger_smart_itinerary_generation') {
      handleSmartGeneration(args.intensity || 'balanced', args.dayNumbers);
      replyText = { en: 'Smart generation started.', cs: 'Chytré generování spuštěno.' };
    } else if (name === 'clear_day') {
      await clearDay(dayNumToIso(args.day));
      replyText = { en: `Day ${args.day} cleared.`, cs: `Den ${args.day} vyčištěn.` };
    } else if (name === 'clear_itinerary') {
      await clearItinerary();
      replyText = { en: 'The entire itinerary has been cleared.', cs: 'Celý itinerář byl vymazán.' };
    } else if (name === 'update_itinerary') {
      // NOTE: handleItineraryUpdate modifies state asynchronously and takes text input
      // It's used when the tool itself wants the agent to run the AI bulk update
      if (args.request) {
         handleItineraryUpdate(args.request);
      }
      replyText = { en: 'Bulk update applied.', cs: 'Hromadná aktualizace použita.' };
    } else if (name === 'update_trip_details') {
      if (activeTripId) { const { ...details } = args; await updateTrip(activeTripId, details); }
      replyText = { en: 'Trip details updated.', cs: 'Detaily výletu aktualizovány.' };
    } else if (name === 'modify_poi') {
      const dayIso = dayNumToIso(args.day);
      const dayPois = itinerary[dayIso] || [];
      const target = dayPois.find(p => (typeof p.title === 'string' ? p.title : p.title.en).toLowerCase().includes(args.poiTitle.toLowerCase()));
      if (target && modifyPoi) await modifyPoi(dayIso, target.id, args.changes || {});
      replyText = { en: `Updated "${args.poiTitle}".`, cs: `Upraveno "${args.poiTitle}".` };
    } else if (name === 'move_poi') {
      const fromIso = dayNumToIso(args.fromDay);
      const toIso = dayNumToIso(args.toDay);
      const dayPois = itinerary[fromIso] || [];
      const target = dayPois.find(p => (typeof p.title === 'string' ? p.title : p.title.en).toLowerCase().includes(args.poiTitle.toLowerCase()));
      if (target && movePoi) await movePoi(fromIso, toIso, target.id);
      replyText = { en: `Moved to Day ${args.toDay}.`, cs: `Přesunuto na den ${args.toDay}.` };
    } else if (name === 'reorder_day') {
      const dayIso = dayNumToIso(args.day);
      const dayPois = itinerary[dayIso] || [];
      const orderedIds = (args.orderedTitles || []).map((t: string) => {
        const p = dayPois.find(p => (typeof p.title === 'string' ? p.title : p.title.en).toLowerCase().includes(t.toLowerCase()));
        return p?.id;
      }).filter(Boolean);
      if (reorderPois) await reorderPois(dayIso, orderedIds);
      replyText = { en: `Day ${args.day} reordered.`, cs: `Den ${args.day} přeuspořádán.` };
    } else if (name === 'add_stay') {
      if (addStay) await addStay(args);
      replyText = { en: `Added stay: ${args.name}.`, cs: `Přidáno ubytování: ${args.name}.` };
    } else if (name === 'remove_stay') {
      const stays = activeTrip.logistics?.stays || [];
      const s = stays.find((s: any) => s.name.toLowerCase().includes(args.stayName.toLowerCase()));
      if (s && removeStay) await removeStay(s.id);
      replyText = { en: 'Stay removed.', cs: 'Ubytování odstraněno.' };
    } else if (name === 'modify_stay') {
      const stays = activeTrip.logistics?.stays || [];
      const s = stays.find((s: any) => s.name.toLowerCase().includes(args.stayName.toLowerCase()));
      if (s && modifyStay) await modifyStay(s.id, args.changes || {});
      replyText = { en: 'Stay updated.', cs: 'Ubytování aktualizováno.' };
    } else if (name === 'add_flight') {
      if (addFlight) await addFlight(args);
      replyText = { en: `Flight added: ${args.departureAirport} → ${args.arrivalAirport}.`, cs: `Let přidán: ${args.departureAirport} → ${args.arrivalAirport}.` };
    } else if (name === 'remove_flight') {
      const flights = activeTrip.logistics?.flights || [];
      const f = flights.find((f: any) => f.direction === args.direction && (!args.airline || f.airline.toLowerCase().includes(args.airline.toLowerCase())));
      if (f && removeFlight) await removeFlight(f.id);
      replyText = { en: 'Flight removed.', cs: 'Let odstraněn.' };
    } else if (name === 'add_day') {
      if (addDay) await addDay();
      replyText = { en: 'Added one more day to the trip!', cs: 'Přidán další den výletu!' };
    } else if (name === 'remove_day') {
      if (removeDay) await removeDay(dayNumToIso(args.day));
      replyText = { en: `Day ${args.day} removed.`, cs: `Den ${args.day} odstraněn.` };
    } else if (name === 'set_day_theme') {
      if (setDayTheme) await setDayTheme(dayNumToIso(args.day), args.theme);
      replyText = { en: `Day ${args.day} theme: "${args.theme}".`, cs: `Téma dne ${args.day}: "${args.theme}".` };
    } else if (name === 'add_to_library') {
      const places = await searchPlacesAsync(args.query);
      if (places.length > 0 && addToLibrary) { await addToLibrary(places[0]); uiCards = [places[0]]; }
      replyText = { en: 'Saved to library.', cs: 'Uloženo do knihovny.' };
    } else if (name === 'remove_from_library') {
      const lib = activeTrip.libraryPois || [];
      const item = lib.find((p: any) => (typeof p.title === 'string' ? p.title : p.title.en).toLowerCase().includes(args.title.toLowerCase()));
      if (item && removeFromLibrary) await removeFromLibrary(item.id);
      replyText = { en: 'Removed from library.', cs: 'Odstraněno z knihovny.' };
    } else if (name === 'set_traveler_profiles') {
      if (activeTripId) {
        const profiles = (args.travelers || []).map((t: any, i: number) => ({ ...t, id: `tp-${i}-${Date.now()}` }));
        await updateTrip(activeTripId, { travelerProfiles: profiles, travelers: profiles.length });
      }
      replyText = { en: `Updated ${args.travelers?.length || 0} traveler profiles.`, cs: `Aktualizováno ${args.travelers?.length || 0} profilů cestujících.` };
    } else if (name === 'set_packing_requirements') {
      if (activeTripId) await updateTrip(activeTripId, { 'logistics.packingRequirements': args.requirements });
      replyText = { en: 'Packing requirements updated.', cs: 'Požadavky na balení aktualizovány.' };
    }
    
    return { message: replyText.en, replyText, uiCards };
  }, [
    activeTrip, activeTripId, itinerary, searchPlacesAsync, removePoi, handleSmartGeneration, clearDay, clearItinerary, updateTrip, modifyPoi, movePoi, reorderPois, addStay, removeStay, modifyStay, addFlight, removeFlight, addDay, removeDay, setDayTheme, addToLibrary, removeFromLibrary
  ]);

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
        
        const systemInstruction = `${SARA_IDENTITY_PROMPT}

You are helping with the trip "${tripTitle}" to ${dest}.

${itineraryContext}

All costs in €. Use searchGooglePlaces for real recommendations.
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
          config: {
            systemInstruction,
            tools: [{
              functionDeclarations: getToolDeclarations(dest) as any
            }]
          }
        });

        if (result.functionCalls && result.functionCalls.length > 0) {
          const fc = result.functionCalls[0];
          const args = (fc.args || {}) as any;
          const { replyText, uiCards } = await handleToolCall(fc.name, args);

          setMessages(prev => [...prev, { role: 'model', text: replyText, uiCards }]);
        } else {
          const rawReply = result.text ?? '{"en": "How can I help?", "cs": "Jak vám mohu pomoci?"}';
          let bilingualReply: BilingualString;
          try {
            const cleaned = stripCodeFences(rawReply);
            const parsed = JSON.parse(cleaned);
            bilingualReply = (parsed.en && parsed.cs) ? parsed as BilingualString : { en: rawReply, cs: rawReply };
          } catch {
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
    handleToolCall,
    generatePromptContext
  };
}
