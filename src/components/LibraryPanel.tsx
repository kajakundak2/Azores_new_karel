import React from 'react';
import { X, Search, Loader2, Plus, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DraggablePoi } from './DraggablePoi';
import { POI } from '../utils/types';

interface LibraryPanelProps {
  theme: 'dark' | 'light';
  lang: string;
  activeTrip: any;
  isLibraryOpen: boolean;
  setIsLibraryOpen: (val: boolean) => void;
  atlasQuery: string;
  setAtlasQuery: (val: string) => void;
  searchInBounds: boolean;
  setSearchInBounds: (val: boolean) => void;
  doAtlasSearch: (query: string, location?: any, inBounds?: boolean) => void;
  isAtlasSearching: boolean;
  atlasSearchResults: POI[];
  clearAtlasResults: () => void;
  atlasSearchError: string | null;
  allAvailablePois: POI[];
  libraryTabs: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  filteredPois: POI[];
  addPoi: (dayIso: string, poi: POI) => void;
  currentIso: string;
  safeActiveDayIdx: number;
  setSelectedPoi: (poi: POI | null) => void;
  setHoveredPoiId: (id: string | null) => void;
  t: (key: string) => string;
  setNotification: (msg: string) => void;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  theme,
  lang,
  activeTrip,
  isLibraryOpen,
  setIsLibraryOpen,
  atlasQuery,
  setAtlasQuery,
  searchInBounds,
  setSearchInBounds,
  doAtlasSearch,
  isAtlasSearching,
  atlasSearchResults,
  clearAtlasResults,
  atlasSearchError,
  allAvailablePois,
  libraryTabs,
  activeTab,
  setActiveTab,
  filteredPois,
  addPoi,
  currentIso,
  safeActiveDayIdx,
  setSelectedPoi,
  setHoveredPoiId,
  t,
  setNotification,
}) => {
  return (
    <AnimatePresence>
      {isLibraryOpen && (
        <motion.div 
          initial={{ x: '100%' }} 
          animate={{ x: 0 }} 
          exit={{ x: '100%' }} 
          transition={{ type: 'spring', damping: 30, stiffness: 300 }} 
          className={`absolute top-16 right-0 h-[calc(100%-4rem)] w-full sm:w-[400px] z-40 backdrop-blur-3xl border-l shadow-2xl p-6 flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0F172A]/95 border-white/10 shadow-black' : 'bg-white/95 border-slate-200 shadow-slate-200'}`}
        >
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
                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">{t('search_results_label')} ({atlasSearchResults.length})</h4>
                <button onClick={clearAtlasResults} className="text-[9px] text-white/40 hover:text-white/70 transition-colors">{t('search_clear_btn')}</button>
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
                      <h5 className={`font-bold text-xs truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{poi.title[lang] || poi.title.en}</h5>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-blue-400 font-bold">{poi.category}</span>
                        {poi.rating && <span className="text-[9px] text-amber-400">★ {poi.rating}</span>}
                      </div>
                      {poi.address && <p className="text-[8px] text-white/30 truncate mt-0.5">{poi.address}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => { addPoi(currentIso, poi); setNotification(`${t('library_added_notification')} ${safeActiveDayIdx + 1}`); }}
                        className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                        title={`${t('library_add_tooltip')} ${safeActiveDayIdx + 1}`}
                      ><Plus className="w-3 h-3" /></button>
                      <button 
                        onClick={() => setSelectedPoi(poi)}
                        className="p-1.5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                        title={t('library_view_details_tooltip')}
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
           <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 text-left ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{t('library_section_label')}</h4>

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
  );
};
