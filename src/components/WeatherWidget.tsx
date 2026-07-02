import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Cloud, CloudRain, Wind, AlertCircle, Loader2, Thermometer, Droplets, X, Clock } from 'lucide-react';
import { TEXTS } from '../data';

interface WeatherWidgetProps {
  destination: string;
  startDate?: string;
  showCompact?: boolean;
  targetDate?: string;
  theme?: 'dark' | 'light';
  lang: string;
  location?: { lat: number; lng: number };
}

interface WeatherDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  windSpeed: number;
  weatherCode: number;
  precipitation: number;
  rawTime: string;
  hourly?: {
    time: string[];
    temp: number[];
    precip: number[];
    weatherCode: number[];
  };
}

function getWeatherCondition(code: number): 'sunny' | 'cloudy' | 'rainy' {
  if (code <= 3) return 'sunny';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'rainy';
  if (code >= 80 && code <= 99) return 'rainy';
  return 'cloudy';
}

// Global caches to prevent redundant fetches across multiple instances
const weatherCache: Record<string, { data: WeatherDay[], isHistorical: boolean }> = {};
const geocodeCache: Record<string, any> = {};
const fetchPromises: Record<string, Promise<any>> = {};

// Known precise coordinates for commonly ambiguous destinations
// (e.g. Open-Meteo geocoding prefers Brazilian cities over Portuguese islands)
const KNOWN_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'são miguel': { latitude: 37.7749, longitude: -25.4967 },
  'sao miguel': { latitude: 37.7749, longitude: -25.4967 },
  'azores': { latitude: 37.7412, longitude: -25.6756 },
  'açores': { latitude: 37.7412, longitude: -25.6756 },
  'ponta delgada': { latitude: 37.7371, longitude: -25.6664 },
  'terceira': { latitude: 38.7031, longitude: -27.2256 },
  'faial': { latitude: 38.5699, longitude: -28.7025 },
  'pico': { latitude: 38.4667, longitude: -28.35 },
  'flores': { latitude: 39.4297, longitude: -31.2156 },
  'corvo': { latitude: 39.6906, longitude: -31.1142 },
  'graciosa': { latitude: 39.0547, longitude: -28.0139 },
  'são jorge': { latitude: 38.6478, longitude: -28.0531 },
  'sao jorge': { latitude: 38.6478, longitude: -28.0531 },
  'santa maria': { latitude: 36.9931, longitude: -25.1006 },
};

