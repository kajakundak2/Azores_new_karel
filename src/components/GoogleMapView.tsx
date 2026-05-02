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
import { createT } from '../utils/i18n';
import { formatPrice } from '../utils/priceUtils';

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
              {TEXTS['map_offline']?.[this.props.lang || 'en']}
            </p>
            <p className={`text-[10px] mt-2 max-w-xs mx-auto ${this.props.theme === 'dark' ? 'text-white/20' : 'text-slate-900/20'}`}>
              {this.state.error?.message || (TEXTS['map_error']?.[this.props.lang || 'en'])}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-6 px-6 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-500/20 transition-all"
            >
              {TEXTS['map_recover']?.[this.props.lang || 'en']}
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
  const markerLib = useMapsLibrary('marker');
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  // 1. Manage Marker Creation/Deletion
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !markerLib) return;

    const currentMarkerIds = new Set(markers.map(m => m.poi.id));

    // Delete markers that are no longer in the list
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.map = null;
        google.maps.event.clearInstanceListeners(marker);
        markersRef.current.delete(id);
      }
    });

    // Create/Update markers
    markers.forEach(({ poi, color, label }) => {
      if (!poi.location) return;

      let marker = markersRef.current.get(poi.id);
      
      if (!marker) {
        // Create new marker
        const pin = new markerLib.PinElement({
          background: color,
          borderColor: 'white',
          glyphText: label || '',
          glyphColor: 'white',
        });

        marker = new markerLib.AdvancedMarkerElement({
          map,
          position: { lat: poi.location.lat, lng: poi.location.lng },
          content: pin.element,
          title: poi.title.en || poi.title.cs,
        });

        markersRef.current.set(poi.id, marker);
      }

      // Update listeners to use latest POI capture
      google.maps.event.clearInstanceListeners(marker);
      marker.addListener('click', () => onMarkerClick(poi));
      if (onMarkerHover) {
        marker.addListener('mouseover', () => onMarkerHover(poi));
        marker.addListener('mouseout', () => onMarkerHover(null));
      }
    });

    return () => {
      // Full cleanup on unmount
      markersRef.current.forEach(m => {
        google.maps.event.clearInstanceListeners(m);
        m.map = null;
      });
      markersRef.current.clear();
    };
  }, [map, markers, markerLib, onMarkerClick, onMarkerHover]);

  // 2. Manage Visual Updates (Hover/Color) independently
  useEffect(() => {
    if (!map || !markerLib) return;
    
    markers.forEach(({ poi, color, label }) => {
      const marker = markersRef.current.get(poi.id);
      if (!marker) return;

      const isHovered = hoveredId === poi.id;
      
      marker.zIndex = isHovered ? 999 : 1;
      
      const pin = new markerLib.PinElement({
        background: isHovered ? '#ffffff' : color,
        borderColor: isHovered ? color : 'white',
        glyphText: label || '',
        glyphColor: isHovered ? color : 'white',
        scale: isHovered ? (label ? 1.4 : 1.2) : (label ? 1.2 : 0.9),
      });

      marker.content = pin.element;
    });
  }, [hoveredId, markers, map, markerLib]);

  return null;
}

