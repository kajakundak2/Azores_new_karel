import React, { useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { POI, TEXTS } from '../data';
import { calcDayDuration, formatDuration, toLocalIso } from '../useItineraryState';
import { ChevronRight, GripVertical, Navigation, MapPin, Plane, Bus, Coffee, Sparkles, Calendar, Car, Bike, Footprints, Hotel, Trash2 } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';
import { translate } from '../utils/bilingualUtils';
import { createT } from '../utils/i18n';
import { formatPrice, parseCost } from '../utils/priceUtils';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Transport': return <Plane className="w-4 h-4" />;
    case 'Food': return <Coffee className="w-4 h-4" />;
    case 'Activity': return <Sparkles className="w-4 h-4" />;
    case 'Event': return <Calendar className="w-4 h-4" />;
    case 'Special': return <Hotel className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4" />;
  }
};

// ── Directions Cache ──────────────────────────────────────────────────────────
interface CachedDirection {
  durationMins: number;
  distanceKm: string;
  transitDetails?: {
    lineName: string;
    departureTime: string;
    arrivalTime: string;
    numStops: number;
    walkingMins?: number;
  };
}
const directionsCache: Record<string, CachedDirection | 'pending' | 'failed'> = {};

function getCacheKey(prev: POI, next: POI, mode: string): string {
  if (!prev.location || !next.location) return '';
  return `${prev.location.lat.toFixed(5)},${prev.location.lng.toFixed(5)}-${next.location.lat.toFixed(5)},${next.location.lng.toFixed(5)}-${mode}`;
}

function naiveFallback(prev: POI, next: POI, mode: string = 'car'): CachedDirection | null {
  if (!prev.location || !next.location) return null;
  const dx = (prev.location.lng - next.location.lng) * Math.cos(prev.location.lat * Math.PI / 180);
  const dy = prev.location.lat - next.location.lat;
  const distDeg = Math.sqrt(dx * dx + dy * dy);
  const km = (distDeg * 111).toFixed(1);
  const kmNum = Number(km);
  
  // Real world estimates based on mountain terrain
  let mins = Math.round(kmNum * 2.5); // Default (car) - Azorean roads are winding
  if (mode === 'walk') mins = Math.round(kmNum * 15); // Steep hikes
  else if (mode === 'bicycle') mins = Math.round(kmNum * 6); // Up and down hills
  else if (mode === 'bus') mins = Math.round(kmNum * 5 + 10); // Wait time + slower speed
  
  return { durationMins: Math.max(2, mins), distanceKm: km };
}

const modeToGoogleTravelMode: Record<string, string> = {
  car: 'DRIVE',
  bus: 'TRANSIT',
  walk: 'WALK',
  bicycle: 'BICYCLE',
};

