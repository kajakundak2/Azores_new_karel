import React, { useEffect, useState, useMemo, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import {
  Map as GoogleMap,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { POI } from '../data';
import { Search, MapPin, X } from 'lucide-react';
import { TEXTS } from '../data';

const DAY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  theme?: 'dark' | 'light';
  lang?: string;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class MapErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // @ts-ignore
  public state: ErrorBoundaryState = { hasError: false, error: undefined };
  // @ts-ignore
  public props: ErrorBoundaryProps;

  // @ts-ignore
  public setState(state: any) { this.state = { ...this.state, ...state }; }

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Map component error caught:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className={`w-full h-full flex items-center justify-center rounded-[3rem] border transition-colors duration-700 ${this.props.theme === 'dark' ? 'bg-zinc-950 border-white/10' : 'bg-[#FCFCFD] border-slate-200'}`}>
          <div className="text-center p-8">
            <MapPin className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <p className={`text-xs font-black uppercase tracking-widest ${this.props.theme === 'dark' ? 'text-white/60' : 'text-slate-900/60'}`}>
              {TEXTS['map_offline']?.[this.props.lang || 'en'] || 'Map Interface Offline'}
            </p>
            <p className={`text-[10px] mt-2 max-w-xs mx-auto ${this.props.theme === 'dark' ? 'text-white/20' : 'text-slate-900/20'}`}>
              {this.state.error?.message || (TEXTS['map_error']?.[this.props.lang || 'en'] || 'The map encountered a glitch. Please try refreshing.')}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-6 px-6 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-500/20 transition-all"
            >
              {TEXTS['map_recover']?.[this.props.lang || 'en'] || 'Recover'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Classic Markers (uses google.maps.Marker — no mapId needed) ───────────────
function ClassicMarkers({
  markers,
  onMarkerClick,
  hoveredId,
  onMarkerHover,
}: {
  markers: { poi: POI; color: string; label?: string }[];
  onMarkerClick: (poi: POI) => void;
  hoveredId?: string | null;
  onMarkerHover?: (poi: POI | null) => void;
}) {
  const map = useMap();
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  // 1. Manage Marker Creation/Deletion
  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    const currentMarkerIds = new Set(markers.map(m => m.poi.id));

    // Delete markers that are no longer in the list
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.setMap(null);
        google.maps.event.clearInstanceListeners(marker);
        markersRef.current.delete(id);
      }
    });

    // Create new markers
    markers.forEach(({ poi, color, label }) => {
      if (!poi.location || markersRef.current.has(poi.id)) return;

      const marker = new google.maps.Marker({
        map,
        position: { lat: poi.location.lat, lng: poi.location.lng },
        label: label ? {
          text: label,
          color: 'white',
          fontSize: '10px',
          fontWeight: '900',
        } : undefined,
      });

      marker.addListener('click', () => onMarkerClick(poi));
      if (onMarkerHover) {
        marker.addListener('mouseover', () => onMarkerHover(poi));
        marker.addListener('mouseout', () => onMarkerHover(null));
      }

      markersRef.current.set(poi.id, marker);
    });

    return () => {
      // Full cleanup on unmount
      markersRef.current.forEach(m => {
        google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      });
      markersRef.current.clear();
    };
  }, [map, markers]); // Note: NO hoveredId here anymore

  // 2. Manage Visual Updates (Hover/Color) independently
  useEffect(() => {
    if (!map) return;
    
    markers.forEach(({ poi, color, label }) => {
      const marker = markersRef.current.get(poi.id);
      if (!marker) return;

      const isHovered = hoveredId === poi.id;
      
      marker.setZIndex(isHovered ? 999 : 1);
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: isHovered ? '#ffffff' : color,
        fillOpacity: 1,
        strokeColor: isHovered ? color : 'white',
        strokeWeight: isHovered ? 4 : 2.5,
        scale: isHovered ? (label ? 18 : 14) : (label ? 14 : 9),
      });
    });
  }, [hoveredId, markers, map]);

  return null;
}