// ── Multimodal Directions Renderer (Using Routes API with manual Polyline rendering) ─
function MultimodalDirections({
  pois,
  color,
  lang = 'en',
}: {
  pois: POI[];
  color: string;
  lang?: string;
}) {
  const map = useMap();
  const geometryLib = useMapsLibrary('geometry');
  const markerLib = useMapsLibrary('marker');
  const mapObjectsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.routes?.Route || !geometryLib || !markerLib) return;
    
    // Clear old map objects (Handles both Polylines and AdvancedMarkerElements)
    mapObjectsRef.current.forEach(obj => {
      if (typeof obj.setMap === 'function') {
        obj.setMap(null);
      } else {
        obj.map = null;
      }
    });
    mapObjectsRef.current = [];

    const located = pois.filter(p => p.location);
    if (located.length < 2) return;

    const modeToTravelMode: Record<string, string> = {
      car: 'DRIVING',
      walk: 'WALKING',
      bus: 'TRANSIT',
      bicycle: 'BICYCLING',
    };

    const fetchRoutes = async () => {
      for (let i = 0; i < located.length - 1; i++) {
        const from = located[i];
        const to = located[i + 1];
        
        const mode = to.transportModeTo || 'car';
        const googleMode = modeToTravelMode[mode] || 'DRIVING';

        const fallbackPoints = [
          { lat: from.location!.lat, lng: from.location!.lng },
          { lat: to.location!.lat, lng: to.location!.lng },
        ];

        try {
          const request: any = {
            origin: { lat: from.location!.lat, lng: from.location!.lng },
            destination: { lat: to.location!.lat, lng: to.location!.lng },
            travelMode: googleMode,
            fields: ['*'], // Request deep transit and scheduling details
          };

          if (googleMode === 'TRANSIT') {
            request.departureTime = new Date();
            request.computeAlternativeRoutes = true;
          }

          const response = await google.maps.routes.Route.computeRoutes(request);

          if (response.routes && response.routes.length > 0) {
            const route = response.routes[0];
            
            // Helper to safely extract coordinates natively or from legacy classes
            const getPt = (p: any) => ({
              lat: typeof p.lat === 'function' ? p.lat() : p.lat,
              lng: typeof p.lng === 'function' ? p.lng() : p.lng
            });

            if (googleMode === 'TRANSIT' && route.legs) {
              for (const leg of route.legs) {
                if (!leg.steps) continue;
                
                for (const step of leg.steps) {
                  let stepPathPoints: google.maps.LatLngLiteral[] = [];
                  
                  if ((step as any).polyline?.encodedPolyline) {
                    const decoded = geometryLib.encoding.decodePath((step as any).polyline.encodedPolyline);
                    stepPathPoints = decoded.map(getPt);
                  } else if ((step as any).path) {
                    stepPathPoints = (step as any).path.map(getPt);
                  } else if ((step as any).startLocation && (step as any).endLocation) {
                    stepPathPoints.push(getPt((step as any).startLocation));
                    stepPathPoints.push(getPt((step as any).endLocation));
                  }
                  
                  if (stepPathPoints.length < 2) continue;

                  const isWalking = (step as any).travelMode === 'WALK' || (step as any).travelMode === 'WALKING';
                  const isTransit = (step as any).travelMode === 'TRANSIT';
                  
                  const stepColor = isTransit ? ((step as any).transitDetails?.line?.color || '#3b82f6') : (isWalking ? '#0ea5e9' : color);
                  
                  const polyline = new google.maps.Polyline({
                    path: stepPathPoints,
                    strokeColor: stepColor,
                    strokeOpacity: isWalking ? 0 : 0.8,
                    strokeWeight: isWalking ? 0 : 6,
                    icons: isWalking ? [{
                      icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 4, scale: 1 },
                      offset: '0',
                      repeat: '10px'
                    }] : [],
                    map: map,
                    zIndex: isTransit ? 50 : 10,
                  });
                  mapObjectsRef.current.push(polyline);
                  
                  // Inject Detailed Transit Schedule Pop-Up
                  if (isTransit && (step as any).transitDetails) {
                    const details = (step as any).transitDetails;
                    const t = createT(lang);
                    const lineInfo = details.transitLine || details.line;
                    const vehicleName = lineInfo?.vehicle?.name || 'Transit';
                    const shortName = lineInfo?.shortName || lineInfo?.name || '';
                    
                    const getFmtTime = (nested: any) => {
                      if (details.localizedValues?.[nested]?.time?.text) return details.localizedValues[nested].time.text;
                      const r = details.stopDetails?.[nested] || details[nested];
                      if (r?.text) return r.text;
                      if (r instanceof Date) return r.toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute:'2-digit' });
                      if (typeof r === 'string') return new Date(r).toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute:'2-digit' });
                      return 'N/A';
                    };

                    const alternatives: { departureTime: string, arrivalTime: string }[] = [];
                    if (response.routes.length > 1) {
                      response.routes.slice(1).forEach((altRoute: any) => {
                        const altLeg = altRoute.legs?.[0];
                        const altTransitStep = altLeg?.steps?.find((s: any) => s.travelMode === 'TRANSIT');
                        const altTd = altTransitStep?.transitDetails;
                        if (altTd) {
                          const dep = getFmtTimeAltMap(altTd, 'departureTime');
                          const arr = getFmtTimeAltMap(altTd, 'arrivalTime');
                          if (dep && arr) alternatives.push({ departureTime: dep, arrivalTime: arr });
                        }
                      });
                    }

                    function getFmtTimeAltMap(td: any, nested: any) {
                      if (td.localizedValues?.[nested]?.time?.text) return td.localizedValues[nested].time.text;
                      const r = td.stopDetails?.[nested] || td[nested];
                      if (r?.text) return r.text;
                      if (r instanceof Date) return r.toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute:'2-digit' });
                      if (typeof r === 'string') return new Date(r).toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute:'2-digit' });
                      return '';
                    }

                    const infoWin = new google.maps.InfoWindow({
                      content: `
                        <div style="padding: 10px; font-family: system-ui; min-width: 220px; color: #0f172a;">
                          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <div style="background: ${stepColor}; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 12px; letter-spacing: 0.5px;">
                              🚌 ${shortName}
                            </div>
                            <span style="font-size: 13px; font-weight: 700; color: #334155;">${vehicleName}</span>
                          </div>
                          <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; align-items: flex-start; gap: 10px;">
                              <div style="margin-top: 2px;">🟢</div>
                              <div>
                                <div style="font-weight: 700; max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${details.stopDetails?.departureStop?.name || details.departureStop?.name || 'Start stop'}</div>
                                <div style="color: #64748b; font-size: 12px; font-weight: 500;">${t('transport_departs')}: ${getFmtTime('departureTime')}</div>
                              </div>
                            </div>
                            <div style="border-left: 2px dashed #cbd5e1; margin-left: 9px; padding-left: 18px; color: #64748b; font-size: 11px; font-weight: 600; height: 24px; display: flex; align-items: center;">
                              ${details.stopCount || 0} ${t('transit_stops')}
                            </div>
                            <div style="display: flex; align-items: flex-start; gap: 10px;">
                              <div style="margin-top: 2px;">📍</div>
                              <div>
                                <div style="font-weight: 700; max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${details.stopDetails?.arrivalStop?.name || details.arrivalStop?.name || 'End stop'}</div>
                                <div style="color: #64748b; font-size: 12px; font-weight: 500;">${t('transit_arrives')}: ${getFmtTime('arrivalTime')}</div>
                              </div>
                            </div>
                          </div>
                          ${alternatives.length > 0 ? `
                            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #f1f5f9;">
                              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${t('transit_other_times')}</div>
                              <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${alternatives.map(alt => `
                                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #475569;">
                                    <span>🚌 ${alt.departureTime}</span>
                                    <span style="color: #94a3b8;">→ ${alt.arrivalTime}</span>
                                  </div>
                                `).join('')}
                              </div>
                            </div>
                          ` : ''}
                        </div>
                      `,
                    });
                    
                    // Create a modern custom UI tag for the transit marker
                    const pinContainer = document.createElement('div');
                    pinContainer.style.backgroundColor = stepColor;
                    pinContainer.style.borderRadius = '8px';
                    pinContainer.style.padding = '4px 8px';
                    pinContainer.style.color = 'white';
                    pinContainer.style.fontWeight = 'bold';
                    pinContainer.style.fontSize = '12px';
                    pinContainer.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
                    pinContainer.style.border = '2px solid white';
                    pinContainer.style.cursor = 'pointer';
                    pinContainer.textContent = '🚌 ' + shortName;

                    const marker = new markerLib.AdvancedMarkerElement({
                      map,
                      position: stepPathPoints[0],
                      content: pinContainer,
                      title: `${vehicleName} ${shortName} Schedule`,
                      zIndex: 100,
                    });
                    mapObjectsRef.current.push(marker);

                    // Block click from bubbling down to the underlying map POIs
                    const preventAndOpen = (e: any) => {
                      if (e.stop) e.stop(); // Stops Maps native click (avoids e.placeId firing)
                      if (e.domEvent) e.domEvent.stopPropagation(); // Stops DOM bubbling
                    };

                    marker.addListener('click', (e: any) => {
                      preventAndOpen(e);
                      infoWin.open(map, marker);
                    });

                    // Clicking the drawn bus line will ALSO open the schedule without opening Google Maps links
                    polyline.addListener('click', (e: any) => {
                      preventAndOpen(e);
                      infoWin.setPosition(e.latLng);
                      infoWin.open(map);
                    });
                  }
                }
              }
            } else {
              // =========================================================================
              // SINGLE-MODE ROUTES (Car, Bicycle, Pure Walking)
              // =========================================================================
              let pathPoints: google.maps.LatLngLiteral[] = [];
              if ((route as any).polyline && (route as any).polyline.encodedPolyline) {
                const decoded = geometryLib.encoding.decodePath((route as any).polyline.encodedPolyline);
                pathPoints = decoded.map(getPt);
              } else if ((route as any).path) {
                pathPoints = (route as any).path.map(getPt);
              } else if (route.legs) {
                for (const leg of route.legs) {
                  if (leg.steps) {
                    for (const step of leg.steps) {
                      if ((step as any).polyline?.encodedPolyline) {
                        const decoded = geometryLib.encoding.decodePath((step as any).polyline.encodedPolyline);
                        pathPoints.push(...decoded.map(getPt));
                      } else if ((step as any).path) {
                        pathPoints.push(...(step as any).path.map(getPt));
                      } else if ((step as any).startLocation && (step as any).endLocation) {
                        pathPoints.push(getPt((step as any).startLocation));
                        pathPoints.push(getPt((step as any).endLocation));
                      }
                    }
                  }
                }
              }

              if (pathPoints.length < 2) pathPoints = fallbackPoints;

              const isPureWalking = mode === 'walk';
              const polyline = new google.maps.Polyline({
                path: pathPoints,
                strokeColor: mode === 'bicycle' ? '#10b981' : isPureWalking ? '#0ea5e9' : color,
                strokeWeight: isPureWalking ? 0 : 4,
                strokeOpacity: isPureWalking ? 0 : 0.8,
                icons: isPureWalking ? [{
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeWeight: 4, scale: 1 },
                  offset: '0',
                  repeat: '10px'
                }] : [],
                map: map,
              });
              mapObjectsRef.current.push(polyline);
            }
          }
        } catch (error) {
          console.error("Error computing route segment:", error);
          const polyline = new google.maps.Polyline({
            path: fallbackPoints,
            strokeColor: color,
            strokeWeight: 3,
            strokeOpacity: 0.4,
            geodesic: true,
            map: map,
          });
          mapObjectsRef.current.push(polyline);
        }
      }
    };

    fetchRoutes();

    return () => {
      mapObjectsRef.current.forEach(obj => {
        if (typeof obj.setMap === 'function') obj.setMap(null);
        else obj.map = null;
      });
      mapObjectsRef.current = [];
    };
  }, [map, pois, color, geometryLib, markerLib, lang]);

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
  currency?: 'EUR' | 'CZK' | 'USD' | string;
  rates?: Record<string, number>;
}

