import React from 'react';
import { Navigation, Hotel, Globe, Plus } from 'lucide-react';
import { generateGoogleMapsDirectionsUrl } from '../utils/kmlExport';

interface MapActionsProps {
  theme: 'dark' | 'light';
  lang: string;
  activeDayItems: any[];
  activeTrip: any;
  packingComplete: boolean;
  showAllDays: boolean;
  setShowAllDays: (val: boolean | ((prev: boolean) => boolean)) => void;
  setShowStaysManager: (val: boolean) => void;
  setShowPackingChecklist: (val: boolean) => void;
  isLibraryOpen: boolean;
  setIsLibraryOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  t: (key: string) => string;
}

export const MapActions: React.FC<MapActionsProps> = ({
  theme,
  lang,
  activeDayItems,
  activeTrip,
  packingComplete,
  showAllDays,
  setShowAllDays,
  setShowStaysManager,
  setShowPackingChecklist,
  isLibraryOpen,
  setIsLibraryOpen,
  t,
}) => {
  return (
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
  );
};