// ── Multimodal Directions Renderer (Using new Route class to avoid legacy deprecation) ─
function MultimodalDirections({
  pois,
  color,
}: {
  pois: POI[];
  color: string;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    // Note: useMapsLibrary returns the library object once loaded
    if (!routesLib || !map) return;
    
    // Clear old polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const located = pois.filter(p => p.location);
    if (located.length < 2) return;

    // Use the new Route class as per modern migration guide
    // We process each segment as a separate Route call to support specific travel modes per segment
    const fetchRoutes = async () => {
      for (let i = 0; i < located.length - 1; i++) {
        const from = located[i];
        const to = located[i + 1];
        
        const mode = to.transportModeTo || 'car';
        let googleMode: any = 'DRIVING';
        if (mode === 'walk') googleMode = 'WALKING';
        if (mode === 'bus') googleMode = 'TRANSIT';
        if (mode === 'bicycle') googleMode = 'BICYCLING';

        try {
          // @ts-ignore - The new Route class is available in the routes library
          const { routes } = await routesLib.Route.computeRoutes({
            origin: { lat: from.location!.lat, lng: from.location!.lng },
            destination: { lat: to.location!.lat, lng: to.location!.lng },
            travelMode: googleMode,
            // Request fields needed for polylines
            // @ts-ignore
            fields: ['path'],
          });

          if (routes && routes.length > 0) {
            // @ts-ignore
            const segmentPolylines = routes[0].createPolylines();
            segmentPolylines.forEach((pline: google.maps.Polyline) => {
              pline.setOptions({
                strokeColor: mode === 'bus' ? '#3b82f6' : mode === 'bicycle' ? '#10b981' : mode === 'walk' ? '#94a3b8' : color,
                strokeWeight: mode === 'walk' ? 4 : 5,
                strokeOpacity: 0.8,
              });
              pline.setMap(map);
              polylinesRef.current.push(pline);
            });
          }
        } catch (error) {
          console.error("Error computing route segment:", error);
        }
      }
    };

    fetchRoutes();

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, pois, color]);

  return null;
}

// ── Main Google Map Component ─────────────────────────────────────────────────
interface GoogleMapViewProps {
  activeDayItems: POI[];
  allDaysData?: { pois: POI[]; dayIndex: number }[];
  showAllDays: boolean;
  activeDayIdx: number;
  activeDayIso: string;
  lang: string;
  onPoiClick?: (poi: POI) => void;
  onAddToDay?: (poi: POI) => void;
  hoveredPoiId?: string | null;
  onMarkerHover?: (poiId: string | null) => void;
  allPois?: POI[];
  tripDestination?: string;
  mapCenter?: { lat: number; lng: number };
  showAtlasMarkers?: boolean;
  theme?: 'dark' | 'light';
}

const AZORES_CENTER = { lat: 37.7412, lng: -25.6667 };

