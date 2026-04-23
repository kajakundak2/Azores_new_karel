import React from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import {
  Cake, Calendar, ChevronRight, Globe, Map as MapIcon, MessageSquare,
  Navigation, Plane, Plus, Search, Sparkles, Wind, X, Send, Loader2, Mic, MicOff, Star,
  Car, Bus, MapPin, ExternalLink, Phone, PhoneOff, Download, FileDown, Minus,
  Volume2, VolumeX, Shield, Sun, Moon, Coins, Settings, Languages, Compass, Users, Hotel, Share2, Paperclip
} from 'lucide-react';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { FIXED_EVENTS, POI, SLIDES, TEXTS, Category } from './data';
import { useItineraryState, formatDuration, calcDayDuration, toLocalIso, syncStaysToItinerary } from './useItineraryState';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from './utils/geminiKeyManager';
import { ensureBilingual, ensureBilingualAsync, translate } from './utils/bilingualUtils';
import { aiTranslator } from './utils/aiTranslator';
import { applyItineraryUpdate } from './utils/aiUpdateAgent';
import { APIProvider } from '@vis.gl/react-google-maps';
import { PoiDetailModal } from './components/PoiDetailModal';
import { WeatherWidget } from './components/WeatherWidget';
import { MemoriesGallery } from './components/MemoriesGallery';
import { useLiveGemini } from './hooks/useLiveGemini';
import { usePlacesSearch, searchPlacesAsync } from './hooks/usePlacesSearch';
import GoogleMapView from './components/GoogleMapView';
import { LandingPage } from './components/LandingPage';
// Removed ExpeditionIntel import
import { db } from './firebase';
import { downloadKML, generateGoogleMapsDirectionsUrl } from './utils/kmlExport';
import { VerticalTimelineDay } from './components/VerticalTimeline';
import { SaraAssistant } from './components/characters/SaraAssistant';
import { PackingChecklist } from './components/characters/PackingChecklist';
import { StaysManager } from './components/StaysManager';
import { CharacterAvatar } from './components/characters/CharacterAvatar';
import { useSaraState } from './hooks/useCharacterState';


// ── Slideshow ─────────────────────────────────────────────────────────────────
const Slideshow = ({ isBlurred = false, theme }: { isBlurred?: boolean; theme: 'dark' | 'light' }) => {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    // Start with a random slide
    setCurrent(Math.floor(Math.random() * SLIDES.length));
    const timer = setInterval(() => setCurrent(p => (p + 1) % SLIDES.length), 8000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={`fixed inset-0 w-full h-full -z-20 overflow-hidden transition-colors duration-1000 ${theme === 'dark' ? 'bg-zinc-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${isBlurred ? 'blur-2xl scale-110 opacity-70' : 'opacity-90'}`}
          style={{ backgroundImage: `url('${SLIDES[current]}')` }}
        />
      </AnimatePresence>
      <div className={`absolute inset-0 transition-all duration-1000 ${isBlurred ? 'backdrop-blur-3xl ' + (theme === 'dark' ? 'bg-zinc-950/40' : 'bg-white/40') : 'backdrop-blur-[2px] ' + (theme === 'dark' ? 'bg-zinc-950/20' : 'bg-zinc-50/40')}`} />
      <div className={`absolute inset-0 bg-gradient-to-b ${theme === 'dark' ? 'from-zinc-950/40 via-transparent to-zinc-950/60' : 'from-white/40 via-transparent to-slate-200/60'}`} />
    </div>
  );
};

// ── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ Icon, title, subtitle, theme }: { Icon?: any; title: string | React.ReactNode; subtitle?: string; theme: 'dark' | 'light' }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="flex flex-col items-center text-center mb-16 space-y-4"
  >
    {Icon && (
      <div className={`w-16 h-16 backdrop-blur-xl rounded-3xl flex items-center justify-center border mb-2 shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-white/80 border-slate-200'}`}>
        <Icon className={`w-8 h-8 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
      </div>
    )}
    <h2 className={`text-4xl sm:text-7xl font-black tracking-tighter uppercase drop-shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
    {subtitle && <p className={`font-black tracking-[0.4em] text-xs uppercase transition-colors duration-500 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{subtitle}</p>}
    <div className="w-24 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
  </motion.div>
);

// ── Draggable POI Card ────────────────────────────────────────────────────────
const DraggablePoi = ({ poi, lang, onSelect, onHover, theme }: { poi: POI; lang: string; onSelect: (p: POI) => void; onHover?: (id: string | null) => void; theme: 'dark' | 'light'; key?: React.Key }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${poi.id}`,
    data: poi,
  });
  const style = undefined;

  const catColors: Record<string, string> = {
    Sightseeing: 'text-sky-400',
    Activity: 'text-emerald-400',
    Food: 'text-amber-400',
    Transport: 'text-slate-400',
    Special: 'text-orange-400',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseEnter={() => onHover?.(poi.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`p-4 rounded-[2rem] border-2 cursor-grab active:cursor-grabbing transition-all shadow-sm ${
        theme === 'dark' 
          ? 'bg-white/[0.03] border-white/5 text-white hover:bg-white/[0.08] hover:border-emerald-500/20' 
          : 'bg-white border-slate-100 text-slate-900 hover:bg-emerald-50 hover:border-emerald-200'
      } ${isDragging ? 'opacity-40 ring-2 ring-emerald-500' : ''}`}
    >
      <img src={poi.imageUrl} className="w-16 h-16 rounded-[1.25rem] object-cover shadow-2xl pointer-events-none flex-shrink-0" alt="" referrerPolicy="no-referrer" />
      <div className="flex-1 min-w-0 py-1 pointer-events-none text-left">
        <h4 className={`text-sm font-black leading-tight truncate uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{poi.title[lang]}</h4>
        <div className="flex items-center gap-2 mt-1">
          <p className={`text-[10px] font-black uppercase tracking-tighter ${catColors[poi.category] ?? 'text-slate-400'}`}>{poi.category}</p>
          <span className={`w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
          <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{formatDuration(poi.duration)}</p>
        </div>
      </div>
      <button
        onPointerDown={e => { e.stopPropagation(); onSelect(poi); }}
        className={`self-center p-2 rounded-xl transition-all pointer-events-auto text-[10px] ${theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/20 hover:text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-900'}`}
        title="View details"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// Removed old DroppableDay and TransportConnector



// ── Chat Message type ─────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'model';
  text: string | BilingualString;
  uiCards?: POI[];
}

// ── Top Bar Component ────────────────────────────────────────────────────────
const TopBar = ({ 
  trip, 
  lang, 
  setLang, 
  currency, 
  setCurrency, 
  rates, 
  onThemeToggle, 
  theme,
  onExit,
  onUpdate
}: { 
  trip: any; 
  lang: string; 
  setLang: (l: string) => void;
  currency: string;
  setCurrency: (c: any) => void;
  rates: any;
  onThemeToggle: () => void;
  theme: 'dark' | 'light';
  onExit: () => void;
  onUpdate: (data: any) => void;
}) => {
  const t = (key: string) => TEXTS[key]?.[lang] || key;
  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] border-b h-16 flex items-center justify-between px-6 backdrop-blur-xl transition-all duration-500 ${theme === 'dark' ? 'bg-zinc-950/80 border-white/5 shadow-2xl' : 'bg-white/80 border-slate-200'}`}>
      <div className="flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={onExit}>
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center p-1.5">
            <Compass className="text-slate-950 w-full h-full" />
          </div>
          <span className={`text-lg hidden sm:block uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <span className="font-extrabold">SARA</span>
            <span className="font-light text-emerald-500">{t('itinerary')}</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-white/10" />

        {/* Trip Quick Info */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-emerald-500" />
            <div className="flex items-center gap-1">
              <input 
                type="date"
                value={trip.startDate}
                onChange={(e) => onUpdate({ startDate: e.target.value })}
                className={`text-[10px] bg-transparent border-none p-0 font-black uppercase tracking-widest outline-none focus:text-emerald-400 ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}
              />
              <span className="text-[10px] text-white/20">—</span>
              <input 
                type="date"
                value={trip.endDate}
                onChange={(e) => onUpdate({ endDate: e.target.value })}
                className={`text-[10px] bg-transparent border-none p-0 font-black uppercase tracking-widest outline-none focus:text-emerald-400 ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Users className="w-3 h-3 text-emerald-500 mx-1" />
            <button 
              onClick={() => onUpdate({ travelers: Math.max(1, (trip.travelers || 1) - 1) })}
              className={`p-1 rounded-md hover:bg-emerald-500/20 transition-colors ${theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className={`text-[10px] font-black uppercase tracking-widest min-w-[12px] text-center ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>
              {trip.travelers || 1}
            </span>
            <button 
              onClick={() => onUpdate({ travelers: (trip.travelers || 1) + 1 })}
              className={`p-1 rounded-md hover:bg-emerald-500/20 transition-colors ${theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ml-1`}>
              {t('units_person')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Currency Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-xl p-1 border border-slate-200 dark:border-white/10">
          {['EUR', 'CZK', 'USD'].map(c => (
            <button 
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest transition-all ${currency === c ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-emerald-400'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Language Switcher */}
        <button 
          onClick={() => setLang(lang === 'en' ? 'cs' : 'en')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
        >
          <Languages className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest">{lang}</span>
        </button>

        {/* Theme Toggle */}
        <button 
          onClick={onThemeToggle}
          className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-white/10 mx-2" />

        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert(t('link_copied'));
          }}
          className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
          title="Share Trip"
        >
          <Share2 size={14} className="text-blue-400" />
        </button>

        <button 
          onClick={onExit}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Exit
        </button>
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState('en');
  const { 
    trips, 
    activeTripId, 
    activeTrip, 
    itinerary, 
    customPois, 
    addPoi, 
    removePoi, 
    clearDay,
    clearItinerary,
    addCustomPoi, 
    updatePoiTransportMode, // Added this line
    getJsonContext, 
    setActiveTripId, 
    createTrip, 
    updateTrip,
    deleteTrip,
    days,
    isGeneratingLibrary,
    addReferenceDoc,
    removeReferenceDoc
  } = useItineraryState();

  const t = (key: string) => TEXTS[key]?.[lang] || key;

  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [showAllDays, setShowAllDays] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [remoteVoiceVolume, setRemoteVoiceVolume] = useState(0);
  
  const [showPackingChecklist, setShowPackingChecklist] = useState(false);
  const [showStaysManager, setShowStaysManager] = useState(false);
  const [packingComplete, setPackingComplete] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Atlas search state
  const [atlasQuery, setAtlasQuery] = useState('');
  const [searchInBounds, setSearchInBounds] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const { results: atlasSearchResults, isSearching: isAtlasSearching, error: atlasSearchError, searchPlaces: doAtlasSearch, clearResults: clearAtlasResults } = usePlacesSearch();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<POI | null>(null);
  
  // Theme & Currency handling
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currency, setCurrency] = useState<'EUR' | 'CZK' | 'USD'>('EUR');
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1, CZK: 25.3, USD: 1.05 });
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=CZK,USD')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        if (data && data.rates) {
          setRates({ EUR: 1, ...data.rates });
        }
      })
      .catch(err => {
        console.warn('Failed to fetch live exchange rates:', err);
        // Keep defaults if fetch fails
      });
  }, []);

  // Expose language setter for child components (LandingPage hack)
  useEffect(() => {
    (window as any).setGlobalLanguage = (newLang: string) => setLang(newLang);
  }, []);

  // Sync theme with body class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-zinc-950');
      document.body.classList.remove('bg-zinc-50');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-zinc-950');
      document.body.classList.add('bg-zinc-50');
    }
  }, [theme]);



  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const liveSystemInstruction = useMemo(() => {
    if (!activeTrip) return 'You are "Sára," an intelligent travel assistant. Keep answers friendly and helpful.';
    
    // Get last 5 relevant messages for context
    const recentChatContext = messages.slice(-5).map(m => 
      `${m.role === 'user' ? 'Traveler' : 'Sára'}: ${m.text}`
    ).join('\n');

    return `You are "Sára," the intelligent real-time travel assistant for the trip: ${activeTrip.title}.
DESTINATION: ${activeTrip.destination}
DATES: ${activeTrip.startDate} to ${activeTrip.endDate}
TRAVELERS: ${activeTrip.travelers} people (${activeTrip.adults || activeTrip.travelers} adults${activeTrip.kids ? `, ${activeTrip.kids} children (ages: ${activeTrip.kidsAges?.join(', ') || 'unknown'})` : ''}).

Your goal is to provide helpful, conversational travel advice. 
Be friendly and collaborative. Address the user sparingly as "Traveler" or not at all.
MULTILINGUAL: Always respond in the same language as the user speaks to you. If Czech, stay in Czech.

${recentChatContext ? `RECENT CONVERSATION HISTORY:\n${recentChatContext}\n` : ''}

DETAILED PLANNING:
If the user asks for a "detailed plan," "full itinerary," "to plan everything," or mentions they want more than one activity per day:
- YOU MUST CALL the "trigger_smart_itinerary_generation" tool.
- This tool handles multiple days, logical routing, and food stops automatically.
- After calling it, tell the user you are working on a dense, optimized plan and it will appear in a moment.

SINGLE MODIFICATIONS:
- For adding a single place, use "add_to_itinerary".
- For searching, use "searchGooglePlaces".

Confirm actions briefly: "Ok, už na tom pracuji..." or "Přidávám [Místo]."
Costs in local currency (default to € if unsure).

REFERENCE DOCUMENTS:
${activeTrip?.referenceDocs?.map(d => `---
DOCUMENT: ${d.name}
CONTENT: 
${d.content}
---`).join('\n') || 'No additional reference documents provided.'}

If documents are provided, FAVOR places and descriptions from them. Use their structure and timing if applicable.`;
  }, [activeTrip, messages]);

  const handleFileUpload = async (file: File) => {
    if (!activeTripId) return;
    try {
      const text = await file.text();
      await addReferenceDoc({ name: file.name, content: text });
      setNotification(lang === 'cs' ? `Dokument ${file.name} nahrán do paměti Sáry!` : `Uploaded ${file.name} to Sara's memory!`);
      const uploadUserMsg = {
        en: `[System: User uploaded reference document: ${file.name}]`,
        cs: `[Systém: Uživatel nahrál referenční dokument: ${file.name}]`
      };
      const uploadModelMsg = {
        en: `I've received "${file.name}". I'll use it as a reference for your itinerary!`,
        cs: `Přijala jsem "${file.name}". Použiji jej jako referenci pro váš itinerář!`
      };
      setMessages(prev => [...prev, { role: 'user', text: uploadUserMsg }]);
      setMessages(prev => [...prev, { role: 'model', text: uploadModelMsg }]);
    } catch (err) {
      console.error(err);
      setNotification("Failed to read file.");
    }
  };

  const handleSmartGeneration = useCallback(async (intensity: string = 'balanced') => {
    if (!activeTrip) return;
    
    setNotification(t('notification_planning'));
    setIsChatLoading(true);

    const onProgress = (msg: string) => {
      setNotification(msg);
      console.log('[SmartGen]', msg);
    };

    try {
      const hasReferenceDocs = activeTrip.referenceDocs && activeTrip.referenceDocs.length > 0;
      let parsedDays: ParsedDay[];

      if (hasReferenceDocs) {
        // ── DOCUMENT-BASED: Use Splitter→Worker→Merger pipeline ──
        const fullDocText = activeTrip.referenceDocs!.map(d => d.content).join('\n\n---\n\n');
        
        parsedDays = await parseItineraryDocument(
          fullDocText,
          activeTrip.destination,
          activeTrip.travelers,
          onProgress
        );
      } else {
        // ── SCRATCH: Generate per-day using the same chunked architecture ──
        const referenceContext = '';
        
        parsedDays = await generateItineraryFromScratch(
          activeTrip.destination,
          activeTrip.startDate,
          activeTrip.endDate,
          activeTrip.travelers,
          intensity,
          referenceContext,
          onProgress
        );
      }

      // ── Merger: Enrich with Google Places data, then apply to calendar ──
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

          onProgress(lang === 'cs'
            ? `Den ${day.dayNumber}: Hledám ${day.activities.length} míst na mapě...`
            : `Day ${day.dayNumber}: Looking up ${day.activities.length} places on map...`);

          for (const act of day.activities) {
            // Skip transport/notes from Places lookup
            const skipLookup = act.category === 'Transport' || act.category === 'Special';

            let placeData: POI | null = null;
            if (!skipLookup) {
              try {
                const searchQuery = `${act.title} ${dest}`;
                const results = await searchPlacesAsync(searchQuery);
                if (results.length > 0) {
                  placeData = results[0]; // Best match
                  enrichedCount++;
                }
              } catch (e) {
                console.warn(`Places lookup failed for "${act.title}":`, e);
              }
              // Small delay between Places API calls to avoid quota bursts
              await new Promise(r => setTimeout(r, 200));
            }

            const bTitle = await ensureBilingualAsync(act.title);
            const bDesc = await ensureBilingualAsync(act.description);
            const bTips = act.practicalTips ? await ensureBilingualAsync(act.practicalTips) : null;

            const fullDescription = {
              en: bDesc.en + (bTips ? `\n\n💡 ${bTips.en}` : ''),
              cs: bDesc.cs + (bTips ? `\n\n💡 ${bTips.cs}` : '')
            };

            const newActivity: POI = {
              id: `smartgen-${day.dayNumber}-${totalPois}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              title: bTitle,
              description: fullDescription,
              category: (act.category as Category) || 'Sightseeing',
              duration: act.duration || 60,
              cost: act.cost ? parseFloat(act.cost.replace(/[^0-9.,]/g, '').replace(',', '.')) || undefined : undefined,
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

          // Add day notes as a special POI
          if (day.dayNotes) {
            addPoi(dayIso, {
              id: `daynotes-${day.dayNumber}-${Date.now()}`,
              title: { en: `📋 Day ${day.dayNumber} Tips`, cs: `📋 Tipy pro den ${day.dayNumber}` },
              description: await ensureBilingualAsync(day.dayNotes),
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
      const bError = await ensureBilingualAsync(errMsg);
      setMessages(prev => [...prev, { role: 'model', text: bError }]);
    }

    setIsChatLoading(false);
  }, [activeTrip, lang, addPoi, setMessages]);

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

      // Sync the entire updated itinerary to Firestore
      await updateTrip(activeTripId, { itinerary: updatedItinerary });

      const bMsg = await ensureBilingualAsync(summary);
      setMessages(prev => [...prev, { role: 'model', text: bMsg }]);
      setNotification(lang === 'cs' ? '✨ Itinerář aktualizován!' : '✨ Itinerary updated!');
    } catch (err: any) {
      console.error('Update error:', err);
      const errMsg = await ensureBilingualAsync(`❌ Failed to update itinerary: ${err.message}`);
      setMessages(prev => [...prev, { role: 'model', text: errMsg }]);
    }

    setIsChatLoading(false);
  }, [activeTrip, activeTripId, itinerary, lang, updateTrip]);






  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastIntroTripId = useRef<string | null>(null);
  const handleSmartGenerationRef = useRef(handleSmartGeneration);

  useEffect(() => { handleSmartGenerationRef.current = handleSmartGeneration; }, [handleSmartGeneration]);



  // Auto-clear notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);


  // Speech-To-Text implementation
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) return;
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'cs' ? 'cs-CZ' : 'en-US';

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setChatInput(text);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    if (isListening) {
      recognition.start();
    } else {
      recognition.stop();
    }

    return () => recognition.stop();
  }, [isListening, lang]);

  // Itinerary hook (Phase 2 + 5)


  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll chat inside its container
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const safeActiveDayIdx = activeDayIdx < days.length ? activeDayIdx : 0;
  const currentIso = days[activeDayIdx] ? toLocalIso(days[activeDayIdx]) : '';
  const activeDayItems = currentIso ? (itinerary[currentIso] || []) : [];

  // Reset chat and add intro message when trip changes
  useEffect(() => {
    if (activeTripId && activeTrip) {
      if (lastIntroTripId.current === activeTripId) return;
      lastIntroTripId.current = activeTripId;
      
      if (activeTrip.chatHistory && activeTrip.chatHistory.length > 0) {
        setMessages(activeTrip.chatHistory.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          text: m.text,
          uiCards: m.uiCards
        })));
      } else {
        const welcomeMsg = {
          en: `Welcome to ${activeTrip.destination}! I'm Sára, your personal travel assistant. I've prepared some suggestions in the library. What kind of experiences are you looking for?`,
          cs: `Vítejte v destinaci ${activeTrip.destination}! Jsem Sára, vaše osobní asistentka pro cestování. Připravila jsem pro vás několik návrhů v knihovně. Jaké zážitky hledáte?`
        };
        setMessages([{ role: 'model', text: welcomeMsg }]);
      }
      
      // Check for auto-generation flag from LandingPage
      const shouldAutoGenerate = localStorage.getItem('auto_generate_smart_itinerary');
      if (shouldAutoGenerate === 'true') {
        localStorage.removeItem('auto_generate_smart_itinerary');
        handleSmartGenerationRef.current('balanced');
      }
    } else if (!activeTripId) {
      setMessages([]);
      lastIntroTripId.current = null;
    }
  }, [activeTripId]);

  // Persist chat history changes to Firestore
  useEffect(() => {
    if (activeTripId && activeTrip && messages.length > 0) {
      // Avoid infinite loop by checking if history actually changed
      const currentHistory = activeTrip.chatHistory || [];
      const newHistory = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' as const : 'user' as const,
        text: m.text,
        uiCards: m.uiCards,
        timestamp: new Date().toISOString()
      }));

      // Simple length check or more robust comparison
      if (newHistory.length !== currentHistory.length) {
        // We use a debounce or just updateTrip which is already debounced/throttled in useItineraryState usually
        updateTrip(activeTripId, { chatHistory: newHistory });
      }
    }
  }, [messages, activeTripId, updateTrip]);

  // All days data for GoogleMapView
  const allDaysData = useMemo(() => {
    return days.map((day, idx) => ({
      pois: itinerary[toLocalIso(day)] || [],
      dayIndex: idx,
    }));
  }, [itinerary, days]);

  // Route stats
  const activeDayDuration = calcDayDuration(activeDayItems);


  // ── Library & DnD Logic ──────────────────────────────────────────────────
  const libraryTabs = ['All', 'Sightseeing', 'Activity', 'Food', 'Transport', 'Special'];
  const allAvailablePois = customPois;
  
  const filteredPois = useMemo(() => {
    let list = allAvailablePois;
    if (activeTab !== 'All') {
      list = list.filter(p => p.category === activeTab);
    }
    if (atlasQuery.trim()) {
      const q = atlasQuery.toLowerCase();
      list = list.filter(p => 
        p.title.en.toLowerCase().includes(q) || 
        (p.title.cs && p.title.cs.toLowerCase().includes(q)) ||
        (p.description?.en && p.description.en.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allAvailablePois, activeTab, atlasQuery]);

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveDragData(active.data.current as POI);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);

    if (over && over.id && active.data.current) {
      const dayIso = over.id as string;
      const poi = active.data.current as POI;
      
      const newPoi = {
        ...poi,
        id: `${poi.id}-${Date.now()}`,
      };
      
      await addPoi(dayIso, newPoi);
      setNotification(t('notification_added'));
    }
  };

  // ── Gemini Chat Handler — uses @google/genai v1.x SDK ───────────────────
  const handleSendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;

    const bilingualUserText = await ensureBilingualAsync(text);
    setMessages(prev => [...prev, { role: 'user', text: bilingualUserText }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) {
        setMessages(prev => [...prev, {
          role: 'model',
          text: { en: '⚠️ No Gemini API keys available.', cs: '⚠️ Nejsou k dispozici žádné klíče Gemini API.' },
        }]);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const itineraryContext = getJsonContext();
      const dest = activeTrip?.destination || 'Unknown Destination';
      const tripTitle = activeTrip?.title || 'Trip';
      const tripDates = activeTrip ? `${activeTrip.startDate} to ${activeTrip.endDate}` : 'TBD';
      const numTravelers = activeTrip?.travelers || 1;

      const systemInstruction = `You are "Sára," the intelligent travel planning assistant for "${tripTitle}".
      
      TRIP CONTEXT:
      - Destination: ${dest}
      - Dates: ${tripDates}
      - Travelers: ${numTravelers}
      
      Current Itinerary State:
      ${itineraryContext}
      
      - BE FRIENDLY: Adopt a collaborative and inviting tone.
      - ADDRESSING USER: Address the user sparingly as "Traveler" or not at all.
      - VISUAL PRIORITY: Suggest visually stunning spots and viral viewpoints perfect for memories.
      - Always use searchGooglePlaces for real recommendations.
      - Be enthusiastic and precise. All costs in €.
      - Keep responses conversational.
      - SMART PLANNING: 
         - If the user asks for a WHOLE NEW trip, call trigger_smart_itinerary_generation.
         - If the user asks for COMPLEX CHANGES (e.g. "move everything one day later", "replan the first half", "remove all hikes and add museums"), call update_itinerary.
         - For small single additions/removals, you can still use generateFullItinerary or remove_from_itinerary.`;

      const contents = messages
        .map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: typeof m.text === 'string' ? m.text : m.text.en }] }))
        .concat({ role: 'user', parts: [{ text: bilingualUserText.en }] });

      const result = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents,
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: 'searchGooglePlaces',
                description: `Search for a real point of interest near ${dest}. Use this when the user asks for recommendations. Returns real Google Places data with photos and ratings.`,
                parameters: {
                  type: 'OBJECT',
                  properties: { 
                    query: { type: 'STRING', description: `Search query, e.g. "romantic restaurants in ${dest}"` }
                  },
                  required: ['query']
                } as any
              },
              {
                name: 'generateFullItinerary',
                description: `Generate a full day itinerary for a specific day. Searches for multiple places and returns them as a batch. Use when the user asks to plan or auto-fill a day.`,
                parameters: {
                  type: 'OBJECT',
                  properties: { 
                    dayDescription: { type: 'STRING', description: 'What kind of day to plan, e.g. "relaxing beach day" or "adventure and hiking"' },
                    numPlaces: { type: 'NUMBER', description: 'Number of places/activities to find (3-6)' }
                  },
                  required: ['dayDescription']
                } as any
              },
              {
                name: 'searchFlights',
                description: `Search for flight options to ${dest}.`,
                parameters: {
                  type: 'OBJECT',
                  properties: { origin: { type: 'STRING' }, date: { type: 'STRING' } },
                  required: ['origin', 'date']
                } as any
              },
              {
                name: 'remove_from_itinerary',
                description: `Remove a specific activity or place from the itinerary. Requires exact dayIso and poiId from the Itinerary state.`,
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    dayIso: { type: 'STRING', description: 'The ISO date string of the day (e.g. "2026-05-15")' },
                    poiId: { type: 'STRING', description: 'The ID of the POI to remove' }
                  },
                  required: ['dayIso', 'poiId']
                } as any
              },
              {
                name: 'trigger_smart_itinerary_generation',
                description: 'Generate a complete, detailed day-by-day itinerary for ALL days of the trip. Use this when the user asks to plan the whole trip, plan it all, use the uploaded document, or plan it as in the file.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    intensity: { type: 'STRING', enum: ['relaxed', 'balanced', 'packed'], description: 'The pace of the trip.' }
                  }
                } as any
              },
              {
                name: 'clear_day',
                description: 'Clear all activities from a specific day in the itinerary.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    dayIso: { type: 'STRING', description: 'The ISO date string of the day to clear (e.g. "2026-05-15")' }
                  },
                  required: ['dayIso']
                } as any
              },
              {
                name: 'clear_itinerary',
                description: 'Clear all non-fixed activities from the entire itinerary.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                } as any
              },
              {
                name: 'update_itinerary',
                description: 'Update, modify, or replan large portions of the itinerary. Use this for complex requests like shifting days, removing multiple items, or changing themes.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    request: { type: 'STRING', description: 'The specific update request from the user.' }
                  },
                  required: ['request']
                } as any
              }
            ]
          }]
        }
      });

      if (result.functionCalls && result.functionCalls.length > 0) {
        const fc = result.functionCalls[0];
        let rawReply = 'Searching...';
        let uiCards: POI[] | undefined;

        if (fc.name === 'searchGooglePlaces') {
          const query = (fc.args as any).query;
          try {
            const places = await searchPlacesAsync(query);
            if (places.length > 0) {
              rawReply = `I found ${places.length} great ${places.length === 1 ? 'match' : 'matches'} for "${query}". Here are the results:`;
              uiCards = places.slice(0, 5);
            } else {
              rawReply = `I couldn't find any places matching "${query}". Try a different search term.`;
            }
          } catch {
            rawReply = `I found a match for "${query}":`;
            uiCards = [{
              id: 'search-' + Date.now(),
              title: { en: query, cs: query },
              category: 'Sightseeing',
              duration: 60,
              imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
            }];
          }
        } else if (fc.name === 'generateFullItinerary') {
          const desc = (fc.args as any).dayDescription;
          const num = (fc.args as any).numPlaces || 4;
          try {
            const places = await searchPlacesAsync(`${desc} in ${dest}`);
            if (places.length > 0) {
              rawReply = `Here's a ${desc} plan with ${Math.min(places.length, num)} activities. Drag them to your timeline or click + to add:`;
              uiCards = places.slice(0, num);
            } else {
              rawReply = `I couldn't find specific places for "${desc}" in ${dest}. Try being more specific.`;
            }
          } catch {
            rawReply = `I planned a "${desc}" day but couldn't fetch live data. Try searching manually in the Atlas.`;
          }
        } else if (fc.name === 'searchFlights') {
          const { origin, date } = fc.args as any;
          rawReply = `Here are flight options from ${origin} to ${dest} on ${date}. Note: For real-time pricing, check Google Flights or Skyscanner.`;
          uiCards = [{
             id: 'flight-' + Date.now(),
             title: { en: `${origin} ✈️ ${dest}`, cs: `${origin} ✈️ ${dest}` },
             description: { en: `Suggested departure: ${date}. Check Google Flights for live pricing.`, cs: `Navrhované datum odletu: ${date}.` },
             category: 'Transport',
             duration: 240,
             imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a615061c443?auto=format&fit=crop&q=80&w=800',
          }];
        } else if (fc.name === 'remove_from_itinerary') {
          const { dayIso, poiId } = fc.args as any;
          removePoi(dayIso, poiId);
          rawReply = `Okay, I've removed that activity from the trip plan.`;
        } else if (fc.name === 'trigger_smart_itinerary_generation') {
          const intensity = (fc.args as any)?.intensity || 'balanced';
          const notificationText = await ensureBilingualAsync(t('notification_smart'));
          setMessages(prev => [...prev, { role: 'model', text: notificationText }]);
          setIsChatLoading(false);
          handleSmartGeneration(intensity);
          return;
        } else if (fc.name === 'clear_day') {
          const { dayIso } = fc.args as any;
          await clearDay(dayIso);
          rawReply = `I have cleared the activities for that day.`;
        } else if (fc.name === 'clear_itinerary') {
          await clearItinerary();
          rawReply = `I have cleared the entire itinerary as requested.`;
        } else if (fc.name === 'update_itinerary') {
          const { request } = fc.args as any;
          handleItineraryUpdate(request);
          return; // handleItineraryUpdate handles the model reply
        }

        const replyText = await ensureBilingualAsync(rawReply);
        setMessages(prev => [...prev, { role: 'model', text: replyText, uiCards }]);
      } else {
        const reply = result.text ?? "I'm ready to help with your trip!";
        const translatedReply = await ensureBilingualAsync(reply);
        setMessages(prev => [...prev, { role: 'model', text: translatedReply }]);
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      const errorMsg = await ensureBilingualAsync(`❌ Error: ${err.message || 'Something went wrong.'}`);
      setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, getJsonContext, messages, lang, activeTrip]);

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
      if (data.type === 'trigger_smart_itinerary_generation') {
        await handleSmartGeneration(data.intensity);
        return;
      }
      if (!data.day || data.day < 1) return;
      const startAt = new Date(activeTrip.startDate);
      startAt.setHours(0, 0, 0, 0); 
      const targetDate = new Date(startAt);
      targetDate.setDate(startAt.getDate() + (data.day - 1));
      const dayIso = toLocalIso(targetDate);
      const bActivity = await ensureBilingualAsync(data.activity);
      const bDescription = data.description ? await ensureBilingualAsync(data.description) : { en: 'Added by Sára.', cs: 'Přidáno Sárou.' };
      
      let newActivity: POI = {
        id: 'voice-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: bActivity,
        description: bDescription,
        category: (data.category as Category) || 'Sightseeing',
        duration: 60,
        imageUrl: `https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&w=800&q=80`,
        address: data.activity,
      };
      try {
        const query = `${data.activity} ${activeTrip.destination}`;
        const searchResults = await searchPlacesAsync(query);
        if (searchResults && searchResults.length > 0) {
          const matchCandidate = searchResults[0]; 
          newActivity = { ...newActivity, ...matchCandidate, id: 'voice-' + Date.now() + '-' + matchCandidate.id };
        }
      } catch (err) { console.warn('Failed to enrich voice activity:', err); }
      try {
        await addPoi(dayIso, newActivity);
        const notificationMsg = await ensureBilingualAsync(`Added "${data.activity}" to Day ${data.day}`);
        setNotification(`Sára: ${translate(notificationMsg, lang)}`);
      } catch (err: any) {
        setNotification(`❌ Error adding to itinerary: ${err.message || 'Firestore call failed'}`);
        throw err;
      }
    },
    onRemoveFromItinerary: async (data) => {
      if (!activeTrip || !data.day || data.day < 1) return;
      const startAt = new Date(activeTrip.startDate);
      startAt.setHours(0, 0, 0, 0); 
      const targetDate = new Date(startAt);
      targetDate.setDate(startAt.getDate() + (data.day - 1));
      const dayIso = toLocalIso(targetDate);
      const dayPois = itinerary[dayIso];
      if (dayPois && dayPois.length > 0) {
        const searchTerm = data.activity.toLowerCase();
        const targetPoi = dayPois.find(p => p.title.en.toLowerCase().includes(searchTerm) || (p.title.cs && p.title.cs.toLowerCase().includes(searchTerm))) || dayPois[dayPois.length - 1];
        if (targetPoi) {
          removePoi(dayIso, targetPoi.id);
          setNotification(`Sára: Removed "${targetPoi.title.en}" from Day ${data.day}`);
        } else { throw new Error('Activity not found on this day.'); }
      } else { throw new Error('No activities are scheduled for this day.'); }
    },
    onClearDay: async (data) => {
      if (!activeTrip || !data.day || data.day < 1) return;
      const startAt = new Date(activeTrip.startDate);
      startAt.setHours(0, 0, 0, 0); 
      const targetDate = new Date(startAt);
      targetDate.setDate(startAt.getDate() + (data.day - 1));
      const dayIso = toLocalIso(targetDate);
      await clearDay(dayIso);
      setNotification(`Sára: Cleared Day ${data.day}`);
    },
    onClearItinerary: async () => {
      if (!activeTrip) return;
      await clearItinerary();
      setNotification(`Sára: Cleared entire itinerary`);
    },
    onUpdateTripDetails: (data) => {
      if (activeTrip?.id) {
        updateTrip(activeTrip.id, data);
        setNotification(t('notification_updated'));
      }
    },
    onTriggerSmartItinerary: (intensity) => {
      handleSmartGeneration(intensity);
    },
    onShowUICard: (card) => {
      const msg = {
        en: 'Here is what I found for you:',
        cs: 'Tady je, co jsem pro vás našla:'
      };
      setMessages(prev => [...prev, { role: 'model', text: msg, uiCards: [card] }]);
    },
    onUploadDoc: handleFileUpload
  });



  // Sára's high-fidelity state machine (synced with landing page)
  const saraState = useSaraState({
    callStatus,
    voiceVolume,
    remoteVoiceVolume,
    isVoiceActive,
    isChatLoading,
    isChatOpen: messages.length > 0
  });

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  if (!activeTripId || !activeTrip) {
    return (
      <APIProvider apiKey={mapsApiKey} libraries={['places', 'routes']}>
        <LandingPage 
          trips={trips} 
          onCreateTrip={createTrip} 
          onSelectTrip={setActiveTripId} 
          onDeleteTrip={deleteTrip}
          lang={lang} 
          theme={theme}
          onThemeToggle={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
        />
      </APIProvider>
    );
  }

  return (
    <APIProvider apiKey={mapsApiKey} libraries={['places', 'routes']}>
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`flex flex-col-reverse md:flex-row h-screen w-full font-sans transition-colors duration-700 overflow-hidden ${theme === 'dark' ? 'bg-[#030712] text-slate-100 selection:bg-emerald-500/40' : 'bg-[#FCFCFD] text-slate-900 selection:bg-emerald-500/10'}`}>

        {/* Global Loading Overlay Removed */}

        {/* LEFT PANEL: Chat + Timeline */}
        <div className={`w-full h-1/2 md:h-full md:w-[450px] lg:w-[500px] border-r border-t md:border-t-0 flex flex-col relative z-20 flex-shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] overflow-y-auto rounded-t-[2rem] md:rounded-none transition-colors duration-700 ${theme === 'dark' ? 'bg-[#0B0F1A] border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]' : 'bg-white border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]'}`} style={{ scrollbarWidth: 'none' }}>
           
            <TopBar 
              trip={activeTrip} 
              lang={lang} 
              setLang={setLang} 
              currency={currency} 
              setCurrency={setCurrency} 
              rates={rates}
              theme={theme}
              onThemeToggle={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
              onExit={() => setActiveTripId(null)}
              onUpdate={(data) => updateTrip(activeTrip.id, data)}
            />

            <div className="h-16 flex-shrink-0" /> {/* Spacer for TopBar */}
           
           {/* Timeline Header - Simplified because TopBar handles most info */}
           <div className={`p-6 border-b flex-shrink-0 transition-colors duration-700 ${theme === 'dark' ? 'border-white/5 bg-[#0B0F1A]' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-xl font-black uppercase tracking-tighter transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-[#0F172A]'}`}>{activeTrip?.destination}</h3>
                </div>
                <div className="flex flex-col items-end text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className={`text-[10px] font-bold tracking-widest transition-colors duration-500 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600 uppercase'}`}>{TEXTS['syncing_sara']?.[lang] || 'Syncing with Sára'}</p>
                  </div>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{callStatus === 'connected' ? (TEXTS['live_on_call']?.[lang] || 'Live on Call') : (TEXTS['online_ready']?.[lang] || 'Online & Ready')}</p>
                </div>
              </div>
           </div>

           {/* CHAT INTERFACE INLINE */}
           <div className={`p-4 border-b flex-shrink-0 transition-colors duration-500 ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
             <div className="flex items-center gap-3 mb-4 px-2">
                <div className="relative group cursor-pointer">
                  <CharacterAvatar 
                    src={saraState.imageSrc} 
                    alt="Sara" 
                    size="sm" 
                    animation={saraState.animation} 
                    speechBubble={saraState.speechBubble}
                    interactive
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
                </div>
                <div>
                  <h4 className={`font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{TEXTS['sara_voice']?.[lang] || 'Sara Voice Assistant'}</h4>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{callStatus === 'connected' ? (TEXTS['live_on_call']?.[lang] || 'Live on Call') : (TEXTS['online_ready']?.[lang] || 'Online & Ready')}</p>
               </div>
             </div>
             
             {/* Chat Messages */}
             <div 
                ref={chatContainerRef}
                className={`space-y-3 mb-4 max-h-[300px] overflow-y-auto p-2 rounded-2xl border transition-all duration-500 ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}
              >
                {messages.length === 0 && (
                  <p className={`text-xs p-4 text-center ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{TEXTS['ask_destination']?.[lang] || 'Ask me anything about the destination — weather, tips, route suggestions, restaurants.'}</p>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-emerald-500 text-slate-950 font-black rounded-br-sm shadow-emerald-500/20' : (theme === 'dark' ? 'bg-white/10 text-white rounded-bl-sm border border-white/10' : 'bg-white text-slate-900 rounded-bl-sm border border-slate-200 shadow-sm')}`}>
                        {translate(msg.text, lang)}
                      </div>
                      {msg.uiCards?.map(card => (
                        <div key={card.id} className={`w-[90%] border border-emerald-500/30 p-2 rounded-xl flex items-center gap-3 shadow-xl relative overflow-hidden group ml-2 mb-2 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
                           <img src={card.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                           <div className="flex-1 min-w-0">
                              <h4 className={`font-black text-xs truncate ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{card.title[lang] || card.title.en}</h4>
                              <p className={`text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/50' : 'text-slate-400'}`}>{card.category}</p>
                           </div>
                           <button 
                             onClick={() => {
                               addPoi(days[safeActiveDayIdx].toISOString().split('T')[0], card);
                               setNotification(t('notification_added'));
                             }}
                             className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-all"
                             title="Add to Itinerary"
                           ><Plus className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className={`rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-2 border ${theme === 'dark' ? 'bg-white/10 border-white/10' : 'bg-slate-200 border-slate-300'}`}>
                      <Loader2 className={`w-3 h-3 animate-spin ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      <span className={`text-[10px] ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>{t('chat_thinking')}</span>
                    </div>
                  </div>
                )}
                {isVoiceActive && (
                  <div className={`p-3 rounded-xl flex flex-col justify-center items-center gap-2 border ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-500/5 border-blue-200'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`}>{callStatus}</span>
                    </div>
                    <p className={`text-[9px] italic ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Sára is listening...</p>
                  </div>
                )}
                <div ref={chatEndRef} />
             </div>

             {/* Chat Inputs */}
             <div className="flex gap-2 isolate">
                <button onClick={() => isVoiceActive ? stopCall() : startCall()} className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isVoiceActive ? 'bg-blue-600 border-blue-500 text-white' : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-emerald-600')}`}>
                    {isVoiceActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsListening(!isListening)} className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isListening ? 'bg-red-500 border-red-500 text-white animate-pulse' : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-emerald-600')}`}>
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <div className="w-px h-10 bg-white/10 mx-1" />
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-emerald-600'}`}
                    title="Upload Reference Document"
                >
                    <Paperclip className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  accept=".txt,.md,.pdf,.doc,.docx"
                />
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={handleChatKeyDown} placeholder={t('chat_placeholder')} className={`flex-1 border rounded-xl px-3 py-2 text-xs outline-none transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50' : 'bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500/50'}`}/>
                <button 
                  onClick={handleSendMessage} 
                  disabled={!chatInput.trim() || isChatLoading} 
                  className={`w-10 h-10 flex-shrink-0 bg-emerald-500 text-slate-950 font-black rounded-xl flex items-center justify-center disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 hover:shadow-emerald-400/40`}
                >
                  <Send className="w-4 h-4" />
                </button>
             </div>
           </div>

           {/* THE MASTER TIMELINE */}
           <div className="p-4 flex-1">
             <div className="flex items-center justify-between mb-4 px-2">
                <h4 className={`font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-slate-400'}`}>{t('itinerary_label')}</h4>
                <div className={`text-[10px] font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{days.length} {t('days_count')}</div>
             </div>

             <WeatherWidget destination={activeTrip.destination || 'Azores'} startDate={activeTrip.startDate} theme={theme} lang={lang} />

             {/* INSPIRATION VIDEOS (Instagram Reel style) */}
             <div className="mb-10 mt-2 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                    <Sparkles className="w-3 h-3" /> {t('inspiration_title')}
                  </h3>
                  <a 
                    href="https://www.instagram.com/explore/tags/azores/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {t('view_on_instagram')} →
                  </a>
                </div>
                 <div className="flex gap-6 overflow-x-auto pb-8 snap-x scrollbar-hide mask-fade-right">
                    {(() => {
                      const displayVideos = activeTrip?.inspirationVideos || [];

                      if (displayVideos.length === 0) {
                         return [1,2,3,4].map(i => (
                           <div key={i} className={`relative flex-shrink-0 w-44 h-72 rounded-3xl border animate-pulse flex items-center justify-center overflow-hidden ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                              <div className={`text-[10px] font-black uppercase tracking-widest text-center px-6 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>Discovering...</div>
                           </div>
                         ));
                      }

                      return displayVideos.map(v => (
                       <div key={v.id} className="relative flex-shrink-0 w-44 h-72 rounded-3xl overflow-hidden snap-center group border border-white/5 hover:border-emerald-500/50 transition-all duration-500 shadow-xl">
                         <video 
                           src={v.video} 
                           poster={v.thumbnail}
                           autoPlay 
                           muted 
                           loop 
                           playsInline
                           className="absolute inset-0 w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000"
                         />
                       </div>
                     ));
                    })()}
                 </div>
             </div>

             <div className="space-y-6 pb-20">
                {days.map((date, idx) => {
                  const dayIso = toLocalIso(date);
                  return (
                    <div key={dayIso} onClick={() => {setActiveDayIdx(idx); setShowAllDays(false);}} className={`cursor-pointer transition-all ${activeDayIdx === idx ? 'ring-2 ring-emerald-500/50 rounded-[3.5rem]' : 'opacity-60 hover:opacity-100'}`}>
                      <VerticalTimelineDay 
                        date={date} 
                        lang={lang} 
                        items={itinerary[dayIso] || []} 
                        onRemove={(poiId) => removePoi(dayIso, poiId)} 
                        onModeChange={(poiId, mode) => updatePoiTransportMode(dayIso, poiId, mode)}
                        onSelect={setSelectedPoi}
                        destination={activeTrip?.destination || 'Azores'}
                        tripStartDate={activeTrip?.startDate}
                        theme={theme}
                        currency={currency}
                        rates={rates}
                      />
                    </div>
                  );
                })}
             </div>
           </div>
        </div>

        {/* RIGHT PANEL: Map / Library */}
        <div className={`flex-1 relative h-1/2 md:h-full transition-colors duration-700 ${theme === 'dark' ? 'bg-zinc-950' : 'bg-[#FCFCFD]'}`}>
            
            {/* Top Actions overlay - Moved down to avoid TopBar overlap */}
            <div className="absolute top-20 right-6 z-30 flex items-center gap-3">
               <button 
                 onClick={() => {
                   const link = generateGoogleMapsDirectionsUrl(activeDayItems);
                   if (link) window.open(link, '_blank');
                 }}
                 disabled={!activeDayItems.filter(p => p.location).length}
                 className="px-4 py-3 bg-blue-600 disabled:opacity-30 text-white font-black rounded-2xl flex items-center gap-2 text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl"
               >
                 <Navigation className="w-3 h-3" /> {t('directions')}
               </button>
               <button 
                  onClick={() => setShowStaysManager(true)} 
                  className={`px-4 py-3 bg-white/10 text-white font-black rounded-2xl flex items-center gap-2 text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all shadow-xl border border-white/20 backdrop-blur-xl ${activeTrip?.logistics?.stays?.length ? 'border-emerald-500/50' : ''}`}
                >
                 <Hotel className={`w-3 h-3 ${activeTrip?.logistics?.stays?.length ? 'text-emerald-400' : 'text-white/40'}`} /> {t('stays_btn')} {activeTrip?.logistics?.stays?.length ? `(${activeTrip.logistics.stays.length})` : ''}
               </button>

               <button 
                onClick={() => setShowPackingChecklist(true)} 
                className={`px-4 py-3 font-black rounded-2xl flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all shadow-xl border backdrop-blur-xl
                  ${packingComplete 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
               >
                 <div className={`w-2 h-2 rounded-full ${packingComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-amber-500 animate-pulse'}`} />
                 {t('packing_btn')} {packingComplete ? t('packing_ready') : t('packing_in_progress')}
               </button>
               <button onClick={() => setShowAllDays(p => !p)} className={`px-4 py-3 font-black rounded-2xl flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all shadow-xl ${showAllDays ? 'bg-white text-slate-900 shadow-emerald-500/20' : (theme === 'dark' ? 'bg-slate-900/80 text-white border border-white/20 backdrop-blur-xl' : 'bg-slate-900 text-white border border-slate-950')}`}>
                 <Globe className="w-3 h-3" /> {showAllDays ? t('single_day') : t('all_days')}
               </button>
               <button onClick={() => setIsLibraryOpen(p => !p)} className="px-4 py-3 bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center gap-2 text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20">
                 <Plus className="w-3 h-3" /> {isLibraryOpen ? t('close_atlas') : t('open_atlas')}
               </button>
            </div>


           {/* Main Google Map View */}
            <div className={`w-full h-full pt-16 md:rounded-[3rem] overflow-hidden shadow-2xl border transition-all duration-700 relative ${theme === 'dark' ? 'bg-zinc-950 border-white/10' : 'bg-white border-slate-200'}`}>
              <GoogleMapView 
                activeDayItems={activeDayItems} 
                allDaysData={allDaysData} 
                showAllDays={showAllDays} 
                activeDayIdx={activeDayIdx} 
                activeDayIso={currentIso} 
                lang={lang} 
                onPoiClick={setSelectedPoi} 
                hoveredPoiId={hoveredPoiId} 
                onMarkerHover={setHoveredPoiId}
                allPois={[...allAvailablePois, ...atlasSearchResults]} 
                tripDestination={activeTrip?.destination}
                onAddToDay={(poi) => { addPoi(currentIso, poi); }} 
                showAtlasMarkers={isLibraryOpen}
                theme={theme}
              />
           </div>

           {/* LIBRARY DRAWER */}
           <AnimatePresence>
             {isLibraryOpen && (
               <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className={`absolute top-16 right-0 h-[calc(100%-4rem)] w-full sm:w-[400px] z-40 backdrop-blur-3xl border-l shadow-2xl p-6 flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0F172A]/95 border-white/10 shadow-black' : 'bg-white/95 border-slate-200 shadow-slate-200'}`}>
                  {/* Reuse existing library UI but scaled down */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className={`text-xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-[#0F172A]'}`}>{t('atlas_title')}</h3>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{activeTrip?.destination || 'Global'} • {allAvailablePois.length} {t('places_count')}</p>
                    </div>
                    <button onClick={() => setIsLibraryOpen(false)} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                  
                  {/* Places Search */}
                  <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">{t('search_places_title')}</h4>
                     <form onSubmit={e => { e.preventDefault(); const q = activeTrip?.destination ? `${atlasQuery} in ${activeTrip.destination}` : atlasQuery; doAtlasSearch(q, undefined, searchInBounds); }} className="flex gap-2">
                       <input 
                         type="text"
                         value={atlasQuery}
                         onChange={e => setAtlasQuery(e.target.value)}
                         placeholder={`${t('search_placeholder_dest')} ${activeTrip?.destination || 'anywhere'}...`}
                         className={`flex-1 border-2 rounded-xl px-4 py-3 text-[11px] outline-none transition-all shadow-inner font-bold ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 text-white placeholder:text-white/20 focus:border-emerald-500/30' : 'bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-emerald-200'}`}
                       />
                       <button 
                        type="submit"
                        disabled={!atlasQuery.trim() || isAtlasSearching}
                        className="px-3 py-2 bg-emerald-500 text-slate-950 font-black rounded-lg text-[10px] hover:bg-emerald-400 transition-all disabled:opacity-40"
                      >
                        {isAtlasSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      </button>
                    </form>
                    <label className="flex items-center gap-2 mt-2">
                      <input type="checkbox" checked={searchInBounds} onChange={e => setSearchInBounds(e.target.checked)} className="accent-emerald-500" />
                      <span className="text-[9px] text-emerald-400 font-bold uppercase">{t('search_visible_only')}</span>
                    </label>
                  </div>

                  {/* Search Results Section */}
                  {atlasSearchResults.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Search Results ({atlasSearchResults.length})</h4>
                        <button onClick={clearAtlasResults} className="text-[9px] text-white/40 hover:text-white/70 transition-colors">Clear</button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                        {atlasSearchResults.map(poi => (
                          <div key={poi.id} className={`p-3 rounded-2xl flex items-center gap-3 group transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                            <img 
                              src={poi.imageUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=200&q=60'} 
                              alt="" 
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-xs text-white truncate">{poi.title[lang] || poi.title.en}</h5>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-blue-400 font-bold">{poi.category}</span>
                                {poi.rating && <span className="text-[9px] text-amber-400">★ {poi.rating}</span>}
                              </div>
                              {poi.address && <p className="text-[8px] text-white/30 truncate mt-0.5">{poi.address}</p>}
                            </div>
                            <div className="flex flex-col gap-1">
                              <button 
                                onClick={() => { addPoi(currentIso, poi); setNotification(`Added ${poi.title[lang] || poi.title.en} to Day ${safeActiveDayIdx + 1}`); }}
                                className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                                title={`Add to Day ${safeActiveDayIdx + 1}`}
                              ><Plus className="w-3 h-3" /></button>
                  <button 
                                onClick={() => setSelectedPoi(poi)}
                                className="p-1.5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                                title="View details"
                              ><ExternalLink className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {atlasSearchError && (
                    <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-400 text-center">
                      {atlasSearchError}
                    </div>
                  )}

                   {/* Library section header */}
                   <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 text-left ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Library</h4>

                  {/* Tab filters */}
                   <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                     {libraryTabs.map(tab => (
                       <button 
                         key={tab} 
                         onClick={() => setActiveTab(tab)} 
                         className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex-shrink-0 transition-all border ${
                           activeTab === tab 
                             ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.3)]' 
                             : (theme === 'dark' ? 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/70' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-white hover:border-slate-200')
                         }`}
                       >
                         {tab}
                       </button>
                     ))}
                   </div>
                  
                  {/* POI List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2" style={{ scrollbarWidth: 'none' }}>
                    {filteredPois.map(poi => (
                      <DraggablePoi key={poi.id} poi={poi} lang={lang} onSelect={setSelectedPoi} onHover={setHoveredPoiId} theme={theme} />
                    ))}
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

        </div>

        {/* NOTIFICATIONS & MODALS */}
        <AnimatePresence>
          {showPackingChecklist && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowPackingChecklist(false)}>
              <PackingChecklist 
                tripId={activeTripId}
                isOpen={true}
                lang={lang}
                destination={activeTrip?.destination}
                startDate={activeTrip?.startDate}
                endDate={activeTrip?.endDate}
                travelersCount={activeTrip?.travelers || 1}
                travelerProfiles={activeTrip?.travelerProfiles || []}
                packingRequirements={activeTrip?.logistics?.packingRequirements}
                onClose={() => setShowPackingChecklist(false)}
                onComplete={() => {
                  setPackingComplete(true);
                  setNotification(TEXTS.packing_complete[lang] || 'All packed!');
                }}
                theme={theme}
              />
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStaysManager && activeTrip && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
                onClick={() => setShowStaysManager(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 w-full max-w-5xl"
              >
                <StaysManager 
                  trip={activeTrip} 
                  lang={lang}
                  currency={currency}
                  rates={rates}
                  apiKey={mapsApiKey}
                  onUpdate={async (stays) => {
                    const updatedItinerary = syncStaysToItinerary(stays, activeTrip.itinerary || {});
                    await updateTrip(activeTrip.id, { 
                      itinerary: updatedItinerary,
                      logistics: { ...activeTrip.logistics, stays } 
                    });
                  }}
                  onAddStayToItinerary={(stay) => {
                    addPoi(stay.checkInDate, {
                      id: `checkin-${stay.id}`,
                      title: { en: `Check-in: ${stay.name}`, cs: `Check-in: ${stay.name}` },
                      category: 'Special',
                      fixed: true,
                      time: '15:00',
                      duration: 30,
                      imageUrl: stay.imageUrl,
                      location: stay.location,
                      description: { en: `Check-in time`, cs: `Čas příjezdu` },
                      address: stay.address
                    });
                    addPoi(stay.checkOutDate, {
                      id: `checkout-${stay.id}`,
                      title: { en: `Check-out: ${stay.name}`, cs: `Check-out: ${stay.name}` },
                      category: 'Special',
                      fixed: true,
                      time: '10:00',
                      duration: 30,
                      imageUrl: stay.imageUrl,
                      location: stay.location,
                      description: { en: `Check-out time`, cs: `Čas odjezdu` },
                      address: stay.address
                    });
                  }}
                  onClose={() => setShowStaysManager(false)} 
                  theme={theme}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedPoi && (
            <PoiDetailModal 
              poi={selectedPoi} 
              lang={lang} 
              onClose={() => setSelectedPoi(null)} 
              onAdd={() => { addPoi(days[safeActiveDayIdx].toISOString().split('T')[0], selectedPoi); setSelectedPoi(null); }} 
              activeDayIndex={safeActiveDayIdx} 
              theme={theme}
              currency={currency}
              rates={rates}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/50">
              <MapPin className="w-4 h-4" />{notification}
            </motion.div>
          )}
        </AnimatePresence>

        <DragOverlay zIndex={1000}>
          {activeId && activeDragData ? (
             <div className={`p-4 rounded-[2rem] border-2 shadow-2xl flex items-center gap-4 transition-all scale-105 ${theme === 'dark' ? 'bg-slate-900 border-emerald-500 text-white' : 'bg-white border-emerald-500 text-slate-900'}`} style={{ width: 300 }}>
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
    </APIProvider>
  );
}
