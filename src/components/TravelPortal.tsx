import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { APIProvider } from '@vis.gl/react-google-maps';

import { POI, Category, TEXTS } from '../data';
import { toLocalIso, syncStaysToItinerary } from '../useItineraryState';
import { useItineraryAI } from '../hooks/useItineraryAI';
import { useLiveGemini } from '../hooks/useLiveGemini';
import { usePlacesSearch, searchPlacesAsync } from '../hooks/usePlacesSearch';
import { useSaraState } from '../hooks/useCharacterState';
import { ensureBilingualAsync } from '../utils/bilingualUtils';
import { createT } from '../utils/i18n';

import { TopBar } from './TopBar';
import { AssistantPanel } from './AssistantPanel';
import { ItineraryPanel } from './ItineraryPanel';
import { LibraryPanel } from './LibraryPanel';
import { MapActions } from './MapActions';
import GoogleMapView from './GoogleMapView';
import { PoiDetailModal } from './PoiDetailModal';
import { PackingChecklist } from './characters/PackingChecklist';
import { StaysManager } from './StaysManager';

interface TravelPortalProps {
  trips: any[];
  activeTripId: string;
  activeTrip: any;
  itinerary: Record<string, POI[]>;
  days: Date[];
  addPoi: (dayIso: string, poi: POI) => void;
  removePoi: (dayIso: string, poiId: string) => void;
  clearDay: (dayIso: string) => Promise<void>;
  clearItinerary: () => Promise<void>;
  updateTrip: (id: string, data: any) => Promise<void>;
  setActiveTripId: (id: string | null) => void;
  updatePoiTransportMode: (dayIso: string, poiId: string, mode: any) => void;
  updatePoi: (poi: POI) => Promise<void>;
  addReferenceDoc: (doc: any) => Promise<void>;
  lang: string;
  setLang: (lang: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const TravelPortal: React.FC<TravelPortalProps> = ({
  trips,
  activeTripId,
  activeTrip,
  itinerary,
  days,
  addPoi,
  removePoi,
  clearDay,
  clearItinerary,
  updateTrip,
  setActiveTripId,
  updatePoiTransportMode,
  updatePoi,
  addReferenceDoc,
  lang,
  setLang,
  theme,
  setTheme
}) => {
  const [notification, setNotification] = useState<string | null>(null);
  const [currency, setCurrency] = useState('EUR');
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1, CZK: 25.0, USD: 1.08 });
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [showAllDays, setShowAllDays] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [remoteVoiceVolume, setRemoteVoiceVolume] = useState(0);
  const [showPackingChecklist, setShowPackingChecklist] = useState(false);
  const [showStaysManager, setShowStaysManager] = useState(false);
  const [packingComplete, setPackingComplete] = useState(false);
  const [atlasQuery, setAtlasQuery] = useState('');
  const [searchInBounds, setSearchInBounds] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<POI | null>(null);
  const [isListening, setIsListening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const t = createT(lang);
  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const { isSearching: isAtlasSearching, error: atlasSearchError, searchPlaces: doAtlasSearch, clearResults: clearAtlasResults, results: atlasSearchResults } = usePlacesSearch();

  const {
    messages,
    setMessages,
    chatInput,
    setChatInput,
    isChatLoading,
    handleSendMessage,
    handleSmartGeneration,
    handleFileUpload,
    generatePromptContext
  } = useItineraryAI({
    activeTrip,
    activeTripId,
    itinerary,
    addPoi,
    removePoi,
    clearDay,
    clearItinerary,
    getJsonContext: () => JSON.stringify(itinerary),
    updateTrip,
    lang,
    t,
    setNotification,
    searchPlacesAsync
  });

  const liveSystemInstruction = useMemo(() => {
    if (!activeTrip) return 'You are "Sára," an intelligent travel assistant.';
    const recentChatContext = messages.slice(-15).map(m => 
      `${m.role === 'user' ? 'Traveler' : 'Sára'}: ${typeof m.text === 'string' ? m.text : (lang === 'cs' ? m.text.cs : m.text.en)}`
    ).join('\n');
    return `You are "Sára," the intelligent real-time conversational assistant for this trip.\n\n${generatePromptContext()}\n\nYour goal is to provide helpful, conversational travel advice.\nMULTILINGUAL: Always respond in the same language as the user speaks to you (English or Czech).\nTRANSCRIPTION: Ignore background noise. The user ONLY speaks English or Czech. Do not hallucinate other languages or scripts like Japanese or Hindi.\n\n${recentChatContext ? `CONVERSATION HISTORY:\n${recentChatContext}\n` : ''}\nCORE CAPABILITIES: Trigger generation, search places, add to itinerary.`;
  }, [activeTrip, messages, generatePromptContext, lang]);

  const { isActive: isVoiceActive, startCall, stopCall } = useLiveGemini({
    systemInstruction: liveSystemInstruction,
    lang: lang,
    onStatusChange: setCallStatus,
    onVolumeChange: setVoiceVolume,
    onRemoteVolumeChange: setRemoteVoiceVolume,
    onMessage: (text) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model' && !last.uiCards) {
          const currentText = typeof last.text === 'string' ? last.text : (lang === 'cs' ? last.text.cs : last.text.en);
          const newText = currentText + text;
          return [...prev.slice(0, -1), { ...last, text: { en: newText, cs: newText } }];
        }
        return [...prev, { role: 'model', text: { en: text, cs: text } }];
      });
    },
    onUserMessage: (text) => {
      // Filter out 'hallucinated' translations in wrong scripts (e.g. Japanese, Hindi)
      // while speaking Czech or English.
      const hasOrientalScript = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u0900-\u097f]/.test(text);
      if (hasOrientalScript && text.length < 15) return; // Keep long ones just in case, but ignore short hallucinations

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'user') {
          return [...prev.slice(0, -1), { ...last, text: { en: text, cs: text } }];
        }
        return [...prev, { role: 'user', text: { en: text, cs: text } }];
      });
    },
    onUpdateItinerary: async (data: any) => {
      if (!activeTrip) return;

      // Handle voice-triggered itinerary generation launch
      if (data.type === 'launch_itinerary') {
        const mode = data.planningMode === 'dense' ? 'packed' : (data.planningMode || 'balanced');
        return handleSmartGeneration(mode);
      }

      if (!data.day || !data.activity) return; // Guard for incomplete data

      const startAt = new Date(activeTrip.startDate);
      startAt.setDate(startAt.getDate() + (data.day - 1));
      const dayIso = toLocalIso(startAt);
      
      const bActivity = await ensureBilingualAsync(data.activity);
      const bDescription = data.description ? await ensureBilingualAsync(data.description) : { en: 'Added by Sára.', cs: 'Přidáno Sárou.' };
      
      let newActivity: POI = {
        id: 'voice-' + Date.now(),
        title: bActivity,
        description: bDescription,
        category: (data.category as Category) || 'Sightseeing',
        duration: 60,
        imageUrl: `https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&w=800&q=80`,
        address: data.activity,
      };
      
      try {
        const results = await searchPlacesAsync(`${data.activity} ${activeTrip.destination}`);
        if (results.length > 0) newActivity = { ...newActivity, ...results[0], id: 'voice-' + Date.now() + '-' + results[0].id };
      } catch {}
      
      addPoi(dayIso, newActivity);
      setNotification(`${t('sara_added_notification')} ${data.day}`);
    },
    onRemoveFromItinerary: async (data) => {
      if (!activeTrip || !data.day || !data.activity) return;
      const startAt = new Date(activeTrip.startDate);
      startAt.setDate(startAt.getDate() + (data.day - 1));
      const dayIso = toLocalIso(startAt);
      const dayPois = itinerary[dayIso] || [];
      const target = dayPois.find(p => p.title.en.toLowerCase().includes(data.activity.toLowerCase())) || dayPois[dayPois.length-1];
      if (target) {
        removePoi(dayIso, target.id);
        setNotification(`${t('sara_removed_notification')} ${data.day}`);
      }
    },
    onClearDay: async (data) => {
      if (data.day) {
        const startAt = new Date(activeTrip!.startDate);
        startAt.setDate(startAt.getDate() + (data.day - 1));
        clearDay(toLocalIso(startAt));
      }
    },
    onClearItinerary: async () => clearItinerary(),
    onUpdateTripDetails: async (data) => { if (activeTripId) updateTrip(activeTripId, data); },
    onTriggerSmartItinerary: async (intensity, dayNumbers) => handleSmartGeneration(intensity, dayNumbers),
    onShowUICard: (card) => setMessages(prev => [...prev, { role: 'model', text: { en: 'Here is what I found:', cs: 'Tady je, co jsem našla:' }, uiCards: [card] }]),
    onUploadDoc: (f) => handleFileUpload(f, addReferenceDoc)
  });

  const saraState = useSaraState({
    callStatus,
    voiceVolume,
    remoteVoiceVolume,
    isVoiceActive,
    isChatLoading,
    isChatOpen: messages.length > 0
  });

  useEffect(() => {
    fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=CZK,USD')
      .then(res => res.json())
      .then(data => setRates({ EUR: 1, ...data.rates }))
      .catch(console.warn);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id as string);
    const poi = (activeTrip?.libraryPois || []).find((p: any) => p.id === active.id) || atlasSearchResults.find(p => p.id === active.id);
    if (poi) setActiveDragData(poi);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && over.id.startsWith('day-')) {
      const dayIso = over.id.replace('day-', '');
      const poi = (activeTrip?.libraryPois || []).find((p: any) => p.id === active.id) || atlasSearchResults.find(p => p.id === active.id);
      if (poi) {
        addPoi(dayIso, poi);
        setNotification(t('notification_added'));
      }
    }
    setActiveId(null);
    setActiveDragData(null);
  };

  const currentIso = days[activeDayIdx] ? toLocalIso(days[activeDayIdx]) : '';
  const activeDayItems = currentIso ? (itinerary[currentIso] || []) : [];

  // Memoize merged search results to show enriched data if it exists in the trip
  const mergedSearchResults = useMemo(() => {
    const allKnownPois = new Map<string, POI>();
    // Library takes precedence
    (activeTrip?.libraryPois || []).forEach(p => allKnownPois.set(p.id, p));
    // Itinerary items also count
    Object.values(itinerary).flat().forEach((p: any) => {
      if (!allKnownPois.has(p.id)) allKnownPois.set(p.id, p);
    });

    return atlasSearchResults.map(poi => {
      // Find matching POI by ID or googlePlaceId
      const match = allKnownPois.get(poi.id) || 
                   (poi.googlePlaceId ? Array.from(allKnownPois.values()).find(p => p.googlePlaceId === poi.googlePlaceId) : null);
      
      // If we have an enriched version, merge it but keep current search metrics if needed
      // Actually, just returning the match is better as it contains all the persistence
      return match ? { ...poi, ...match } : poi;
    });
  }, [atlasSearchResults, activeTrip?.libraryPois, itinerary]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col-reverse md:flex-row h-screen w-full font-sans transition-colors duration-700 overflow-hidden bg-zinc-950">
        <div className={`w-full h-1/2 md:h-full md:w-[450px] lg:w-[500px] border-r border-t md:border-t-0 flex flex-col relative z-20 transition-colors duration-700 ${theme === 'dark' ? 'bg-zinc-950 border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]' : 'bg-white border-slate-200'} overflow-y-auto scrollbar-hide`} style={{ scrollbarWidth: 'none' }}>
          <TopBar trip={activeTrip} lang={lang} setLang={setLang} currency={currency} setCurrency={setCurrency} rates={rates} theme={theme} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onExit={() => setActiveTripId(null)} onUpdate={(data) => updateTrip(activeTrip.id, data)} />
          <div className="h-16 flex-shrink-0" />
          
          <div className={`p-6 border-b transition-colors duration-700 ${theme === 'dark' ? 'border-white/5 bg-zinc-950' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-[#0F172A]'}`}>{activeTrip.destination}</h3>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className={`text-[10px] font-bold tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600 uppercase'}`}>{t('syncing_sara')}</p>
                </div>
              </div>
            </div>
          </div>

          <AssistantPanel 
            theme={theme} lang={lang} messages={messages} saraState={saraState} 
            chatContainerRef={chatContainerRef} chatEndRef={chatEndRef} isChatLoading={isChatLoading} 
            isVoiceActive={isVoiceActive} callStatus={callStatus} chatInput={chatInput} setChatInput={setChatInput}
            handleChatKeyDown={(e) => { if(e.key === 'Enter') handleSendMessage(); }} startCall={startCall} stopCall={stopCall}
            setIsListening={setIsListening} isListening={isListening} fileInputRef={fileInputRef} handleFileUpload={(f) => handleFileUpload(f, addReferenceDoc)}
            handleSendMessage={handleSendMessage} addPoi={addPoi} currentIso={currentIso} safeActiveDayIdx={activeDayIdx} t={t} setNotification={setNotification}
          />

          <ItineraryPanel 
            theme={theme} lang={lang} activeTrip={activeTrip} days={days} itinerary={itinerary} 
            activeDayIdx={activeDayIdx} setActiveDayIdx={setActiveDayIdx} setShowAllDays={setShowAllDays}
            removePoi={removePoi} updatePoiTransportMode={updatePoiTransportMode} setSelectedPoi={setSelectedPoi}
            currency={currency} rates={rates} t={t}
            travelers={activeTrip?.travelers || 2}
          />
        </div>

        <div className="flex-1 relative h-1/2 md:h-full">
          <MapActions 
            theme={theme} lang={lang} activeDayItems={activeDayItems} activeTrip={activeTrip}
            packingComplete={packingComplete} showAllDays={showAllDays} setShowAllDays={setShowAllDays}
            setShowStaysManager={setShowStaysManager} setShowPackingChecklist={setShowPackingChecklist}
            isLibraryOpen={isLibraryOpen} setIsLibraryOpen={setIsLibraryOpen} t={t}
          />

          <div className={`w-full h-full pt-16 md:rounded-[3rem] overflow-hidden shadow-2xl border transition-all duration-700 relative ${theme === 'dark' ? 'bg-zinc-950 border-white/10' : 'bg-white border-slate-200'}`}>
            <GoogleMapView 
              activeDayItems={activeDayItems} allDaysData={days.map((d, i) => ({ pois: itinerary[toLocalIso(d)] || [], dayIndex: i }))}
              showAllDays={showAllDays} activeDayIdx={activeDayIdx} activeDayIso={currentIso} lang={lang}
              onPoiClick={setSelectedPoi} hoveredPoiId={hoveredPoiId} onMarkerHover={setHoveredPoiId}
              allPois={(() => {
                const lib = activeTrip?.libraryPois || [];
                const libIds = new Set(lib.map((p: any) => p.id));
                // Use mergedSearchResults here too so map markers have AI data!
                return [...lib, ...mergedSearchResults.filter(p => !libIds.has(p.id))];
              })()} tripDestination={activeTrip?.destination}
              onAddToDay={(poi) => addPoi(currentIso, poi)} showAtlasMarkers={isLibraryOpen} theme={theme}
              currency={currency} rates={rates}
            />
          </div>

          <LibraryPanel 
            theme={theme} lang={lang} activeTrip={activeTrip} isLibraryOpen={isLibraryOpen} setIsLibraryOpen={setIsLibraryOpen}
            atlasQuery={atlasQuery} setAtlasQuery={setAtlasQuery} searchInBounds={searchInBounds} setSearchInBounds={setSearchInBounds}
            doAtlasSearch={doAtlasSearch} isAtlasSearching={isAtlasSearching} atlasSearchResults={mergedSearchResults}
            clearAtlasResults={clearAtlasResults} atlasSearchError={atlasSearchError}
            allAvailablePois={activeTrip?.libraryPois || []} libraryTabs={['All', 'Sightseeing', 'Activity', 'Restaurant', 'Nature', 'Saved']}
            activeTab={activeTab} setActiveTab={setActiveTab} 
            filteredPois={(activeTab === 'All' ? (activeTrip?.libraryPois || []) : (activeTab === 'Saved' ? (activeTrip?.libraryPois || []).filter((p: any) => p.isSaved) : (activeTrip?.libraryPois || []).filter((p: any) => p.category === activeTab)))}
            addPoi={addPoi} currentIso={currentIso} safeActiveDayIdx={activeDayIdx} setSelectedPoi={setSelectedPoi}
            setHoveredPoiId={setHoveredPoiId} t={t} setNotification={setNotification}
          />
        </div>

        <AnimatePresence>
          {showPackingChecklist && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowPackingChecklist(false)}>
              <PackingChecklist tripId={activeTripId} isOpen={true} lang={lang} destination={activeTrip.destination} startDate={activeTrip.startDate} endDate={activeTrip.endDate} travelersCount={activeTrip.travelers} travelerProfiles={activeTrip.travelerProfiles || []} packingRequirements={activeTrip.logistics?.packingRequirements} onClose={() => setShowPackingChecklist(false)} onComplete={() => { setPackingComplete(true); setNotification(t('packing_complete')); }} theme={theme} />
            </div>
          )}
          {showStaysManager && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowStaysManager(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10 w-full max-w-5xl">
                 <StaysManager trip={activeTrip} lang={lang} currency={currency} rates={rates} apiKey={mapsApiKey} onUpdate={async (stays) => { const updatedItinerary = syncStaysToItinerary(stays, activeTrip.itinerary || {}); await updateTrip(activeTrip.id, { itinerary: updatedItinerary, logistics: { ...activeTrip.logistics, stays } }); }} onAddStayToItinerary={(stay) => {
                   addPoi(stay.checkInDate, { id: `checkin-${stay.id}`, title: { en: `Check-in: ${stay.name}`, cs: `Check-in: ${stay.name}` }, category: 'Special', fixed: true, time: '15:00', duration: 30, imageUrl: stay.imageUrl, location: stay.location, description: { en: `Check-in time`, cs: `Čas příjezdu` }, address: stay.address });
                   addPoi(stay.checkOutDate, { id: `checkout-${stay.id}`, title: { en: `Check-out: ${stay.name}`, cs: `Check-out: ${stay.name}` }, category: 'Special', fixed: true, time: '10:00', duration: 30, imageUrl: stay.imageUrl, location: stay.location, description: { en: `Check-out time`, cs: `Čas odjezdu` }, address: stay.address });
                 }} onClose={() => setShowStaysManager(false)} theme={theme} />
              </motion.div>
            </div>
          )}
          {selectedPoi && (
            <PoiDetailModal 
              poi={selectedPoi} 
              lang={lang} 
              onClose={() => setSelectedPoi(null)} 
              onAdd={() => { addPoi(currentIso, selectedPoi); setSelectedPoi(null); }} 
              activeDayIndex={activeDayIdx} 
              theme={theme} 
              currency={currency} 
              rates={rates} 
              onEnrich={async (poi) => {
                await updatePoi(poi);
                setSelectedPoi(poi);
              }} 
            />
          )}
          {notification && (
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/50">
              <MapPin className="w-4 h-4" />{notification}
            </motion.div>
          )}
        </AnimatePresence>

        <DragOverlay zIndex={1000}>
          {activeId && activeDragData ? (
             <div className={`p-4 rounded-[2rem] border-2 shadow-2xl flex items-center gap-4 ${theme === 'dark' ? 'bg-slate-900 border-emerald-500 text-white' : 'bg-white border-emerald-500 text-slate-900'}`} style={{ width: 300 }}>
                <img src={activeDragData.imageUrl} className="w-12 h-12 rounded-xl object-cover shadow-lg" alt="" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-xs uppercase truncate">{activeDragData.title[lang] || activeDragData.title.en}</h4>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">{activeDragData.category}</p>
                </div>
             </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};