function GoogleMapInner({
  activeDayItems,
  allDaysData,
  showAllDays,
  activeDayIdx,
  activeDayIso,
  lang,
  onPoiClick,
  onAddToDay,
  hoveredPoiId,
  onMarkerHover,
  allPois,
  tripDestination,
  showAtlasMarkers,
  theme = 'dark',
}: GoogleMapViewProps) {
  const t = (key: string) => TEXTS[key]?.[lang] || key;
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [searchResult, setSearchResult] = useState<POI | null>(null);

  // Find hovered POI object for Layla-style preview
  const hoveredPoi = useMemo(() => {
    if (!hoveredPoiId) return null;
    let found = activeDayItems.find(p => p.id === hoveredPoiId);
    if (!found && allDaysData) {
      allDaysData.forEach(d => {
        if (!found) found = d.pois.find(p => p.id === hoveredPoiId);
      });
    }
    if (!found && allPois) {
      found = allPois.find(p => p.id === hoveredPoiId);
    }
    return found || null;
  }, [hoveredPoiId, activeDayItems, allDaysData, allPois]);

  // Build marker data for current day
  const dayMarkerData = useMemo(() => {
    if (showAllDays) return [];
    return activeDayItems
      .filter(p => p.location)
      .map((poi, i) => ({
        poi,
        color: DAY_COLORS[activeDayIdx % DAY_COLORS.length],
        label: `${i + 1}`,
      }));
  }, [activeDayItems, showAllDays, activeDayIdx]);

  // Build marker data for all days
  const allMarkerData = useMemo(() => {
    if (!showAllDays || !allDaysData) return [];
    return allDaysData.flatMap(({ pois, dayIndex }) =>
      pois.filter(p => p.location).map(poi => ({
        poi,
        color: DAY_COLORS[dayIndex % DAY_COLORS.length],
        label: `D${dayIndex + 1}`,
      }))
    );
  }, [showAllDays, allDaysData]);

  // Build marker data for browse-able POIs (darker, no label)
  const browseMarkerData = useMemo(() => {
    if (!showAtlasMarkers || showAllDays || !allPois) return [];
    const dayIds = new Set(activeDayItems.map(p => p.id));
    return allPois
      .filter(p => p.location && !dayIds.has(p.id))
      .map(poi => ({
        poi,
        color: '#475569',
      }));
  }, [showAllDays, allPois, activeDayItems]);

  // Combine all active markers
  const activeMarkers = showAllDays ? allMarkerData : dayMarkerData;

  // Convert Google Place result to a POI
  const handlePlaceSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (!place.geometry?.location) return;
    const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 800 }) ||
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

    const newPoi: POI = {
      id: `places-${place.place_id || Date.now()}`,
      title: { en: place.name || 'Unknown Place', cs: place.name || 'Neznámé místo' },
      description: { en: place.formatted_address || '', cs: place.formatted_address || '' },
      category: categorizePlace(place.types || []),
      duration: 60,
      imageUrl: photoUrl,
      location: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      address: place.formatted_address,
      googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      images: place.photos?.slice(0, 3).map(p => p.getUrl({ maxWidth: 800 })),
    };

    setSearchResult(newPoi);
    setSelectedPoi(null);
  }, []);

  const handleAddResultToDay = useCallback(() => {
    if (searchResult && onAddToDay) {
      onAddToDay(searchResult);
      setSearchResult(null);
    }
  }, [searchResult, onAddToDay]);

  const handleAddPoiToDay = useCallback((poi: POI) => {
    if (onAddToDay) {
      onAddToDay(poi);
      setSelectedPoi(null);
    }
  }, [onAddToDay]);

  const isPoiInActiveDay = useCallback((poiId: string) => {
    return activeDayItems.some(p => p.id === poiId);
  }, [activeDayItems]);

  // Marker click handler
  const onMarkerClick = useCallback((poi: POI) => {
    setSelectedPoi(poi);
    setSearchResult(null);
  }, []);

  // Get the pois for routing
  const routePois = useMemo(() => {
    if (showAllDays) return [];
    return activeDayItems.filter(p => p.location);
  }, [activeDayItems, showAllDays]);

  // Fit bounds to active markers so map is always centered and contained correctly
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!map || !placesLib) return;
    const listener = map.addListener('click', (e: any) => {
      if (e.placeId) {
        if (e.stop) e.stop();
        
        const service = new placesLib.PlacesService(map);
        service.getDetails({ 
          placeId: e.placeId,
          fields: ['name', 'geometry', 'formatted_address', 'rating', 'user_ratings_total', 'photos', 'types', 'place_id', 'url']
        }, (place, status) => {
          if (status === placesLib.PlacesServiceStatus.OK && place) {
            handlePlaceSelect(place);
          }
        });
      } else {
         setSearchResult(null);
         setSelectedPoi(null);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, placesLib, handlePlaceSelect]);


  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    
    activeMarkers.forEach(({ poi }) => {
      if (poi.location) {
        bounds.extend({ lat: poi.location.lat, lng: poi.location.lng });
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { left: 40, right: 40, top: 40, bottom: 40 });
    } else if (tripDestination && geocodingLib) {
      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ address: tripDestination }, (results, status) => {
        if (status === 'OK' && results && results[0] && results[0].geometry.viewport) {
          map.fitBounds(results[0].geometry.viewport, { left: 40, right: 40, top: 40, bottom: 40 });
        } else if (status === 'OK' && results && results[0]) {
          map.setCenter(results[0].geometry.location);
          map.setZoom(10);
        }
      });
    }
  }, [map, activeMarkers, tripDestination, geocodingLib]);

  // Expose bounds to parent for "search within visible area"
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      // We can dispatch an event or use a ref, but actually we can just pass onBoundsChanged if needed.
      // Easiest is to add window.lastMapBounds so usePlacesSearch can grab it directly without React re-renders.
      (window as any).lastMapBounds = map.getBounds();
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  return (
    <>

      {/* Day markers */}
      <ClassicMarkers
        markers={activeMarkers}
        onMarkerClick={onMarkerClick}
        hoveredId={hoveredPoiId}
        onMarkerHover={(poi) => onMarkerHover?.(poi ? poi.id : null)}
      />

      {/* Browse markers */}
      <ClassicMarkers
        markers={browseMarkerData}
        onMarkerClick={onMarkerClick}
        hoveredId={hoveredPoiId}
        onMarkerHover={(poi) => onMarkerHover?.(poi ? poi.id : null)}
      />

      {/* Search result marker (temporary) */}
      {searchResult && searchResult.location && (
        <ClassicMarkers
          markers={[{
            poi: searchResult,
            color: '#f59e0b',
            label: '★',
          }]}
          onMarkerClick={onMarkerClick}
        />
      )}

      {/* Hover Preview - Now as a themed InfoWindow on the map */}
      {hoveredPoi && hoveredPoi.location && (
        <InfoWindow
          position={{ lat: hoveredPoi.location.lat, lng: hoveredPoi.location.lng }}
          headerDisabled
          disableAutoPan
        >
          <div 
            className={`p-2 flex items-center gap-3 w-max max-w-xs shadow-xl rounded-xl transition-all ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-slate-900 outline outline-1 outline-slate-200'}`}
            style={{ 
              backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a'
            }}
          >
            {hoveredPoi.imageUrl ? (
              <img 
                src={hoveredPoi.imageUrl} 
                className="w-12 h-12 rounded-lg object-cover shrink-0" 
                alt="Preview" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                <MapPin className={`w-4 h-4 ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`} />
              </div>
            )}
            <div className="flex-1 truncate pr-2">
              <h4 className="font-bold text-[13px] truncate leading-tight mb-0.5">{hoveredPoi.title[lang] || hoveredPoi.title.en}</h4>
              <p className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{hoveredPoi.category}</p>
              {hoveredPoi.rating && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-400 text-[9px]">★</span>
                  <span className={`text-[9px] font-bold ${theme === 'dark' ? 'text-white/60' : 'text-slate-500'}`}>{hoveredPoi.rating}</span>
                </div>
              )}
            </div>
          </div>
        </InfoWindow>
      )}

      {/* Info Window for POIs */}
      {selectedPoi && selectedPoi.location && (
        <InfoWindow
          position={{ lat: selectedPoi.location.lat, lng: selectedPoi.location.lng }}
          onCloseClick={() => setSelectedPoi(null)}
          headerDisabled
        >
          <div 
            className={`p-4 transition-all duration-500 rounded-[2rem] w-[260px] ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-slate-900'}`} 
            style={{ 
              fontFamily: 'system-ui',
              backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a'
            }}
          >
            {selectedPoi.imageUrl && (
              <img
                src={selectedPoi.imageUrl}
                alt={selectedPoi.title[lang] || selectedPoi.title.en}
                className="w-full h-32 object-cover rounded-2xl mb-3 shadow-lg"
                referrerPolicy="no-referrer"
              />
            )}
            <h3 className={`m-0 mb-1 text-lg font-black tracking-tight uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {selectedPoi.title[lang] || selectedPoi.title.en}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{selectedPoi.category}</span>
              {selectedPoi.rating && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">★ {selectedPoi.rating} <span className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'}>({selectedPoi.reviewCount})</span></span>
              )}
            </div>
            {selectedPoi.duration > 0 && (
              <p className={`m-0 mb-1 text-[11px] font-medium ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>⏱ {selectedPoi.duration} {t('map_duration')}</p>
            )}
            {selectedPoi.priceInEuro && (
              <p className="m-0 mb-2 text-[11px] text-emerald-500 font-black">{selectedPoi.priceInEuro}</p>
            )}
            {selectedPoi.address && (
              <p className={`m-0 mb-2 text-[11px] font-medium leading-relaxed ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>📍 {selectedPoi.address}</p>
            )}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200/10">
              {onAddToDay && !isPoiInActiveDay(selectedPoi.id) && (
                <button
                  onClick={() => handleAddPoiToDay(selectedPoi)}
                  className="flex-1 py-3 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  ＋ {t('map_add_to_day')} {activeDayIdx + 1}
                </button>
              )}
              {isPoiInActiveDay(selectedPoi.id) && (
                <div className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center ${theme === 'dark' ? 'bg-white/5 text-white/30' : 'bg-slate-100 text-slate-400'}`}>
                  ✓ {t('map_in_day')} {activeDayIdx + 1}
                </div>
              )}
              <button
                onClick={() => { onPoiClick?.(selectedPoi); setSelectedPoi(null); }}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-950 hover:bg-slate-200'}`}
              >
                {t('map_details')}
              </button>
            </div>
            {selectedPoi.googleMapsUrl && (
              <a href={selectedPoi.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className={`text-[9px] font-bold text-center block mt-3 uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {t('map_open_google_maps')} →
              </a>
            )}
          </div>
        </InfoWindow>
      )}

      {/* Info Window for search results */}
      {searchResult && searchResult.location && (
        <InfoWindow
          position={{ lat: searchResult.location.lat, lng: searchResult.location.lng }}
          onCloseClick={() => setSearchResult(null)}
          headerDisabled
        >
          <div 
            className={`p-4 transition-all duration-500 rounded-[2rem] w-[260px] ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-slate-900'}`} 
            style={{ 
              fontFamily: 'system-ui',
              backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
              color: theme === 'dark' ? '#ffffff' : '#0f172a'
            }}
          >
            {searchResult.imageUrl && (
              <img
                src={searchResult.imageUrl}
                alt={searchResult.title[lang] || searchResult.title.en}
                className="w-full h-32 object-cover rounded-2xl mb-3 shadow-lg"
                referrerPolicy="no-referrer"
              />
            )}
            <h3 className={`m-0 mb-1 text-lg font-black tracking-tight uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {searchResult.title[lang] || searchResult.title.en}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{searchResult.category}</span>
              {searchResult.rating && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">★ {searchResult.rating} <span className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'}>({searchResult.reviewCount})</span></span>
              )}
            </div>
            {searchResult.address && (
              <p className={`m-0 mb-2 text-[11px] font-medium leading-relaxed ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>📍 {searchResult.address}</p>
            )}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200/10">
              {onAddToDay && (
                <button
                  onClick={handleAddResultToDay}
                  className="flex-1 py-3 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  ＋ {t('map_add_to_day')} {activeDayIdx + 1}
                </button>
              )}
            </div>
            {searchResult.googleMapsUrl && (
              <a href={searchResult.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className={`text-[9px] font-bold text-center block mt-3 uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                {t('map_open_maps')} →
              </a>
            )}
          </div>
        </InfoWindow>
      )}

      {/* Directions for current day */}
      {!showAllDays && routePois.length >= 2 && (
        <MultimodalDirections
          pois={routePois}
          color={DAY_COLORS[activeDayIdx % DAY_COLORS.length]}
        />
      )}
    </>
  );
}

export default function GoogleMapView(props: GoogleMapViewProps) {
  const mapId = (import.meta as any).env?.VITE_GOOGLE_MAP_ID || undefined;

  return (
    <MapErrorBoundary theme={props.theme as any} lang={props.lang}>
      <GoogleMap
        defaultCenter={props.mapCenter || AZORES_CENTER}
        defaultZoom={10}
        mapId={mapId}
        disableDefaultUI={false}
        zoomControl={true}
        mapTypeControl={true}
        streetViewControl={true}
        fullscreenControl={true}
        style={{ width: '100%', height: '100%' }}
        colorScheme={props.theme === 'light' ? 'LIGHT' : 'DARK'}
      >
        <GoogleMapInner {...props} />
      </GoogleMap>
    </MapErrorBoundary>
  );
}

// ── Category Helper ───────────────────────────────────────────────────────────
function categorizePlace(types: string[]): 'Sightseeing' | 'Activity' | 'Food' | 'Transport' | 'Special' {
  if (types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_delivery', 'meal_takeaway'].includes(t))) return 'Food';
  if (types.some(t => ['bus_station', 'train_station', 'airport', 'transit_station', 'taxi_stand', 'car_rental'].includes(t))) return 'Transport';
  if (types.some(t => ['gym', 'stadium', 'amusement_park', 'bowling_alley', 'spa', 'swimming_pool'].includes(t))) return 'Activity';
  if (types.some(t => ['tourist_attraction', 'point_of_interest', 'natural_feature', 'park', 'museum', 'church', 'art_gallery'].includes(t))) return 'Sightseeing';
  return 'Sightseeing';
}