export function WeatherWidget({ destination, startDate, showCompact, targetDate, theme, lang, location: propLocation }: WeatherWidgetProps) {
  const t = (key: string) => TEXTS[key]?.[lang] || key;

  const cacheKey = `v4-${destination}-${startDate}`;
  const [data, setData] = useState<WeatherDay[]>(weatherCache[cacheKey]?.data || []);
  const [loading, setLoading] = useState(!weatherCache[cacheKey]);
  const [error, setError] = useState<string | null>(null);
  const [isHistorical, setIsHistorical] = useState(weatherCache[cacheKey]?.isHistorical || false);
  const [selectedDay, setSelectedDay] = useState<WeatherDay | null>(null);

  useEffect(() => {
    if (!destination) return;
    if (weatherCache[cacheKey]) {
      setData(weatherCache[cacheKey].data);
      setIsHistorical(weatherCache[cacheKey].isHistorical);
      setLoading(false);
      return; 
    }
    
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchWeather() {
      // 1. Check for active promise IMMEDIATELY to prevent overlapping work
      if (fetchPromises[cacheKey]) {
        try {
          const cachedData = await fetchPromises[cacheKey];
          if (isMounted) {
            setData(cachedData.data);
            setIsHistorical(cachedData.isHistorical);
            setLoading(false);
          }
          return;
        } catch (err) {
          // If promise failed, we might want to retry below
        }
      }

      try {
        const safeDest = (!destination || destination.includes('New Trip') || destination === 'Unknown Destination') 
          ? 'Destination' 
          : destination;
          
        async function performGeocode(query: string) {
          // 1. Check exact known-coordinates lookup (handles ambiguous Azores island names)
          const queryLower = query.trim().toLowerCase();
          for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
            if (queryLower === key || queryLower.startsWith(key + ',') || queryLower.startsWith(key + ' ')) {
              return coords;
            }
          }

          if (geocodeCache[query]) return geocodeCache[query];
          
          // Deduplicate geocoding fetches
          const geoKey = `geo-${query}`;
          if (!fetchPromises[geoKey]) {
            fetchPromises[geoKey] = fetch(
              `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
            ).then(async res => {
              if (res.status === 429) throw new Error('Weather Service Rate Limit (429)');
              const d = await res.json();
              const results = d.results || [];
              if (!results.length) return null;
              // Prefer Portugal (pt) over other countries to resolve Azores correctly
              const ptResult = results.find((r: any) => r.country_code === 'PT' || r.country_code === 'pt');
              return ptResult || results[0];
            }).catch(err => {
              delete fetchPromises[geoKey]; // Allow retry on error
              throw err;
            });
          }
          
          const result = await fetchPromises[geoKey];
          if (result) geocodeCache[query] = result;
          return result;
        }

        const fetchWork = (async () => {
          let location = propLocation ? { latitude: propLocation.lat, longitude: propLocation.lng } : null;
          
          if (!location) {
            location = await performGeocode(safeDest);
            if (!location && safeDest.includes(',')) location = await performGeocode(safeDest.split(',')[0].trim());
          }
          
          if (!location) throw new Error(`Location not found`);
          
          const { latitude, longitude } = location;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tripStart = startDate ? new Date(startDate) : today;
          tripStart.setHours(0, 0, 0, 0);
          
          const diffDays = Math.ceil((tripStart.getTime() - today.getTime()) / (1000 * 3600 * 24));
          
          let url = '';
          let historical = false;
          
          const toLocalIso = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          };

          // Forecast API supports up to 14-16 days ahead safely, and up to 90 days in the past.
          const tripEnd = new Date(tripStart);
          tripEnd.setDate(tripEnd.getDate() + 10);
          
          const tripEndDiffDays = Math.ceil((tripEnd.getTime() - today.getTime()) / (1000 * 3600 * 24));
          const tripStartDiffDays = diffDays;
          
          // If the trip is too far in the past (>60 days) or ends beyond the reliable 14-day forecast window,
          // we use the historical archive data from last year to ensure a full, stable 10-day dataset.
          if (tripStartDiffDays < -60 || tripEndDiffDays > 14) {
            historical = true;
            const lastYearStart = new Date(tripStart);
            lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
            const end = new Date(lastYearStart);
            end.setDate(end.getDate() + 10);
            url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,precipitation_sum&hourly=temperature_2m,precipitation,weather_code&timezone=auto&start_date=${toLocalIso(lastYearStart)}&end_date=${toLocalIso(end)}`;
          } else {
            // Fully within supported forecast/recent-past window
            url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,precipitation_sum&hourly=temperature_2m,precipitation,weather_code&timezone=auto&start_date=${toLocalIso(tripStart)}&end_date=${toLocalIso(tripEnd)}`;
          }

          const weatherRes = await fetch(url);
          if (weatherRes.status === 429) throw new Error('Weather Service Rate Limit (429)');
          const weatherData = await weatherRes.json();
          
          if (!weatherData.daily) throw new Error('Weather data unavailable');

          const days: WeatherDay[] = weatherData.daily.time.map((time: string, index: number) => {
            let displayDate = new Date(time);
            if (historical) displayDate.setFullYear(displayDate.getFullYear() + 1);
            
            const dayPrefix = time;
            const hourlyIndices = weatherData.hourly.time
              .map((t: string, i: number) => t.startsWith(dayPrefix) ? i : -1)
              .filter((i: number) => i !== -1);

            return {
              date: displayDate.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              rawTime: time,
              maxTemp: Math.round(weatherData.daily.temperature_2m_max[index]),
              minTemp: Math.round(weatherData.daily.temperature_2m_min[index]),
              windSpeed: Math.round(weatherData.daily.windspeed_10m_max[index]),
              weatherCode: weatherData.daily.weathercode[index] || 0,
              precipitation: weatherData.daily.precipitation_sum[index] || 0,
              hourly: {
                 time: hourlyIndices.map(i => weatherData.hourly.time[i]),
                 temp: hourlyIndices.map(i => Math.round(weatherData.hourly.temperature_2m[i])),
                 precip: hourlyIndices.map(i => (weatherData.hourly.precipitation || weatherData.hourly.precip || [])[index * 24 + (i % 24)] || 0),
                 weatherCode: hourlyIndices.map(i => (weatherData.hourly.weather_code || weatherData.hourly.weathercode || [])[index * 24 + (i % 24)] || 0),
              }
            };
          });

          return { data: days, isHistorical: historical };
        })();

        fetchPromises[cacheKey] = fetchWork;
        const result = await fetchWork;
        
        weatherCache[cacheKey] = result;
        if (isMounted) {
          setData(result.data);
          setIsHistorical(result.isHistorical);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
        console.error('Weather fetch error:', err);
      } finally {
        delete fetchPromises[cacheKey]; // Cleanup
      }
    }

    fetchWeather();
    return () => { isMounted = false; };
  }, [destination, startDate, cacheKey, lang]);

  const compactDay = useMemo(() => {
    if (!targetDate || data.length === 0) return null;
    return data.find(d => d.rawTime === targetDate) || data[0];
  }, [data, targetDate]);

  if (showCompact) {
    if (loading) {
       return <div className={`w-12 h-6 rounded-full animate-pulse border shadow-sm ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`} />;
    }
    if (!compactDay) return null;

    const condition = getWeatherCondition(compactDay.weatherCode);
    return (
      <div 
        onClick={(e) => { e.stopPropagation(); setSelectedDay(compactDay); }}
        title={isHistorical ? t('weather_avg_tooltip') : undefined}
        className={`flex flex-col items-center gap-0.5 cursor-pointer group/weather`}
      >
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all shadow-sm ${isHistorical ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-200 hover:bg-amber-100') : (theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/5' : 'bg-white hover:bg-slate-50 border-slate-200')}`}>
          {condition === 'sunny' && <Sun size={12} className="text-amber-500" />}
          {condition === 'cloudy' && <Cloud size={12} className="text-slate-400" />}
          {condition === 'rainy' && <CloudRain size={12} className="text-sky-500" />}
          <span className={`text-[10px] font-black ${theme === 'dark' ? 'text-white/80' : 'text-slate-800'}`}>{compactDay.maxTemp}°</span>
        </div>
        {isHistorical && (
          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'text-amber-400/80 bg-amber-500/10' : 'text-amber-600 bg-amber-50'}`}>
            {t('weather_avg')}
          </span>
        )}
        <AnimatePresence>
          {selectedDay && <WeatherDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} isHistorical={isHistorical} theme={theme} lang={lang} />}
        </AnimatePresence>
      </div>
    );
  }

  if (error || loading || data.length === 0) return null;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`backdrop-blur-3xl border rounded-[2.5rem] p-4 sm:p-6 mb-6 sm:mb-8 overflow-hidden relative group transition-all duration-700 ${theme === 'dark' ? 'bg-zinc-950/80 border-white/5 shadow-2xl shadow-emerald-500/5' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/20'}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
            <Thermometer className={`w-5 h-5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} />
          </div>
          <div className="text-left">
            <h3 className={`font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{isHistorical ? t('weather_title_historical') : t('weather_title_forecast')}</h3>
            <p className={`text-[10px] uppercase font-bold truncate max-w-[200px] ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('weather_for')} {destination}</p>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {data.map((day, i) => {
            const condition = getWeatherCondition(day.weatherCode);
            return (
               <div 
                 key={i} 
                 onClick={() => setSelectedDay(day)}
                 className={`flex-shrink-0 w-24 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all transition-colors duration-500 cursor-pointer group/card shadow-sm hover:shadow-xl hover:scale-105 ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-emerald-500/20' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-emerald-200 shadow-slate-200/50'}`}
               >
                <span className={`text-[9px] font-black uppercase text-center ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>{day.date.split(',')[0]}<br/>{day.date.split(',')[1]}</span>
                <div className="h-10 flex items-center justify-center group-hover/card:scale-110 transition-transform">
                  {condition === 'sunny' && <Sun size={24} className="text-amber-500" />}
                  {condition === 'cloudy' && <Cloud size={24} className="text-slate-400" />}
                  {condition === 'rainy' && <CloudRain size={24} className="text-sky-500" />}
                </div>
                <div className="flex flex-col items-center mt-1">
                  <span className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{day.maxTemp}°</span>
                  <div className={`flex items-center gap-1 text-[8px] font-bold mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                    <Droplets size={8} className="text-sky-500" /> {day.precipitation}mm
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedDay && (
          <WeatherDetailModal 
            day={selectedDay} 
            onClose={() => setSelectedDay(null)} 
            isHistorical={isHistorical} 
            theme={theme}
            lang={lang}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function WeatherDetailModal({ day, onClose, isHistorical, theme, lang }: { day: WeatherDay; onClose: () => void; isHistorical: boolean; theme: 'dark' | 'light'; lang: string }) {
  const t = (key: string) => TEXTS[key]?.[lang] || key;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md transition-all duration-500 ${theme === 'dark' ? 'bg-zinc-950/80' : 'bg-slate-200/40'}`}
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className={`border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-zinc-950 border-white/10' : 'bg-white border-slate-200'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 relative">
           <button onClick={onClose} className={`absolute top-6 right-6 p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-slate-100 hover:bg-slate-200 text-slate-400'}`}>
             <X size={20} />
           </button>

           <div className="flex items-center gap-4 mb-8">
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
               <Thermometer size={28} className={`${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} />
             </div>
             <div className="text-left">
               <h2 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{day.date}</h2>
               <p className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{isHistorical ? t('weather_hourly_historical') : t('weather_hourly_forecast')}</p>
             </div>
           </div>

           <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: t('weather_max_temp'), val: `${day.maxTemp}°`, color: theme === 'dark' ? 'text-white' : 'text-slate-900' },
                { label: t('weather_precip'), val: `${day.precipitation}mm`, color: 'text-sky-500' },
                { label: t('weather_wind'), val: `${day.windSpeed}`, unit: 'km/h', color: theme === 'dark' ? 'text-white' : 'text-slate-900' }
              ].map((item, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'}`}>
                   <p className={`text-[10px] font-black uppercase mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>{item.label}</p>
                   <p className={`text-2xl font-black leading-none ${item.color}`}>
                     {item.val}{item.unit && <span className={`text-[10px] ml-1 uppercase font-bold ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>{item.unit}</span>}
                   </p>
                </div>
              ))}
            </div>

           <h4 className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4 pl-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
             <Clock size={12} /> {t('weather_hourly')}
           </h4>
           
           <div className="space-y-2 h-64 overflow-y-auto pr-2 scrollbar-hide">
              {day.hourly?.time.map((hourlyTime, idx) => {
                const hour = new Date(hourlyTime).getHours();
                if (hour % 2 !== 0) return null;
                const hCode = day.hourly?.weatherCode?.[idx] ?? 0;
                const hCondition = getWeatherCondition(hCode);

                return (
                  <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-all shadow-sm group/row hover:shadow-md transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-emerald-100'}`}>
                    <div className="flex items-center gap-4">
                      <span className={`text-[11px] font-black w-10 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{hour}:00</span>
                      <div className="flex items-center justify-center w-8">
                        {hCondition === 'sunny' && <Sun size={18} className="text-amber-500" />}
                        {hCondition === 'cloudy' && <Cloud size={18} className="text-slate-400" />}
                        {hCondition === 'rainy' && <CloudRain size={18} className="text-sky-500" />}
                      </div>
                      <span className={`text-sm font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{day.hourly?.temp?.[idx] ?? 0}°</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {(day.hourly?.precip?.[idx] ?? 0) > 0 ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${theme === 'dark' ? 'text-sky-400 bg-sky-400/10' : 'text-sky-600 bg-sky-50'}`}>
                          {day.hourly?.precip?.[idx]}mm
                        </span>
                      ) : (
                        <span className={`text-[9px] font-black uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-white/10' : 'text-slate-300'}`}>{t('weather_dry')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
           </div>
        </div>

        <div className={`bg-emerald-500/10 p-4 text-center border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
           <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('weather_confidence')}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
