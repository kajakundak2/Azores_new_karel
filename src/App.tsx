import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { Cake, Calendar, ChevronRight, ExternalLink, Globe, Map as MapIcon, MessageSquare, Mic, Navigation, Plane, Plus, Search, Sparkles, Wind, X, GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { AZORES_POIS, FIXED_EVENTS, POI, SLIDES, TEXTS } from './data';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Slideshow = ({ isBlurred = false }: { isBlurred?: boolean }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full -z-20 overflow-hidden bg-slate-900 text-slate-100">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ${isBlurred ? 'blur-2xl scale-110 opacity-70' : 'opacity-90'}`}
          style={{ backgroundImage: `url('${SLIDES[current]}')` }}
        />
      </AnimatePresence>
      <div className={`absolute inset-0 bg-slate-950/20 transition-all duration-1000 ${isBlurred ? 'backdrop-blur-3xl bg-slate-950/40' : 'backdrop-blur-[2px]'}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/60" />
    </div>
  );
};

const SectionHeader = ({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: any }) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="flex flex-col items-center text-center mb-16 space-y-4"
  >
    {Icon && (
      <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/20 mb-2 shadow-2xl">
        <Icon className="w-8 h-8 text-emerald-400" />
      </div>
    )}
    <h2 className="text-4xl sm:text-7xl font-black text-white tracking-tighter uppercase drop-shadow-2xl">{title}</h2>
    {subtitle && <p className="text-emerald-400 font-black tracking-[0.4em] text-xs uppercase">{subtitle}</p>}
    <div className="w-24 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
  </motion.div>
);

const DraggablePoi = ({ poi, lang }: { poi: POI; lang: string; key?: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${poi.id}`,
    data: poi
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-4 bg-white/5 rounded-[2rem] border border-white/10 flex gap-4 cursor-grab active:cursor-grabbing hover:bg-emerald-500/10 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-emerald-500' : ''}`}
    >
      <img src={poi.imageUrl} className="w-16 h-16 rounded-2xl object-cover shadow-xl pointer-events-none" alt="" referrerPolicy="no-referrer" />
      <div className="flex-1 min-w-0 py-1 pointer-events-none">
        <h4 className="text-sm font-black text-white leading-tight truncate">{poi.title[lang]}</h4>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter pt-1">{poi.category}</p>
      </div>
    </div>
  );
};

const DroppableDay = ({ date, lang, items, onRemove }: { date: Date; lang: string; items: POI[]; onRemove: (id: string) => void; key?: string }) => {
  const iso = date.toISOString().split('T')[0];
  const { isOver, setNodeRef } = useDroppable({ id: iso });
  const isBirthday = iso === '2026-07-12';

  const dayStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ', { weekday: 'short' });
  const dateStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ', { month: 'short', day: 'numeric' });

  return (
    <div 
      ref={setNodeRef}
      className={`p-8 bg-white/10 backdrop-blur-xl border-2 rounded-[3.5rem] transition-all min-h-[400px] flex flex-col gap-6 ${isOver ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02] shadow-2xl' : 'border-white/10'}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isBirthday ? 'text-orange-400' : 'text-emerald-400/60'}`}>{dayStr}</span>
          <h3 className="text-3xl font-black text-white">{dateStr}</h3>
        </div>
        {isBirthday && (
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <Cake className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-[2.5rem] opacity-20">
            <Plus className="w-8 h-8 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Drag places here<br/>to scout route</p>
          </div>
        ) : (
          items.map((item) => (
            <motion.div 
              key={`${iso}-${item.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-5 bg-white/10 border border-white/10 rounded-[2rem] flex items-center justify-between group relative ${item.fixed ? 'border-orange-500/30 ring-1 ring-orange-500/10' : ''}`}
            >
              <div className="flex items-center gap-4">
                <img src={item.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" referrerPolicy="no-referrer" />
                <div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">{item.time || `${Math.round(item.duration/60)}h`}</span>
                  <h4 className="text-sm font-black text-white">{item.title[lang]}</h4>
                </div>
              </div>
              {!item.fixed && (
                <button 
                  onClick={() => onRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-xl text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const MapUpdater = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

export default function App() {
  const [lang, setLang] = useState('en');
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [itinerary, setItinerary] = useState<Record<string, POI[]>>(FIXED_EVENTS);
  const [scrolled, setScrolled] = useState(false);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const t = (key: string) => TEXTS[key]?.[lang] || key;

  const startDate = new Date(2026, 6, 8);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  }), []);

  const currentIso = days[activeDayIdx].toISOString().split('T')[0];
  const activeDayItems = itinerary[currentIso] || [];
  const mapPositions = useMemo(() => 
    activeDayItems
      .filter(item => item.location)
      .map(item => [item.location!.lat, item.location!.lng] as [number, number]),
    [activeDayItems]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.data.current) {
      const poi = active.data.current as POI;
      const dayIso = over.id as string;
      
      setItinerary(prev => {
        const currentItems = prev[dayIso] || [];
        if (currentItems.find(i => i.id === poi.id)) return prev;
        return {
          ...prev,
          [dayIso]: [...currentItems, poi]
        };
      });
    }
  };

  const removeItem = (dayIso: string, poiId: string) => {
    setItinerary(prev => ({
      ...prev,
      [dayIso]: (prev[dayIso] || []).filter(i => i.id !== poiId)
    }));
  };

  const filteredPois = activeTab === 'All' ? AZORES_POIS : AZORES_POIS.filter(p => p.category === activeTab);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="relative min-h-screen w-full font-sans text-slate-100 overflow-x-hidden selection:bg-emerald-500/30">
        
        <Slideshow isBlurred={scrolled} />

        <motion.div className="fixed top-0 left-0 right-0 h-1 bg-emerald-500 z-[100] origin-left" style={{ scaleX: useSpring(useScroll().scrollYProgress, { stiffness: 100, damping: 30 }) }} />

        <nav className={`fixed top-0 inset-x-0 z-50 p-4 transition-all duration-500 ${scrolled ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
          <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full px-8 py-4 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-10">
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-xs font-black tracking-widest text-white hover:text-emerald-400 transition-colors uppercase">Story</button>
                <div className="hidden md:flex items-center gap-8 text-[10px] font-black tracking-widest text-white/60 uppercase">
                  <button onClick={() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-400 transition-colors">Map</button>
                  <button onClick={() => document.getElementById('itinerary')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-400 transition-colors">Itinerary</button>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={() => setLang(lang === 'en' ? 'cs' : 'en')} className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border border-emerald-500/20">{lang.toUpperCase()}</button>
            </div>
          </div>
        </nav>

        {/* SECTION 1: HERO */}
        <section className="relative h-screen flex flex-col items-center justify-center p-8 text-center overflow-hidden">
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-6xl w-full">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-[2px] w-16 bg-emerald-500/50" />
              <span className="text-emerald-400 font-black uppercase tracking-[0.6em] text-[11px] drop-shadow-xl">Azores 2026</span>
              <div className="h-[2px] w-16 bg-emerald-500/50" />
            </div>
            <h1 className="text-7xl sm:text-8xl lg:text-[10rem] font-black tracking-tighter leading-[0.85] text-white drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] uppercase mb-10">Karel, Pedro <br />& Monika</h1>
            <p className="text-xl sm:text-4xl font-bold text-white drop-shadow-lg tracking-tight mb-12 max-w-4xl mx-auto opacity-90">{t('hero_subtitle')}</p>
            <motion.button whileHover={{ scale: 1.05 }} onClick={() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })} className="px-12 py-6 bg-emerald-500 font-black text-white rounded-2xl shadow-xl hover:bg-emerald-400 transition-all flex items-center gap-4 mx-auto uppercase tracking-tighter">
              <Navigation className="w-6 h-6" /> {t('cta_button')}
            </motion.button>
          </motion.div>
        </section>

        {/* SECTION 2: MAP */}
        <section id="map" className="relative min-h-screen py-32 flex flex-col items-center px-6">
          <div className="max-w-7xl w-full flex-1 flex flex-col gap-12">
            <SectionHeader title="The Grand Map" subtitle="Real-time Route Scouting" icon={MapIcon} />
            
            <div className="flex-1 min-h-[600px] grid lg:grid-cols-4 gap-12">
               <div className="lg:col-span-3 bg-white/10 backdrop-blur-2xl rounded-[4rem] border border-white/20 shadow-2xl overflow-hidden relative">
                  <MapContainer center={[37.7412, -25.6667]} zoom={10} className="w-full h-full z-0" scrollWheelZoom={false}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    {mapPositions.map((pos, i) => (
                      <Marker key={i} position={pos}>
                        <Popup>
                          <div className="text-slate-900 font-black uppercase text-xs">
                            {activeDayItems.filter(item => item.location)[i].title[lang]}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {mapPositions.length > 1 && <Polyline positions={mapPositions} color="#10b981" weight={4} opacity={0.6} dashArray="10, 10" />}
                    <MapUpdater positions={mapPositions} />
                  </MapContainer>
                  
                  <div className="absolute top-10 right-10 z-10">
                     <button onClick={() => setIsLibraryOpen(true)} className="px-8 py-5 bg-emerald-500 text-white font-black rounded-3xl flex items-center gap-3 shadow-2xl hover:scale-105 transition-all text-sm uppercase tracking-widest">
                        <Plus className="w-5 h-5" /> Add Places
                     </button>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="bg-white/10 backdrop-blur-2xl rounded-[3rem] p-10 border border-white/10">
                     <h4 className="text-xl font-black mb-6 uppercase tracking-widest">Day Switcher</h4>
                     <div className="grid grid-cols-5 gap-3">
                        {days.map((_, i) => (
                          <button 
                            key={i} 
                            onClick={() => setActiveDayIdx(i)}
                            className={`aspect-square rounded-2xl flex items-center justify-center font-black transition-all ${activeDayIdx === i ? 'bg-emerald-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white/40'}`}
                          >
                            {i + 1}
                          </button>
                        ))}
                     </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-2xl rounded-[3rem] p-10 border border-white/10 flex-1">
                     <h4 className="text-xl font-black mb-6 uppercase tracking-widest">Route Details</h4>
                     <div className="space-y-6">
                        <div className="flex justify-between items-center text-white/40">
                           <span className="text-[10px] font-black uppercase">Locations</span>
                           <span className="text-emerald-400 font-black">{activeDayItems.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/40">
                           <span className="text-[10px] font-black uppercase">Travel Day</span>
                           <span className="text-emerald-400 font-black">{activeDayIdx + 1} / 10</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: TIMELINE */}
        <section id="itinerary" className="relative min-h-screen py-32 px-6 bg-slate-950/20">
          <div className="max-w-6xl mx-auto">
            <SectionHeader title="The Master Timeline" subtitle="The Flow of Adventure" icon={Calendar} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
               {days.map((date) => (
                 <DroppableDay 
                  key={date.toISOString()} 
                  date={date} 
                  lang={lang} 
                  items={itinerary[date.toISOString().split('T')[0]] || []} 
                  onRemove={(id) => removeItem(date.toISOString().split('T')[0], id)}
                 />
               ))}
            </div>
          </div>
        </section>

        {/* LIBRARY SIDE DRAWER */}
        <AnimatePresence>
          {isLibraryOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLibraryOpen(false)} className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-md" />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-full max-w-xl z-[120] bg-white/10 backdrop-blur-4xl border-l border-white/20 shadow-2xl p-10 flex flex-col">
                <div className="flex items-center justify-between mb-12">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Atlas Library</h3>
                  <button onClick={() => setIsLibraryOpen(false)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><X /></button>
                </div>
                <div className="flex gap-3 mb-10 overflow-x-auto pb-2 scrollbar-hide">
                  {['All', 'Sightseeing', 'Activity', 'Food'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${activeTab === tab ? 'bg-emerald-500' : 'bg-white/5'}`}>{tab}</button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                  {filteredPois.map(poi => <DraggablePoi key={poi.id} poi={poi} lang={lang} />)}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* POI MODAL */}
        <AnimatePresence>
          {selectedPoi && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPoi(null)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
              <motion.div layoutId={selectedPoi.id} className="relative w-full max-w-5xl bg-white/10 border border-white/20 rounded-[4rem] overflow-hidden grid lg:grid-cols-2 shadow-2xl">
                <div className="h-96 lg:h-full">
                  <img src={selectedPoi.imageUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                </div>
                <div className="p-12 lg:p-20 flex flex-col gap-10">
                  <div className="space-y-6">
                    <span className="px-6 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-full">{selectedPoi.category}</span>
                    <h2 className="text-5xl lg:text-7xl font-black text-white tracking-tighter uppercase">{selectedPoi.title[lang]}</h2>
                    <p className="text-xl text-white/70 leading-relaxed font-medium">{selectedPoi.description[lang]}</p>
                  </div>
                  <div className="flex gap-6 mt-auto">
                    <button 
                      onClick={() => {
                        setItinerary(prev => ({
                          ...prev,
                          [currentIso]: [...(prev[currentIso] || []), selectedPoi]
                        }));
                        setSelectedPoi(null);
                      }}
                      className="flex-1 px-8 py-5 bg-emerald-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest"
                    >
                      Add to Itinerary Day {activeDayIdx + 1}
                    </button>
                    <button onClick={() => setSelectedPoi(null)} className="px-8 py-5 bg-white/10 rounded-3xl font-black uppercase text-xs border border-white/10">Back</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ASSISTANT FAB */}
        <div className="fixed bottom-10 right-10 z-[100] flex flex-col items-end gap-4">
           {isAssistantOpen && (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-96 bg-white/10 backdrop-blur-4xl border border-white/20 rounded-[3rem] p-8 shadow-2xl">
               <h4 className="font-black text-lg uppercase mb-4 tracking-widest">Gemini Mission Intel</h4>
               <p className="text-sm text-white/70 mb-6 italic leading-relaxed">"Welcome back, Scout. I've analyzed your current itinerary. The route is optimal, but expect light rain near Fogo on Day 4."</p>
               <input className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm" placeholder="Ask Mission Control..." />
             </motion.div>
           )}
           <button onClick={() => setIsAssistantOpen(!isAssistantOpen)} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl border-4 border-slate-900 ${isAssistantOpen ? 'bg-white text-slate-900 rotate-90' : 'bg-emerald-500 text-white'}`}>
             {isAssistantOpen ? <X size={40} /> : <MessageSquare size={40} />}
           </button>
        </div>
      </div>
    </DndContext>
  );
}