const DEFAULT_CENTER = { lat: 0, lng: 0 };

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
  currency = 'EUR',
  rates = {},
}: GoogleMapViewProps) {
  const t = createT(lang);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [searchResult, setSearchResult] = useState<POI | null>(null);

  const getConvertedPrice = useCallback((poiItem: POI) => {
    return formatPrice(poiItem.cost, poiItem.priceInEuro, currency || 'EUR', rates || {}, lang);
  }, [currency, rates, lang]);

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

  // Convert Google Place result or direct POI to a selected marker
  const handlePlaceSelect = useCallback((placeOrPoi: any) => {
    if (!placeOrPoi) return;

    // 1. Identify the unique identifier (Google Place ID or our internal ID)
    const pid = placeOrPoi.place_id || placeOrPoi.googlePlaceId || placeOrPoi.id;

    // 2. CHECK IF WE ALREADY HAVE THIS POI IN OUR DATA (to preserve AI enrichment)
    // This is critical for keeping AI descriptions across different ways of opening the same place
    const existing = allPois.find(p => p.id === pid || (p.googlePlaceId && p.googlePlaceId === pid));
    if (existing) {
      setSearchResult(existing);
      setSelectedPoi(null);
      return;
    }

    // 3. If it's already a POI but not found in our data (new search result)
    if ('location' in placeOrPoi && !('place_id' in placeOrPoi)) {
      setSearchResult(placeOrPoi);
      setSelectedPoi(null);
      return;
    }

    // 4. Otherwise, treat as legacy PlaceResult
    const place = placeOrPoi as google.maps.places.PlaceResult;
    if (!place.geometry?.location) return;

    const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 800 }) ||
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

    const newPoi: POI = {
      id: place.place_id || `places-${Date.now()}`,
      googlePlaceId: place.place_id ?? undefined,
      title: { en: place.name || t('unknown_place'), cs: place.name || t('unknown_place') },
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
  }, [allPois, t]);

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
    if (!map || !placesLib || typeof google === 'undefined') return;
    const clickListener = map.addListener('click', async (e: any) => {
      if (e.placeId) {
        if (e.stop) e.stop();
        
        try {
          const { Place } = google.maps.places;
          const place = new Place({ id: e.placeId });
          await place.fetchFields({
            fields: ['displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'photos', 'types', 'id', 'googleMapsURI', 'priceLevel', 'editorialSummary']
          });
          
          import('../hooks/usePlacesSearch').then(({ newPlaceToPOI }) => {
            const newPoi = newPlaceToPOI(place as any);
            if (newPoi) handlePlaceSelect(newPoi);
          });
        } catch (error) {
          console.error('Error fetching place details:', error);
        }
      } else {
         setSearchResult(null);
         setSelectedPoi(null);
      }
    });

    const contextListener = map.addListener('contextmenu', (e: any) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        const droppedPoi: POI = {
          id: `dropped-${Date.now()}`,
          title: { en: t('dropped_pin') || 'Dropped Pin', cs: t('dropped_pin') || 'Přidaný bod' },
          category: 'Special',
          duration: 60,
          location: { lat, lng },
          address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        };
        handlePlaceSelect(droppedPoi);
      }
    });

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(contextListener);
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
                alt={t('map_preview')} 
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
            {(selectedPoi.cost || selectedPoi.priceInEuro) ? (
              <p className="m-0 mb-2 text-[11px] text-emerald-500 font-black">{getConvertedPrice(selectedPoi)}</p>
            ) : (selectedPoi.category === 'Sightseeing' || selectedPoi.category === 'Activity') ? (
              <p className="m-0 mb-2 text-[11px] text-slate-400 font-medium">🎟 {lang === 'cs' ? 'Zkontrolujte případné vstupné' : 'Check for entrance fees'}</p>
            ) : null}
            {selectedPoi.description && (
              <p className={`m-0 mb-2 text-[11px] font-medium leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>{selectedPoi.description[lang] || selectedPoi.description.en}</p>
            )}
            {selectedPoi.address && !selectedPoi.description && (
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
            {(searchResult.cost || searchResult.priceInEuro) ? (
              <p className="m-0 mb-2 text-[11px] text-emerald-500 font-black">{getConvertedPrice(searchResult)}</p>
            ) : (searchResult.category === 'Sightseeing' || searchResult.category === 'Activity') ? (
              <p className="m-0 mb-2 text-[11px] text-slate-400 font-medium">🎟 {lang === 'cs' ? 'Zkontrolujte případné vstupné' : 'Check for entrance fees'}</p>
            ) : null}
            {searchResult.description && (
              <p className={`m-0 mb-2 text-[11px] font-medium leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>{searchResult.description[lang] || searchResult.description.en}</p>
            )}
            {searchResult.address && !searchResult.description && (
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
              <button
                onClick={() => { onPoiClick?.(searchResult); setSearchResult(null); }}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-950 hover:bg-slate-200'}`}
              >
                {t('map_details')}
              </button>
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
          lang={lang}
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
        defaultCenter={props.mapCenter || DEFAULT_CENTER}
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
