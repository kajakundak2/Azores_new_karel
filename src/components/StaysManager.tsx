import React, { useState, useMemo } from 'react';
import { Trip, Stay, TEXTS } from '../data';
import { Hotel, Calendar, Coins, ExternalLink, MapPin, Plus, Trash2, X, Search, Navigation, CreditCard, Loader2, Star, Tent, Home, House, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { searchPlacesAsync } from '../hooks/usePlacesSearch';

interface StaysManagerProps {
  trip: Trip;
  lang: string;
  currency: 'EUR' | 'CZK' | 'USD';
  rates: Record<string, number>;
  onUpdate: (stays: Stay[]) => Promise<void>;
  onAddStayToItinerary?: (stay: Stay) => void;
  onClose: () => void;
  apiKey: string;
  theme?: 'light' | 'dark';
}

const STAY_TYPE_ICONS: Record<string, any> = {
  hotel: Hotel,
  apt: Home,
  camping: Tent,
  other: House,
};

export function StaysManager({ trip, lang, currency, rates, onUpdate, onAddStayToItinerary, onClose, apiKey, theme = 'dark' }: StaysManagerProps) {
  const [stays, setStays] = useState<Stay[]>(trip.logistics?.stays || []);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const t = (key: string) => TEXTS[key]?.[lang] || key;
  const formatPrice = (eur: number) => {
    const val = eur * (rates[currency] || 1);
    return new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      style: 'currency',
      currency: currency
    }).format(val);
  };

  const totalCostEur = useMemo(() => {
    return stays.reduce((sum, s) => sum + ((s.pricePerNight || 0) * (s.nights || 1)), 0);
  }, [stays]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchPlacesAsync(`${searchQuery} ${trip.destination} hotel accommodation`);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const addStay = (place: any) => {
    const newStay: Stay = {
      id: `stay-${Date.now()}`,
      name: place.title[lang as keyof typeof place.title] || place.title.en,
      address: place.address || '',
      imageUrl: place.imageUrl || '',
      location: place.location || null,
      rating: place.rating,
      reviewCount: place.reviewCount,
      checkInDate: trip.startDate,
      checkOutDate: trip.endDate,
      nights: Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000),
      pricePerNight: 0,
    };
    setStays([...stays, newStay]);
    if (onAddStayToItinerary) onAddStayToItinerary(newStay);
    setIsAdding(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeStay = (id: string) => {
    setStays(stays.filter(s => s.id !== id));
  };

  const updateStay = (id: string, updates: Partial<Stay>) => {
    setStays(stays.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(stays);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`${theme === 'dark' ? 'bg-zinc-950 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row w-full max-w-5xl max-h-[85vh] text-left relative`}
    >
      {/* Absolute Close Button (Mobile/Global) */}
      <button
        onClick={onClose}
        className={`absolute top-6 right-6 z-50 p-2 rounded-xl transition-all md:hidden ${theme === 'dark' ? 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Left Panel: Summary & Stats */}
      <div className={`md:w-1/3 p-8 flex flex-col border-r ${theme === 'dark' ? 'bg-zinc-950 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-lg ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-500 text-slate-950'}`}>
              <Hotel className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('intel_accommodations')}</h2>
              <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400/60' : 'text-emerald-600'}`}>{trip.destination}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 flex-1">
          <div className={`p-5 rounded-3xl border space-y-4 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-950/5 border-slate-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{t('total_nights')}</span>
              <span className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stays.reduce((sum, s) => sum + (s.nights || 0), 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{t('total_budget')}</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatPrice(totalCostEur)}</span>
            </div>
          </div>

          <div className={`p-5 rounded-3xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-950/5 border-slate-200'}`}>
            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{t('intel_overview')}</h4>
            <div className="flex items-start gap-3">
              <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-1" />
              <p className={`text-[11px] font-bold leading-relaxed ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                {t('intel_warning')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('save_changes')}
          </button>
          <button 
            onClick={onClose}
            className={`w-full py-4 font-black uppercase tracking-widest rounded-2xl transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
          >
            {t('cancel')}
          </button>
        </div>
      </div>

      {/* Right Panel: List & Search */}
      <div className={`flex-1 p-8 overflow-y-auto flex flex-col ${theme === 'dark' ? 'bg-zinc-950' : 'bg-slate-50'}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {isAdding ? t('find_stay') : t('stays_list')}
          </h3>
          <div className="flex items-center gap-3">
            {!isAdding && (
              <button 
                onClick={() => setIsAdding(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
              >
                <Plus className="w-3 h-3" /> {t('add_to_itinerary')}
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${theme === 'dark' ? 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div 
              key="adding"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder={t('stay_search_placeholder')}
                  className={`w-full border rounded-2xl py-4 pl-12 pr-4 transition-all font-bold outline-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5'}`}
                />
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`} />
                <button 
                  onClick={handleSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 rounded-xl text-slate-950"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {searchResults.map((place, i) => (
                  <button 
                    key={i}
                    onClick={() => addStay(place)}
                    className={`flex items-center gap-4 p-4 rounded-3xl border text-left transition-all group ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/5' : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow-md'}`}
                  >
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10">
                      <img src={place.imageUrl} alt={place.title.en} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-black uppercase truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{place.title[lang as keyof typeof place.title] || place.title.en}</h4>
                      <p className={`text-[9px] uppercase font-black truncate ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{place.address}</p>
                      {place.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                          <span className="text-[10px] font-black text-amber-500">{place.rating}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setIsAdding(false)} 
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${theme === 'dark' ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
              >
                ← {t('back_to_list')}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 pr-2 overflow-y-auto custom-scrollbar"
            >
              {stays.map(stay => (
                <div 
                  key={stay.id}
                  className={`border rounded-3xl p-6 group flex flex-col md:flex-row gap-6 items-start md:items-center relative transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}
                >
                  <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 relative">
                    <img src={stay.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80'} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <h4 className={`text-lg font-black uppercase tracking-tighter truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stay.name}</h4>
                      <p className={`text-[10px] font-black uppercase tracking-widest truncate ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{stay.address}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{t('stays_checkin')}</span>
                        <input 
                          type="date"
                          value={stay.checkInDate}
                          onChange={e => updateStay(stay.id, { checkInDate: e.target.value })}
                          className={`w-full border rounded-lg p-1.5 text-[10px] font-black outline-none transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{t('stays_checkout')}</span>
                        <input 
                          type="date"
                          value={stay.checkOutDate}
                          onChange={e => updateStay(stay.id, { checkOutDate: e.target.value })}
                          className={`w-full border rounded-lg p-1.5 text-[10px] font-black outline-none transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{t('price_per_night')}</span>
                        <div className="relative">
                          <input 
                            type="number"
                            value={stay.pricePerNight}
                            onChange={e => updateStay(stay.id, { pricePerNight: parseFloat(e.target.value) || 0 })}
                            className={`w-full border rounded-lg p-1.5 pl-5 text-[10px] font-black outline-none transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'}`}
                          />
                          <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>€</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{t('total')}</span>
                        <div className={`p-1.5 rounded-lg text-[10px] font-black text-center ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                          {formatPrice((stay.pricePerNight || 0) * (stay.nights || 1))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => removeStay(stay.id)}
                    className="absolute top-4 right-4 md:static md:ml-4 p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {stays.length === 0 && (
                <div className={`h-[200px] border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-center p-8 grayscale opacity-40 ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                   <Hotel className={`w-12 h-12 mb-4 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`} />
                   <p className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{t('stays_empty')}</p>
                 </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default StaysManager;
