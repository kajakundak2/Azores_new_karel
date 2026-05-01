import React from 'react';
import { Trip, TEXTS } from '../data';
import { Plane, Hotel, Clock, Shield, Map, ExternalLink, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface ExpeditionIntelProps {
  trip: Trip;
  onClose: () => void;
  lang: string;
}

export function ExpeditionIntel({ trip, onClose, lang }: ExpeditionIntelProps) {
  const t = (key: string) => TEXTS[key]?.[lang] || key;
  const { logistics } = trip;
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-zinc-950/90 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-none max-w-4xl w-full max-h-[80vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 dark:border-emerald-500/30">
            <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t('intel_title')}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold uppercase tracking-widest leading-none">{trip.title} / {t('intel_overview')}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center justify-center transition-colors border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white shadow-sm"
        >
          <span className="text-xl">×</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        
        {/* MISSION SCHEDULE */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">{t('intel_schedule')}</h3>
          </div>
          
          <div className="bg-white dark:bg-zinc-950/50 rounded-3xl p-6 border border-slate-100 dark:border-white/5 space-y-4 shadow-sm">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest px-2">
                <span>{t('intel_phase')}</span>
                <span>{t('intel_timestamp')}</span>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-950/50 rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center shadow-sm">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('intel_trip_start')}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{trip.startDate}</span>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-950/50 rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center shadow-sm">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('intel_trip_end')}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{trip.endDate}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
             <div className="p-2 bg-amber-500 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-slate-950" />
             </div>
             <p className="text-[10px] text-amber-700 dark:text-amber-200 font-bold uppercase leading-relaxed tracking-wider">
               {t('intel_warning')}
             </p>
          </div>
        </div>

        {/* BASE CAMPS */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Hotel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">{t('intel_accommodations')}</h3>
          </div>

          <div className="space-y-4">
            {logistics?.stays && logistics.stays.length > 0 ? (
                logistics.stays.map((stay, idx) => (
                    <motion.div 
                        key={idx}
                        whileHover={{ x: 5 }}
                        className="bg-white dark:bg-zinc-950/50 border border-slate-200/60 dark:border-white/5 rounded-3xl p-5 group flex items-center gap-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-xl hover:border-blue-500/30"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Hotel size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase truncate">{stay.name}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{stay.address}</p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full font-black">{t('intel_stay_badge')}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">{stay.checkInDate.split('-').slice(1).join('/')} — {stay.checkOutDate.split('-').slice(1).join('/')}</span>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </motion.div>
                ))
            ) : (
                <div className="h-40 bg-white dark:bg-zinc-950/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center p-6 grayscale opacity-50 shadow-sm">
                    <Map className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('intel_no_stays')}</p>
                </div>
            )}
          </div>

          <button className="w-full py-4 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center gap-3 transition-all text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm active:scale-95">
             <ExternalLink size={14} />
             {t('intel_open_map')}
          </button>
        </div>

      </div>
    </motion.div>
  );
}
