import React, { useState, useEffect, useMemo } from 'react';
import { Trip } from '../data';
import { usePlannerChat } from '../hooks/usePlannerChat';
import { PlannerChat } from './PlannerChat';
import { SaraAssistant } from './characters/SaraAssistant';
import { TreasureHuntGame } from './characters/TreasureHuntGame';
import { useLiveGemini } from '../hooks/useLiveGemini';
import { geminiKeyManager } from '../utils/geminiKeyManager';
import { MapPin, Calendar, Users, Plane, Sparkles, Trash2, ChevronRight, Compass, ArrowRight, Mic, MicOff, Phone, PhoneOff, Volume2, Hotel, Layout, MessageSquare, Plus, Minus, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TEXTS } from '../data';
import { createT } from '../utils/i18n';

interface LandingPageProps {
  trips: Trip[];
  onCreateTrip: (tripData: Partial<Trip>) => Promise<string>;
  onSelectTrip: (tripId: string) => void;
  onDeleteTrip: (tripId: string) => Promise<void>;
  lang: string;
  onLanguageToggle: (lang: string) => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export function LandingPage({ trips, onCreateTrip, onSelectTrip, onDeleteTrip, lang, onLanguageToggle, theme, onThemeToggle }: LandingPageProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [kidsAges, setKidsAges] = useState<number[]>([]);
  const [preferences, setPreferences] = useState('');
  const [stays, setStays] = useState<any[]>([]);
  const [previewDays, setPreviewDays] = useState<Record<string, any>>({});
  
  const [isCreating, setIsCreating] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [remoteVoiceVolume, setRemoteVoiceVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [plannerInput, setPlannerInput] = useState('');
  const [planningMode, setPlanningMode] = useState<'full' | 'suggestions_only'>('full');
  
  const [showTreasureHunt, setShowTreasureHunt] = useState(false);
  const [treasureHuntComplete, setTreasureHuntComplete] = useState(false);
  const [saraAwake, setSaraAwake] = useState(false);
  const [saraHasWaved, setSaraHasWaved] = useState(false);
  const [travelerProfiles, setTravelerProfiles] = useState<any[]>([]);
  const [packingRequirements, setPackingRequirements] = useState<string[]>([]);
  const [referenceDocs, setReferenceDocs] = useState<{name: string, content: string}[]>([]);
  
  const handleKidsChange = (val: number) => {
    setKids(val);
  };

  // Speech-To-Text implementation
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) return;
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'cs' ? 'cs-CZ' : 'en-US';

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setPlannerInput(text);
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
  
  const [pulsingField, setPulsingField] = useState<string | null>(null);

  const triggerPulse = (field: string) => {
    setPulsingField(field);
    setTimeout(() => setPulsingField(null), 2000);
  };

  const handleDataExtracted = (data: any) => {
    if (data.destination && data.destination !== destination) {
        setDestination(data.destination);
        triggerPulse('destination');
    }
    if (data.startDate && data.startDate !== startDate) {
        setStartDate(data.startDate);
        triggerPulse('startDate');
    }
    if (data.endDate && data.endDate !== endDate) {
        setEndDate(data.endDate);
        triggerPulse('endDate');
    }
    if (data.adults !== undefined && data.adults !== adults) {
        setAdults(data.adults);
        triggerPulse('travelers');
    }
    if (data.kids !== undefined && data.kids !== kids) {
        setKids(data.kids);
        triggerPulse('travelers');
    }
    if (data.kidsAges) {
        setKidsAges(data.kidsAges);
    }
    if (data.preferences && data.preferences !== preferences) {
        setPreferences(data.preferences);
    }
    if (data.planningMode && (data.planningMode === 'full' || data.planningMode === 'suggestions_only')) {
        setPlanningMode(data.planningMode);
    }
    if (data.travelers && Array.isArray(data.travelers)) {
        setTravelerProfiles(data.travelers);
    }
    if (data.packingRequirements && Array.isArray(data.packingRequirements)) {
        setPackingRequirements(data.packingRequirements);
    }
    if (data.stays) setStays(data.stays);
    if (data.previewDays) setPreviewDays(data.previewDays);
  };

  const handleUploadDoc = async (file: File) => {
    try {
      const text = await file.text();
      setReferenceDocs(prev => [...prev, { name: file.name, content: text }]);
      setMessages(prev => [...prev, { role: 'user', text: `[System: Uploaded "${file.name}"]` }]);
      setMessages(prev => [...prev, { role: 'model', text: `I've received "${file.name}". I can use it to help plan your trip!` }]);
    } catch (err) {
      console.error(err);
    }
  };

  const architectInstruction = useMemo(() => `You are "Sara," an intelligent and friendly travel assistant.
    Guide the traveler through setting up their trip with a warm, inviting personality.
    Mandatory: Destination, Start/End Dates, Traveler Details (Adults, Kids, Kids' Ages).
    Current Team: ${adults} Adults, ${kids} Kids.
    Destination: ${destination || 'Not set'}
    Dates: ${startDate || 'Not set'} to ${endDate || 'Not set'}
    If they have kids, ask for their ages to suggest appropriate activities.
    Address the user by their name if they introduce themselves, otherwise be generically friendly.
    
    CRITICAL INSTRUCTIONS:
    1. MULTILINGUAL: Always respond in the EXACT SAME LANGUAGE as the user speaks to you. If the user speaks Czech (e.g. says "Ahoj Saro"), you MUST respond ENTIRELY in Czech. Do not switch back to English.
    2. REAL-TIME UPDATES: AS SOON AS the user provides ANY trip details (like destination, dates, or number of travelers), YOU MUST IMMEDIATELY CALL the update_trip_details tool to update the UI. Do not wait until the end of the sentence or turn. If they change their mind, call it again immediately.
    3. PLAN TRIGGER: Once you have gathered sufficient information and the user asks you to create the plan, plan the trip, or "naplánovat itinerář", YOU MUST CALL the trigger_smart_itinerary_generation tool. This will automatically transition the user to the detailed view and start the heavy lifting. DO NOT just say you will do it - YOU MUST CALL THE TOOL.
    4. CLEARING DATA: If the user says "clear everything", "reset it", or "start over", YOU MUST CALL update_trip_details with all fields null to reset the form.
    5. IGNORE BACKGROUND NOISE: If you hear random fragments like "That's how" or unclear murmurs without a clear question, gently ignore them or ask "Můžete to zopakovat?" in the matching language.`, [adults, kids, destination, startDate, endDate]);

  const { messages, setMessages, loading, sendMessage, resetChat, extractedParams, getConversationSummary, getOriginalRequest } = usePlannerChat({
    onDataExtracted: handleDataExtracted,
    onReadyToLaunch: (mode, intensity) => {
        localStorage.setItem('auto_generate_smart_itinerary', 'true');
        if (intensity) localStorage.setItem('smart_itinerary_intensity', intensity);
        handleCreate({ preventDefault: () => {} } as any, mode || 'full');
    },
    systemInstruction: architectInstruction
  });

  const { isActive: isVoiceActive, startCall, stopCall } = useLiveGemini({
    systemInstruction: architectInstruction,
    lang: lang,
    onStatusChange: setCallStatus,
    onVolumeChange: setVoiceVolume,
    onRemoteVolumeChange: setRemoteVoiceVolume,
    onMessage: (text) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
          return [...prev.slice(0, -1), { ...last, text: last.text + text }];
        }
        return [...prev, { role: 'model', text }];
      });
    },
    onUpdateTripDetails: handleDataExtracted,
    onUpdateItinerary: async (data: any) => {
        if (data.type === 'set_trip_details') handleDataExtracted(data);
        if (data.type === 'launch_itinerary') {
            handleCreate({ preventDefault: () => {} } as any, data.planningMode || 'full');
            stopCall();
        }
    },
    onTriggerSmartItinerary: (intensity) => {
        localStorage.setItem('auto_generate_smart_itinerary', 'true');
        if (intensity) localStorage.setItem('smart_itinerary_intensity', intensity);
        handleCreate({ preventDefault: () => {} } as any, 'full');
        stopCall();
    },
    onUserMessage: (text, isFinal) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'user') {
          return [...prev.slice(0, -1), { ...last, text }];
        }
        return [...prev, { role: 'user', text }];
      });
    },
    onUploadDoc: handleUploadDoc
  });


  // Removed automatic intro message logic to allow blank start as requested by user.


  const isReadyToLaunch = !!(destination && startDate && endDate);
  const alignmentPercent = [destination, startDate, endDate, adults > 0].filter(Boolean).length * 25;

  const handleCreate = async (e: React.FormEvent, forcedMode?: 'full' | 'suggestions_only') => {
    e.preventDefault();
    if (!destination || !startDate || !endDate) return;
    setIsCreating(true);
    
    const themes: Record<string, string> = {};
    Object.entries(previewDays).forEach(([k, v]: [string, any]) => { themes[k] = v.theme; });

    // Build conversation history for persistence
    const chatHistory = messages.map(m => ({
      role: m.role === 'model' ? 'assistant' as const : 'user' as const,
      text: m.text,
      timestamp: new Date().toISOString()
    }));

    const finalMode = forcedMode || planningMode;

    const tripId = await onCreateTrip({
      title: `${destination} Trip`,
      destination,
      startDate,
      endDate,
      travelers: adults + kids,
      adults,
      kids,
      kidsAges,
      preferences,
      planningMode: finalMode,
      logistics: { 
        flights: [], 
        stays,
        packingRequirements: packingRequirements || [] 
      },
      dayThemes: themes,
      chatHistory,
      originalRequest: getOriginalRequest(),
      travelerProfiles: travelerProfiles || [],
      referenceDocs: referenceDocs
    });
    
    onSelectTrip(tripId);
    setIsCreating(false);
  };

  const t = createT(lang);

  return (
    <div className={`min-h-screen relative overflow-x-hidden font-sans transition-colors duration-500 pb-20 ${theme === 'dark' ? 'text-slate-100 selection:bg-emerald-500/30' : 'text-slate-900 selection:bg-emerald-500/10'}`}>
      {/* Background Layer */}
      <div className={`fixed inset-0 w-full h-full -z-10 transition-colors duration-1000 ${theme === 'dark' ? 'bg-zinc-950' : 'bg-[#FCFCFD]'}`}>
         {theme === 'dark' ? (
           <>
             <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />
             <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px]" />
           </>
         ) : (
           <>
             <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200/40 rounded-full blur-[120px]" />
             <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-100/40 rounded-full blur-[100px]" />
           </>
         )}
      </div>
      
      <div className="max-w-4xl mx-auto px-6 relative z-10 pt-20">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8 text-left">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-[1.25rem] border ${theme === 'dark' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                        <Compass className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {t('architecture')} Online
                      </span>
                    </div>
                </div>
                <div>
                    <h1 className={`text-6xl md:text-8xl uppercase tracking-tighter leading-[0.85] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        <span className="font-extrabold">SARA</span><span className="font-light text-emerald-500">{t('itinerary')}</span>
                    </h1>
                    <p className={`mt-8 font-bold tracking-[0.3em] text-[10px] uppercase ${theme === 'dark' ? 'text-emerald-500/60' : 'text-emerald-600/80'}`}>
                      {t('landing_subtitle')}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <p className={`text-[10px] font-black uppercase tracking-widest hidden md:block text-left ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>
                  {t('landing_readiness')}: {alignmentPercent}%
                </p>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                        const newLang = lang === 'en' ? 'cs' : 'en';
                        onLanguageToggle(newLang);
                    }}
                    className={`px-4 py-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {lang}
                  </button>
                  <button 
                    onClick={onThemeToggle}
                    className={`p-4 rounded-2xl border transition-all shadow-2xl group flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'}`}
                  >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                </div>
            </div>
        </div>

        {/* PLANNER PANEL */}
        <div className={`backdrop-blur-3xl border rounded-[3rem] transition-all duration-700 overflow-hidden mb-20 ${theme === 'dark' ? 'bg-zinc-950/80 border-white/5 shadow-2xl shadow-emerald-500/5' : 'bg-white border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] shadow-slate-200/50'}`}>
            
            {/* Status Progress */}
            <div className="h-1.5 w-full bg-white dark:bg-white/5 relative border-b border-slate-100 dark:border-white/5">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${alignmentPercent}%` }}
                    className="absolute top-0 left-0 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                />
            </div>

            <div className="p-8 md:p-12 space-y-12">
                {/* 1. Integrated Logistics */}
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Hotel className="w-4 h-4 text-emerald-500" />
                        <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('mission_logistics')}</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`p-6 rounded-[2rem] transition-all border ${pulsingField === 'destination' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 shadow-sm'}`}>
                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 ml-1 text-left ${theme === 'dark' ? 'text-white/30' : 'text-slate-500'}`}>{t('landing_destination_label')}</label>
                            <div className="flex items-center gap-4">
                                <MapPin className="text-emerald-500 h-6 w-6" />
                                <input 
                                    type="text"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                    placeholder={t('landing_destination_placeholder')}
                                    className={`bg-transparent border-none text-2xl font-black focus:ring-0 w-full p-0 flex text-left ${theme === 'dark' ? 'text-white placeholder-white/10' : 'text-slate-900 placeholder-slate-400'}`}
                                />
                            </div>
                        </div>

                        <div className={`p-6 rounded-[2rem] transition-all border ${pulsingField === 'startDate' || pulsingField === 'endDate' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 shadow-sm'}`}>
                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 ml-1 text-left ${theme === 'dark' ? 'text-white/30' : 'text-slate-500'}`}>{t('landing_timeframe_label')}</label>
                            <div className="flex items-center gap-4">
                                <Calendar className="text-emerald-500 h-6 w-6" />
                                <div className="flex items-center gap-2 flex-1">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`bg-transparent border-none text-sm font-black focus:ring-0 w-full p-0 text-left ${theme === 'light' ? 'text-slate-900' : 'text-white'}`} style={{ colorScheme: theme }} />
                                    <span className="text-slate-300 dark:text-white/20">→</span>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`bg-transparent border-none text-sm font-black focus:ring-0 w-full p-0 text-right ${theme === 'light' ? 'text-slate-900' : 'text-white'}`} style={{ colorScheme: theme }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`p-6 rounded-[2rem] transition-all border flex items-center justify-between shadow-sm ${pulsingField === 'travelers' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10'}`}>
                            <div className="pl-1 text-left">
                                <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${theme === 'dark' ? 'text-white/20' : 'text-slate-500'}`}>{t('adults')}</div>
                                <div className={`text-2xl font-black leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{adults}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAdults(Math.max(1, adults - 1))} className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${theme === 'dark' ? 'bg-white/10 border-white/10 hover:border-emerald-500/50 text-white' : 'bg-white border-slate-200 hover:border-emerald-500/50 text-slate-600'}`}><Minus size={18} /></button>
                                <button onClick={() => setAdults(adults + 1)} className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 active:scale-95"><Plus size={18} /></button>
                            </div>
                        </div>

                        <div className={`p-6 rounded-[2rem] transition-all border flex items-center justify-between shadow-sm ${pulsingField === 'travelers' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10'}`}>
                            <div className="pl-1 text-left">
                                <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${theme === 'dark' ? 'text-white/20' : 'text-slate-500'}`}>{t('kids')}</div>
                                <div className={`text-2xl font-black leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{kids}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleKidsChange(Math.max(0, kids - 1))} className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${theme === 'dark' ? 'bg-white/10 border-white/10 hover:border-emerald-500/50 text-white' : 'bg-white border-slate-200 hover:border-emerald-500/50 text-slate-600'}`}><Minus size={18} /></button>
                                <button onClick={() => handleKidsChange(kids + 1)} className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 active:scale-95"><Plus size={18} /></button>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence>
                        {kids > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="p-6 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2rem] overflow-hidden"
                            >
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 ml-1 text-left">{t('age_children')}</p>
                                <div className="flex flex-wrap gap-4">
                                    {kidsAges.map((age, i) => (
                                        <div key={i} className="flex flex-col gap-2">
                                            <span className="text-[9px] font-black text-slate-400 uppercase ml-1 flex text-left">C{i+1}</span>
                                            <input 
                                                type="number" min="0" max="17" value={age}
                                                onChange={e => {
                                                    const newAges = [...kidsAges];
                                                    newAges[i] = parseInt(e.target.value) || 0;
                                                    setKidsAges(newAges);
                                                }}
                                                className={`w-16 h-14 border rounded-2xl text-center font-black outline-none focus:border-emerald-500 shadow-sm transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 2. Architect Bridge */}
                <div className="pt-12 border-t border-slate-100 dark:border-white/5 relative">
                    
                    {/* Strategy Selector */}
                    <div className="mb-8 flex flex-col items-center">
                        <label className={`text-[10px] font-black uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-white/30' : 'text-slate-500'}`}>{t('planning_strategy')}</label>
                        <div className={`p-1 rounded-2xl flex gap-1 border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100/50 border-slate-200'}`}>
                            <button 
                                onClick={() => setPlanningMode('full')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all h-10 ${planningMode === 'full' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                            >
                                {t('strategy_full')}
                            </button>
                            <button 
                                onClick={() => setPlanningMode('suggestions_only')}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all h-10 ${planningMode === 'suggestions_only' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                            >
                                {t('strategy_suggestions')}
                            </button>
                        </div>
                        <p className={`mt-3 text-[10px] italic opacity-60 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                            {planningMode === 'full' 
                                ? t('strategy_full_desc')
                                : t('strategy_suggestions_desc')}
                        </p>
                    </div>

                    <SaraAssistant
                        callStatus={callStatus}
                        voiceVolume={voiceVolume}
                        remoteVoiceVolume={remoteVoiceVolume}
                        isVoiceActive={isVoiceActive}
                        isChatLoading={loading}
                        isChatOpen={messages.length > 0}
                        onCallClick={() => isVoiceActive ? stopCall() : startCall()}
                        onAvatarClick={() => {
                          setSaraAwake(true);
                          setSaraHasWaved(true);
                          setTimeout(() => {
                            setSaraAwake(false);
                          }, 3000);
                        }}
                        onSidekickClick={() => setShowTreasureHunt(true)}
                        packingComplete={treasureHuntComplete}
                        hasTrip={destination !== '' || trips.length > 0}
                        awakeMode={saraAwake}
                        theme={theme}
                        lang={lang}
                    />

                    <div className="mt-8">
                      <PlannerChat 
                          messages={messages} loading={loading} onSendMessage={sendMessage} onReset={resetChat} isReady={isReadyToLaunch}
                          onLaunch={() => handleCreate({ preventDefault: () => {} } as any)} lang={lang} isVoiceActive={isVoiceActive}
                          onToggleVoice={() => isVoiceActive ? stopCall() : startCall()} isListening={isListening}
                          onToggleListening={() => setIsListening(!isListening)} input={plannerInput} setInput={setPlannerInput}
                          onUploadDoc={handleUploadDoc}
                          theme={theme}
                      />
                    </div>
                </div>

                <TreasureHuntGame
                  isOpen={showTreasureHunt}
                  onClose={() => setShowTreasureHunt(false)}
                  onComplete={() => setTreasureHuntComplete(true)}
                  destination={destination || t('mystery_destination')}
                  theme={theme}
                  lang={lang}
                  apiKey={geminiKeyManager.getNextKey()}
                />

                {/* Launch Matrix */}
                <div className="pt-6">
                    <button 
                        onClick={handleCreate} disabled={isCreating || !isReadyToLaunch}
                        className={`w-full py-7 rounded-[2rem] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-2xl relative overflow-hidden group ${isReadyToLaunch ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 grayscale opacity-50 cursor-not-allowed shadow-none'}`}
                    >
                        {isCreating ? t('finalizing') : t('create_itinerary')}
                        <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
                    </button>
                    {!isReadyToLaunch && (
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-6">
                            {t('start_hint')}
                        </p>
                    )}
                </div>
            </div>
        </div>

        {/* ITINERARY ARCHIVE */}
        <section className="space-y-12">
            <div className="flex items-center justify-between px-4 text-left">
                <h2 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{t('recent_trips')}</h2>
                <div className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.4em]">{trips.length} {t('saved_count')}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {trips.length === 0 ? (
                    <div className="col-span-full py-24 flex flex-col items-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3.5rem] bg-white/40 dark:bg-white/5">
                        <Compass className="w-16 h-16 text-slate-200 dark:text-white/10 mb-6" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">{t('empty_logbook')}</p>
                    </div>
                ) : (
                    trips.map(trip => (
                        <motion.div
                            key={trip.id} whileHover={{ y: -8 }}
                            className={`group relative h-64 rounded-[2.5rem] overflow-hidden border transition-all flex flex-col justify-end p-8 cursor-pointer shadow-xl ${theme === 'dark' ? 'bg-zinc-950 border-white/5 hover:border-emerald-500/50 shadow-none' : 'bg-white border-slate-200 hover:border-emerald-500/50 shadow-slate-200/50'}`}
                            onClick={() => onSelectTrip(trip.id)}
                        >
                            {trip.inspirationVideos && trip.inspirationVideos.length > 0 ? (
                                <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000">
                                    <source src={trip.inspirationVideos[0].video} type="video/mp4" />
                                </video>
                            ) : (
                                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1596422846543-75c6fc197bf8?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center opacity-80 group-hover:opacity-100 transition-opacity duration-1000" />
                            )}
                            
                            <div className="relative z-30 flex flex-col h-full justify-between">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteTrip(trip.id); }}
                                    className="self-end p-3 bg-red-500/90 hover:bg-red-500 text-white rounded-2xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                >
                                    <Trash2 size={18} />
                                </button>
                                
                                <div className="space-y-1 text-left drop-shadow-md">
                                    <div className="flex gap-2 mb-1">
                                     <span className="px-3 py-1 bg-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-[0.1em] rounded-full backdrop-blur-md border border-emerald-500/30 shadow-sm">
                                          {trip.travelers} {t('travelers')}
                                      </span>
                                    </div>
                                    <h3 style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }} className="text-2xl font-black text-white group-hover:text-emerald-400 transition-colors tracking-tighter uppercase leading-tight">
                                        {trip.destination}
                                    </h3>
                                    <p style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }} className="text-[10px] text-white/80 font-bold uppercase tracking-widest">
                                        {trip.startDate} • {trip.endDate}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </section>
      </div>
    </div>
  );
}