// ── Transit Node ──────────────────────────────────────────────────────────────
const TransitNode = ({ prev, next, onModeChange, theme, lang }: { prev: POI; next: POI; onModeChange: (mode: 'car' | 'bus' | 'walk' | 'bicycle') => void; theme: 'dark' | 'light'; lang: string }) => {
  const t = createT(lang);
  const currentMode = next.transportModeTo || 'car';
  const cacheKey = getCacheKey(prev, next, currentMode);

  const [routeInfo, setRouteInfo] = React.useState<CachedDirection | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  useEffect(() => {
    if (!prev.location || !next.location || !cacheKey) return;

    // Check cache
    const cached = directionsCache[cacheKey];
    if (cached && cached !== 'pending' && cached !== 'failed') {
      setRouteInfo(cached);
      return;
    }
    if (cached === 'pending') return;
    if (cached === 'failed') {
      setRouteInfo(naiveFallback(prev, next, currentMode));
      return;
    }

    // Check if new Route API is available
    if (typeof google === 'undefined' || !google.maps?.routes?.Route) {
      setRouteInfo(naiveFallback(prev, next, currentMode));
      return;
    }

    directionsCache[cacheKey] = 'pending';
    setIsLoading(true);

    const googleMode = modeToGoogleTravelMode[currentMode] || 'DRIVE';

    const request: any = {
      origin: { lat: prev.location.lat, lng: prev.location.lng },
      destination: { lat: next.location.lat, lng: next.location.lng },
      travelMode: googleMode,
      // JS SDK field mask does NOT use routes. prefix
      fields: ['durationMillis', 'distanceMeters', 'path', 'legs'],
    };
    
    // Transit mode REQUIRES departureTime
    if (googleMode === 'TRANSIT') {
      request.departureTime = new Date();
    }

    google.maps.routes.Route.computeRoutes(request).then((response: any) => {
      setIsLoading(false);
      const routes = response.routes;
      if (routes && routes.length > 0) {
        const route = routes[0];
        const leg = route.legs?.[0];
        
        // durationMillis is in milliseconds in JS SDK
        const durationMs = route.durationMillis || 0;
        const distanceMeters = route.distanceMeters || 0;

        const info: CachedDirection = {
          durationMins: Math.round(durationMs / 60000),
          distanceKm: (distanceMeters / 1000).toFixed(1),
        };

        // Extract transit details for bus/transit mode
        if (googleMode === 'TRANSIT' && leg?.steps) {
          const transitStep = leg.steps.find((s: any) => s.travelMode === 'TRANSIT');
          const td = transitStep?.transitDetails;
          if (td) {
            info.transitDetails = {
              lineName: td.transitLine?.nameShort || td.transitLine?.name || 'Transit',
              departureTime: td.stopDetails?.departureTime?.text || td.stopDetails?.departureTime || '',
              arrivalTime: td.stopDetails?.arrivalTime?.text || td.stopDetails?.arrivalTime || '',
              numStops: td.stopCount || 0,
            };
            // Check for walking segments
            const walkSteps = leg.steps.filter((s: any) => s.travelMode === 'WALKING');
            const totalWalkMs = walkSteps.reduce((sum: number, s: any) => {
                return sum + (s.durationMillis || 0);
            }, 0);
            if (totalWalkMs > 60000) {
              info.transitDetails.walkingMins = Math.round(totalWalkMs / 60000);
            }
          }
        }

        directionsCache[cacheKey] = info;
        setRouteInfo(info);
      } else {
        directionsCache[cacheKey] = 'failed';
        setRouteInfo(naiveFallback(prev, next, currentMode));
      }
    }).catch((err: any) => {
      console.error("Directions error:", err);
      setIsLoading(false);
      directionsCache[cacheKey] = 'failed';
      setRouteInfo(naiveFallback(prev, next, currentMode));
    });
  }, [cacheKey, prev.location, next.location, currentMode]);

  const modes = [
    { id: 'car', icon: Car, label: t('transport_car') },
    { id: 'bus', icon: Bus, label: t('transport_bus') },
    { id: 'walk', icon: Footprints, label: t('transport_walk') },
    { id: 'bicycle', icon: Bike, label: t('transport_bike') },
  ] as const;

  if (!prev.location || !next.location) return <div className="h-8 border-l-2 border-dashed border-slate-200 dark:border-white/10 ml-6 my-1" />;

  return (
    <div className="flex items-center gap-4 py-3 ml-4">
      <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center relative translate-x-[1.5px]">
        <div className="w-0.5 h-16 border-l-2 border-dashed border-slate-300 dark:border-slate-700 absolute -top-4 -z-10" />
      </div>
      <div className="flex flex-col gap-2">
        <div className={`flex items-center gap-1 p-1 backdrop-blur-md rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-zinc-950/80 border-white/5' : 'bg-white border-slate-200'}`}>
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = currentMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive 
                    ? 'bg-emerald-500 text-slate-950 shadow-lg scale-105' 
                    : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-white/5'
                }`}
                title={m.label}
              >
                <Icon className="w-3.5 h-3.5" />
                {isActive && <span className="text-[9px] font-black uppercase tracking-tighter pr-1">{m.label}</span>}
              </button>
            );
          })}
        </div>
        <div className={`flex items-center gap-2 pl-2 text-[9px] font-bold uppercase tracking-widest transition-colors duration-500 flex-wrap ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>
          {isLoading ? (
            <span className="text-emerald-500 animate-pulse flex items-center gap-1">
              <Navigation className="w-2.5 h-2.5 animate-spin" /> {t('transit_calculating')}
            </span>
          ) : routeInfo ? (
            <>
              <span className="flex items-center gap-1 whitespace-nowrap"><Navigation className="w-2.5 h-2.5" /> ~{routeInfo.durationMins} min</span>
              <span className="opacity-30">•</span>
              <span className="whitespace-nowrap">{routeInfo.distanceKm} km</span>
              {directionsCache[cacheKey] === 'failed' && (
                <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-tighter shrink-0 whitespace-nowrap ${theme === 'dark' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                   {t('transit_estimated')}
                </span>
              )}
              {routeInfo.transitDetails && (
                <div className="flex items-center gap-2 ml-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded flex items-center gap-1 border whitespace-nowrap ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                    <Bus className="w-2.5 h-2.5" /> {routeInfo.transitDetails.lineName}
                  </span>
                  {routeInfo.transitDetails.departureTime && (
                    <span className={`px-2 py-0.5 rounded border whitespace-nowrap ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                      {routeInfo.transitDetails.departureTime} → {routeInfo.transitDetails.arrivalTime}
                    </span>
                  )}
                  {routeInfo.transitDetails.numStops > 0 && (
                    <span className="opacity-60 whitespace-nowrap">{routeInfo.transitDetails.numStops} {t('transit_stops')}</span>
                  )}
                  {routeInfo.transitDetails.walkingMins && routeInfo.transitDetails.walkingMins > 0 && (
                    <span className="opacity-60 flex items-center gap-0.5 whitespace-nowrap"><Footprints className="w-2 h-2" /> +{routeInfo.transitDetails.walkingMins}min</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <span className="opacity-40">{t('transit_no_route')}</span>
          )}
        </div>
      </div>
    </div>
  );
};


// ── Timeline Node (Draggable) ─────────────────────────────────────────────────
export const TimelineNode = ({
  poi, lang, onSelect, onRemove, theme, currency, rates
}: {
  poi: POI; lang: string; onSelect: (poi: POI) => void; onRemove: () => void; theme: 'dark' | 'light';
  currency?: string;
  rates?: any;
}) => {
  const t = createT(lang);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: poi.id,
    data: poi
  });

  const style = undefined;
  const isLogistics = poi.category === 'Transport';
  const isEvent = poi.category === 'Event';

  return (
    <div className="relative flex items-center group">
      {/* Timeline Edge & Dot */}
      <div className="absolute left-6 top-10 bottom-[-40px] w-0.5 bg-slate-200 dark:bg-white/10 group-last:hidden" />
      
      <div className="w-12 flex justify-center z-10 shrink-0">
        <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
          theme === 'dark' 
            ? 'border-zinc-950' 
            : 'border-white shadow-sm'
        } ${
          isLogistics ? 'bg-blue-500' : isEvent ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : poi.category === 'Special' ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-emerald-500'
        } group-hover:scale-110 shadow-lg`}>
          <div className="text-white">
            {getCategoryIcon(poi.category)}
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div
        ref={setNodeRef}
        style={style}
        className={`flex-1 min-w-0 ml-4 p-4 rounded-2xl border backdrop-blur-md transition-all ${
          isDragging ? 'opacity-50 scale-105 z-50 bg-white/20 border-emerald-500 shadow-2xl' : 
          poi.category === 'Special' ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/30' :
          'bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 hover:bg-white/50 dark:hover:bg-white/10 hover:border-emerald-500/30 shadow-sm hover:shadow-xl'
        }`}
      >
        <div className="flex gap-4 items-center">
          <button
            {...attributes} {...listeners}
            className={`self-center p-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing shrink-0 border ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/5 text-white/30 hover:bg-white/20 hover:text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
            title={t('timeline_drag')}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          
          {poi.imageUrl && (
            <img 
              src={poi.imageUrl} 
              className="w-12 h-12 rounded-xl object-cover shadow-lg border border-slate-200 dark:border-white/10 shrink-0" 
              alt=""
              referrerPolicy="no-referrer"
            />
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
            <h4 className={`font-black truncate text-sm uppercase tracking-tight transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {translate(poi.title, lang)}
            </h4>
            {(poi.description) && (
              <p className={`text-[10px] truncate mt-0.5 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                {translate(poi.description, lang)}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <p className={`text-[9px] uppercase tracking-widest flex items-center gap-1.5 font-black ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>
                {poi.time && <span className="text-emerald-500">{poi.time}</span>}
                {poi.time && <span className="opacity-20">•</span>}
                {formatDuration(poi.duration)}
              </p>
              {poi.rating && (
                <div className="flex items-center gap-0.5 text-[9px] text-amber-500 font-black">
                  <Sparkles className="w-2.5 h-2.5" />
                  {poi.rating}
                </div>
              )}
              {(() => {
                const formatted = formatPrice(poi.cost, poi.priceInEuro, currency || 'EUR', rates || {}, lang);
                const isFree = poi.cost === 0 || poi.priceInEuro?.toLowerCase() === 'free';
                
                if (isFree) {
                  return (
                    <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border ${theme === 'dark' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-700'}`}>
                      {t('poi_free')}
                    </div>
                  );
                }
                
                if (formatted) {
                  return (
                    <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                      {formatted}
                    </div>
                  );
                }
                
                // Show hint for activities/sightseeing if no price yet
                if (poi.category === 'Sightseeing' || poi.category === 'Activity') {
                  return (
                    <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border border-dashed ${theme === 'dark' ? 'border-white/10 text-white/20' : 'border-slate-200 text-slate-400'}`}>
                      {t('poi_entrance_fees_hint')}
                    </div>
                  );
                }
                
                return null;
              })()}
            </div>
          </div>
          <button
            onPointerDown={e => { e.stopPropagation(); onRemove(); }}
            className={`self-center p-2 rounded-xl transition-all text-xs border flex items-center gap-1 shrink-0 shadow-sm ${
              theme === 'dark'
                ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20 text-rose-400'
                : 'bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-500'
            }`}
            title={t('timeline_remove')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onPointerDown={e => { e.stopPropagation(); onSelect(poi); }}
            className={`self-center p-2 rounded-xl transition-all text-xs border flex items-center gap-1 shrink-0 shadow-sm ${
              theme === 'dark'
                ? 'bg-white/5 border-white/5 text-white/40 hover:bg-white/20 hover:text-white'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
            }`}
            title={t('timeline_view_details')}
          >
             <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Vertical Timeline Day ─────────────────────────────────────────────────────
export const VerticalTimelineDay = ({
  date, lang, items, onRemove, onSelect, onModeChange, destination, tripStartDate, theme, currency, rates, travelers = 2
}: {
  date: Date; 
  lang: string; 
  items: POI[]; 
  onRemove: (id: string) => void; 
  onSelect: (poi: POI) => void; 
  onModeChange: (id: string, mode: 'car' | 'bus' | 'walk' | 'bicycle') => void;
  destination: string;
  tripStartDate?: string;
  theme?: string;
  currency?: string;
  rates?: any;
  travelers?: number;
}) => {
  const t = createT(lang);
  const iso = toLocalIso(date);
  const { isOver, setNodeRef } = useDroppable({ id: iso });

  const dayStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ', { weekday: 'short' });
  const dateStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ', { month: 'short', day: 'numeric' });
  const totalMins = calcDayDuration(items);

  return (
    <div
      ref={setNodeRef}
      className={`p-6 backdrop-blur-3xl border-2 rounded-[2.5rem] transition-all flex flex-col ${
        theme === 'dark' ? 'bg-zinc-950/60 border-white/5 shadow-none' : 'bg-white border-slate-200/60 shadow-xl shadow-slate-200/20'
        } ${isOver ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01] shadow-2xl' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-white/5 text-left">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400/80">
            {dayStr}
          </span>
          <h3 className={`text-3xl font-black tracking-tighter leading-none transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {dateStr}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <WeatherWidget 
             destination={destination} 
             startDate={tripStartDate} 
             showCompact 
             targetDate={iso}
             theme={theme as any}
             lang={lang}
          />
          <div className="text-right hidden sm:flex flex-col gap-2">
            <div>
              <div className={`text-[9px] font-black uppercase tracking-widest mb-1 transition-colors duration-500 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{t('timeline_total_time')}</div>
              <div className={`text-sm font-black px-3 py-1 rounded-xl transition-all duration-500 ${
                theme === 'dark' 
                  ? 'text-emerald-400 bg-emerald-400/10' 
                  : 'text-emerald-700 bg-emerald-50'
              }`}>
                {formatDuration(totalMins)}
              </div>
            </div>
            
            {(() => {
              const totalDayCost = items.reduce((sum, item) => {
                const amount = item.cost ?? (item.priceInEuro ? parseCost(item.priceInEuro) : 0);
                return sum + (amount || 0);
              }, 0);

              if (totalDayCost === 0) return null;

              const perPerson = totalDayCost / (travelers || 1);
              const rate = rates[currency || 'EUR'] || 1;
              const formattedPrice = new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
                style: 'currency',
                currency: currency || 'EUR',
                maximumFractionDigits: 0
              }).format(perPerson * rate);

              return (
                <div>
                  <div className={`text-[9px] font-black uppercase tracking-widest mb-1 transition-colors duration-500 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{t('timeline_per_person_est')}</div>
                  <div className={`text-sm font-black px-3 py-1 rounded-xl transition-all duration-500 ${
                    theme === 'dark' 
                      ? 'text-blue-400 bg-blue-400/10' 
                      : 'text-blue-700 bg-blue-50'
                  }`}>
                    {formattedPrice}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Nodes Array */}
      <div className="flex flex-col relative pb-4">
        {items.length === 0 ? (
          <div className={`text-center py-12 border-2 border-dashed rounded-3xl mx-2 transition-all duration-500 ${
            theme === 'dark' 
              ? 'border-white/5 bg-transparent' 
              : 'border-slate-200 bg-slate-50/50'
          }`}>
            <Calendar className={`w-8 h-8 mx-auto mb-3 transition-colors ${
              theme === 'dark' ? 'text-white/20' : 'text-slate-300'
            }`} />
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
              theme === 'dark' ? 'text-white/40' : 'text-slate-500'
            }`}>
              {t('timeline_no_activities')}
            </p>
            <p className={`text-[9px] mt-1 uppercase font-bold transition-colors ${
              theme === 'dark' ? 'text-white/20' : 'text-slate-400'
            }`}>
              {t('timeline_drop_here')}
            </p>
          </div>
        ) : (
          items.map((poi, idx) => (
            <React.Fragment key={poi.id}>
              <TimelineNode 
                poi={poi} 
                lang={lang} 
                onRemove={() => onRemove(poi.id)} 
                onSelect={onSelect}
                theme={theme as any}
                currency={currency}
                rates={rates}
              />
              {idx < items.length - 1 && (
                <TransitNode 
                  prev={poi} 
                  next={items[idx + 1]} 
                  onModeChange={(mode) => onModeChange(items[idx + 1].id, mode)}
                  theme={theme as any}
                  lang={lang}
                />
              )}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
};
