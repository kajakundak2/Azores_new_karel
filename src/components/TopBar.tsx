import React from 'react';
import { 
  Calendar, 
  Compass, 
  Languages, 
  Minus, 
  Moon, 
  Plus, 
  Share2, 
  Sun, 
  Users 
} from 'lucide-react';
import { TEXTS } from '../data';
import { createT } from '../utils/i18n';

interface TopBarProps {
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
}

export const TopBar: React.FC<TopBarProps> = ({ 
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
}) => {
  const t = createT(lang);

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] border-b h-16 flex items-center justify-between px-4 sm:px-6 backdrop-blur-xl transition-all duration-500 ${theme === 'dark' ? 'bg-zinc-950/80 border-white/5 shadow-2xl' : 'bg-white/80 border-slate-200'}`}>
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={onExit}>
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center p-1.5">
            <Compass className="text-slate-950 w-full h-full" />
          </div>
          <span className={`text-lg hidden md:block uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <span className="font-extrabold">SARA</span>
            <span className="font-light text-emerald-500">{t('itinerary')}</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-white/10 shrink-0" />

        {/* Trip Title & Destination */}
        <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[200px]">
          <input 
            value={trip.title || ''}
            placeholder={t('topbar_trip_title_placeholder')}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className={`text-[10px] sm:text-xs font-black uppercase tracking-tighter bg-transparent border-none p-0 outline-none focus:text-emerald-400 truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
          />
          <input 
            value={trip.destination || ''}
            placeholder={t('topbar_destination_placeholder')}
            onChange={(e) => onUpdate({ destination: e.target.value })}
            className={`text-[8px] sm:text-[10px] font-bold bg-transparent border-none p-0 outline-none text-emerald-500/80 hover:text-emerald-500 focus:text-emerald-500 truncate`}
          />
        </div>

        <div className="hidden lg:block h-4 w-px bg-slate-300 dark:bg-white/10" />

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

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Currency Switcher - Hide labels on very small screens, show only active or use dropdown? Let's just shrink it. */}
        <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-xl p-1 border border-slate-200 dark:border-white/10 scale-90 sm:scale-100 origin-right">
          {['EUR', 'CZK', 'USD'].map(c => (
            <button 
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-2 sm:px-3 py-1 rounded-lg text-[8px] sm:text-[9px] font-black tracking-widest transition-all ${currency === c ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-emerald-400'}`}
            >
              {c}
            </button>
          ))}
        </div>

        <button 
          onClick={() => setLang(lang === 'en' ? 'cs' : 'en')}
          className={`flex items-center justify-center w-10 h-10 sm:w-auto sm:px-3 sm:py-2 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
        >
          <Languages className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block ml-2">{lang}</span>
        </button>

        <button 
          onClick={onThemeToggle}
          className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className="hidden sm:block h-4 w-px bg-slate-300 dark:bg-white/10 mx-1" />

        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert(t('link_copied'));
          }}
          className={`hidden sm:block p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
          title="Share Trip"
        >
          <Share2 size={14} className="text-blue-400" />
        </button>

        <button 
          onClick={onExit}
          className="hidden sm:block px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          {t('topbar_exit')}
        </button>
        
        {/* Simple Exit for Mobile */}
        <button 
          onClick={onExit}
          className="sm:hidden w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl"
        >
          <Plus className="w-4 h-4 rotate-45" />
        </button>
      </div>
    </div>
  );
};
