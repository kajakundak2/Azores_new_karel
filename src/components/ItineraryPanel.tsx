import React from 'react';
import { Sparkles, MapPin, Instagram } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';
import { VerticalTimelineDay } from './VerticalTimeline';
import { POI } from '../utils/types';
import { toLocalIso } from '../useItineraryState';

interface ItineraryPanelProps {
  theme: 'dark' | 'light';
  lang: string;
  activeTrip: any;
  days: Date[];
  itinerary: Record<string, POI[]>;
  activeDayIdx: number;
  setActiveDayIdx: (idx: number) => void;
  setShowAllDays: (val: boolean) => void;
  removePoi: (dayIso: string, poiId: string) => void;
  updatePoiTransportMode: (dayIso: string, poiId: string, mode: any) => void;
  setSelectedPoi: (poi: POI | null) => void;
  currency: string;
  rates: Record<string, number>;
  t: (key: any, params?: any) => string;
  travelers?: number;
}

export const ItineraryPanel: React.FC<ItineraryPanelProps> = ({
  theme,
  lang,
  activeTrip,
  days,
  itinerary,
  activeDayIdx,
  setActiveDayIdx,
  setShowAllDays,
  removePoi,
  updatePoiTransportMode,
  setSelectedPoi,
  currency,
  rates,
  t,
  travelers = 2,
}) => {
  return (
    <div className="p-4 flex-1">
      <div className="flex items-center justify-between mb-4 px-2">
        <h4 className={`font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-slate-400'}`}>{t('itinerary_label')}</h4>
        <div className={`text-[10px] font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('days_count', { count: days.length })}</div>
      </div>

      <WeatherWidget destination={activeTrip.destination || 'Destination'} startDate={activeTrip.startDate} theme={theme} lang={lang} />

      {/* INSPIRATION VIDEOS (Instagram Reel style) */}
      <div className="mb-10 mt-2 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
            <Sparkles className="w-3 h-3" /> {t('inspiration_title')}
          </h3>
          <a 
            href={`https://www.instagram.com/explore/tags/${(activeTrip?.destination || 'travel').replace(/\s+/g, '').toLowerCase()}/`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-1.5"
          >
            <Instagram size={10} />
            #{ (activeTrip?.destination || 'travel').replace(/\s+/g, '').toLowerCase() }
          </a>
        </div>
         <div className="flex gap-6 overflow-x-auto pb-8 snap-x scrollbar-hide mask-fade-right">
            {(() => {
              const displayVideos = activeTrip?.inspirationVideos || [];

              if (displayVideos.length === 0) {
                 return [1,2,3,4].map(i => (
                   <div key={i} className={`relative flex-shrink-0 w-44 h-72 rounded-3xl border animate-pulse flex items-center justify-center overflow-hidden ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                      <div className={`text-[10px] font-black uppercase tracking-widest text-center px-6 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>{t('itinerary_video_loading')}</div>
                   </div>
                 ));
              }

              return displayVideos.map((v: any) => (
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
                destination={activeTrip?.destination || 'Destination'}
                tripStartDate={activeTrip?.startDate}
                theme={theme}
                currency={currency}
                rates={rates}
                travelers={travelers}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
