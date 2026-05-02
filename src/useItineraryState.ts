import { useState, useCallback, useEffect, useMemo } from 'react';
import { POI, FIXED_EVENTS, Trip, Stay, Flight } from './data';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { searchPlacesAsync } from './hooks/usePlacesSearch';

/** Parse YYYY-MM-DD into a local Date object */
export function parseDateString(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Format Date object back to YYYY-MM-DD (local time) */
export function toLocalIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Auto-calculate next available time slot for a day's itinerary. */
function getNextTime(items: POI[]): string {
    if (items.length === 0) return '09:00';
    // Find the latest "end time" across all existing items
    let latestEndMins = 9 * 60; // default 09:00
    for (const item of items) {
        if (!item.time) continue;
        const [h, m] = item.time.split(':').map(Number);
        const endMins = h * 60 + m + (item.duration || 60);
        if (endMins > latestEndMins) latestEndMins = endMins;
    }
    const clampedMins = Math.min(latestEndMins, 22 * 60); // cap at 22:00
    return `${String(Math.floor(clampedMins / 60)).padStart(2, '0')}:${String(clampedMins % 60).padStart(2, '0')}`;
}

/** 
 * Clean up object for Firestore by removing any 'undefined' values.
 * Firestore throws errors on 'undefined' but handles missing keys fine.
 */
function sanitizeForFirestore(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    } else if (obj !== null && typeof obj === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = sanitizeForFirestore(value);
            }
        }
        return cleaned;
    }
    return obj;
}

/** Format duration in minutes to a human-readable string. */
export function formatDuration(minutes: number): string {
    if (minutes === 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
}

/** 
 * Keep stay markers in sync with the logistics.stays list.
 * Removes old markers and adds new ones based on check-in/out dates.
 */
export function syncStaysToItinerary(stays: any[], itinerary: Record<string, POI[]>): Record<string, POI[]> {
    const newItinerary = { ...itinerary };
    
    // 1. Remove all old stay markers (identified by ID prefix)
    for (const date in newItinerary) {
        newItinerary[date] = newItinerary[date].filter(poi => !poi.id.startsWith('stay-marker-'));
    }
    
    // 2. Add new stay markers
    stays.forEach(stay => {
        let current = parseDateString(stay.checkInDate);
        const checkOut = parseDateString(stay.checkOutDate);
        
        while (current <= checkOut) {
            const iso = toLocalIso(current);
            if (!newItinerary[iso]) newItinerary[iso] = [];
            
            // Check if already has a stay marker for this day
            if (!newItinerary[iso].some(poi => poi.id.startsWith('stay-marker-'))) {
                newItinerary[iso].push({
                    id: `stay-marker-${iso}`,
                    title: { en: `🏨 ${stay.name}`, cs: `🏨 ${stay.name}` },
                    description: { 
                        en: `Stay at ${stay.address || 'extracted location'}`, 
                        cs: `Ubytování v ${stay.address || 'extrahovaná adresa'}` 
                    },
                    category: 'Special',
                    duration: 0,
                    time: '08:00',
                    imageUrl: stay.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
                    fixed: true,
                    location: stay.location || { lat: 0, lng: 0 },
                });
            }
            current.setDate(current.getDate() + 1);
        }
    });
    
    return newItinerary;
}

/** Calculate total duration of a day in hours. */
export function calcDayDuration(items: POI[]): number {
    return items.reduce((sum, item) => sum + (item.duration || 0), 0);
}

/** Serialize the entire trip state into a rich text context for Sara AI. */
export function getFullTripContext(trip: Trip | null, itinerary: Record<string, POI[]>): string {
    if (!trip) return 'No active trip.';
    const startDate = parseDateString(trip.startDate);
    const endDate = parseDateString(trip.endDate);
    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

    let ctx = `=== TRIP ===\nTitle: ${trip.title} | Destination: ${trip.destination}\n`;
    ctx += `Dates: ${trip.startDate} → ${trip.endDate} (${totalDays} days)\n`;
    ctx += `Travelers: ${trip.travelers} total (${trip.adults || trip.travelers} adults, ${trip.kids || 0} kids)`;
    if (trip.kidsAges?.length) ctx += ` | Kids ages: ${trip.kidsAges.join(', ')}`;
    ctx += '\n';
    if (trip.preferences) ctx += `Preferences: ${trip.preferences}\n`;
    if (trip.planningMode) ctx += `Planning mode: ${trip.planningMode}\n`;

    // Traveler profiles
    if (trip.travelerProfiles?.length) {
        ctx += '\n=== TRAVELERS ===\n';
        trip.travelerProfiles.forEach(p => ctx += `- ${p.name} (${p.gender}${p.age ? `, age ${p.age}` : ''})\n`);
    }

    // Stays
    if (trip.logistics?.stays?.length) {
        ctx += '\n=== STAYS ===\n';
        trip.logistics.stays.forEach(s => {
            ctx += `- ${s.name}: ${s.checkInDate} → ${s.checkOutDate} (${s.nights} nights)`;
            if (s.pricePerNight) ctx += `, €${s.pricePerNight}/night`;
            if (s.address) ctx += `, ${s.address}`;
            if (s.rating) ctx += `, rating: ${s.rating}`;
            ctx += '\n';
        });
    }

    // Flights
    if (trip.logistics?.flights?.length) {
        ctx += '\n=== FLIGHTS ===\n';
        trip.logistics.flights.forEach(f => {
            ctx += `- ${f.direction}: ${f.airline}, ${f.departureAirport} → ${f.arrivalAirport}`;
            ctx += `, depart: ${f.departureTime}, arrive: ${f.arrivalTime}`;
            if (f.price) ctx += `, ${f.price}`;
            if (f.stops > 0) ctx += `, ${f.stops} stop(s)`;
            ctx += '\n';
        });
    }

    // Itinerary with full POI details
    ctx += '\n=== ITINERARY ===\n';
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dayIso = toLocalIso(d);
        const dayPois = itinerary[dayIso] || [];
        const theme = trip.dayThemes?.[dayIso];
        ctx += `\nDay ${i + 1} (${dayIso})`;
        if (theme) ctx += ` [Theme: "${theme}"]`;
        ctx += '\n';
        if (dayPois.length === 0) {
            ctx += '  (empty)\n';
        } else {
            dayPois.forEach((p, idx) => {
                const title = typeof p.title === 'string' ? p.title : p.title.en;
                ctx += `  ${idx + 1}. ${title} [${p.category}]`;
                if (p.time) ctx += ` — ${p.time}`;
                if (p.duration) ctx += `, ${p.duration}min`;
                if (p.cost) ctx += `, €${p.cost}`;
                if (p.transportModeTo) ctx += `, transport: ${p.transportModeTo}`;
                ctx += '\n';
                if (p.address) ctx += `     Address: ${p.address}\n`;
                if (p.rating) ctx += `     Rating: ${p.rating}${p.reviewCount ? ` (${p.reviewCount} reviews)` : ''}\n`;
            });
        }
    }

    // Budget summary
    let staysCost = 0, actCost = 0, flightsCost = 0;
    trip.logistics?.stays?.forEach(s => { if (s.pricePerNight) staysCost += s.pricePerNight * s.nights; });
    Object.values(itinerary).forEach(pois => pois.forEach(p => { if (p.cost) actCost += p.cost; }));
    trip.logistics?.flights?.forEach(f => { if (f.price) flightsCost += parseFloat(f.price.replace(/[^0-9.]/g, '')) || 0; });
    if (staysCost || actCost || flightsCost) {
        ctx += `\n=== BUDGET ===\n`;
        ctx += `Stays: €${staysCost} | Activities: €${actCost} | Flights: €${flightsCost} | Total: €${staysCost + actCost + flightsCost}\n`;
    }

    // Packing
    if (trip.logistics?.packingRequirements) {
        ctx += `\n=== PACKING ===\nRequirements: ${trip.logistics.packingRequirements}\n`;
    }

    // Library
    if (trip.libraryPois?.length) {
        ctx += `\n=== LIBRARY (${trip.libraryPois.length} saved places) ===\n`;
        trip.libraryPois.slice(0, 20).forEach(p => {
            const title = typeof p.title === 'string' ? p.title : p.title.en;
            ctx += `- ${title} [${p.category}]`;
            if (p.address) ctx += ` — ${p.address}`;
            ctx += '\n';
        });
    }

    // Reference documents
    if (trip.referenceDocs?.length) {
        ctx += `\n=== REFERENCE DOCUMENTS ===\n`;
        trip.referenceDocs.forEach(d => {
            ctx += `- ${d.name}: ${d.content.substring(0, 3000)}\n`;
        });
    }

    return ctx;
}

export interface TripState {
    trips: Trip[];
    activeTripId: string | null;
    activeTrip: Trip | null;
    
    // Legacy mapping to active trip for partial backwards compatibility
    itinerary: Record<string, POI[]>;
    days: Date[];
    customPois: POI[];
    
    addPoi: (dayIso: string, poi: POI) => Promise<void>;
    removePoi: (dayIso: string, poiId: string) => Promise<void>;
    addCustomPoi: (poi: POI) => Promise<void>;
    updatePoiTransportMode: (dayIso: string, poiId: string, mode: 'car' | 'bus' | 'walk' | 'bicycle') => Promise<void>;
    getJsonContext: () => string;
    clearDay: (dayIso: string) => Promise<void>;
    clearItinerary: () => Promise<void>;
    
    // Trip CRUD
    setActiveTripId: (id: string | null) => void;
    createTrip: (tripData: Partial<Trip>) => Promise<string>;
    updateTrip: (id: string, tripData: Partial<Trip>) => Promise<void>;
    deleteTrip: (id: string) => Promise<void>;
    addReferenceDoc: (doc: { name: string; content: string }) => Promise<void>;
    removeReferenceDoc: (docId: string) => Promise<void>;
    updatePoi: (poi: POI) => Promise<void>;
    isGeneratingLibrary: boolean;

    // Sara AI atomic mutations
    movePoi: (fromDayIso: string, toDayIso: string, poiId: string) => Promise<void>;
    modifyPoi: (dayIso: string, poiId: string, changes: Partial<POI>) => Promise<void>;
    reorderPois: (dayIso: string, orderedIds: string[]) => Promise<void>;
    addStay: (stay: Omit<Stay, 'id'>) => Promise<void>;
    removeStay: (stayId: string) => Promise<void>;
    modifyStay: (stayId: string, changes: Partial<Stay>) => Promise<void>;
    addFlight: (flight: Omit<Flight, 'id'>) => Promise<void>;
    removeFlight: (flightId: string) => Promise<void>;
    addDay: () => Promise<void>;
    removeDay: (dayIso: string) => Promise<void>;
    setDayTheme: (dayIso: string, theme: string) => Promise<void>;
    addToLibrary: (poi: POI) => Promise<void>;
    removeFromLibrary: (poiId: string) => Promise<void>;
}

export function useItineraryState(): TripState {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [customPois, setCustomPois] = useState<POI[]>([]);
    const [isGeneratingLibrary, setIsGeneratingLibrary] = useState(false);
    
    const tripsCollectionRef = collection(db, 'trips');
    const customPoisDocRef = doc(db, 'custom-pois', 'global');

    // ── Firestore Sync ──────────────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribeTrips = onSnapshot(tripsCollectionRef, (snap) => {
            const fetchedTrips = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
            setTrips(fetchedTrips);
        });

        const unsubscribeCustom = onSnapshot(customPoisDocRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as { pois: POI[] };
                if (data.pois) setCustomPois(data.pois);
            }
        });

        return () => {
            unsubscribeTrips();
            unsubscribeCustom();
        };
    }, []);

    const activeTrip = trips.find(t => t.id === activeTripId) || null;
    const itinerary = activeTrip?.itinerary || {};

    const days = useMemo(() => {
        if (!activeTrip) return [];
        const start = parseDateString(activeTrip.startDate);
        const end = parseDateString(activeTrip.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

        const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        return Array.from({ length: total }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [activeTrip?.startDate, activeTrip?.endDate]);

    // Auto-generate base library using AI if it's missing or empty
    useEffect(() => {
        if (!activeTrip || !activeTrip.id || isGeneratingLibrary) return;
        
        const needsLibrary = !activeTrip.libraryPois || activeTrip.libraryPois.length === 0;
        const needsVideos = !activeTrip.inspirationVideos || activeTrip.inspirationVideos.length === 0;

        if ((needsLibrary || needsVideos) && typeof google !== 'undefined' && google.maps?.places?.Place) {
            setIsGeneratingLibrary(true);
            
            async function generateTripAssets() {
                try {
                    const updates: Partial<Trip> = {};

                    if (needsLibrary) {
                        const prefs = activeTrip!.preferences ? `, focusing on: ${activeTrip!.preferences}` : '';
                        const startMonth = activeTrip!.startDate ? new Date(activeTrip!.startDate).toLocaleString('en-US', { month: 'long' }) : '';
                        const seasonQuery = startMonth ? ` top activities in ${startMonth}` : ' top tourist attractions and restaurants';
                        
                        console.log(`Generating Trip Assets for ${activeTrip!.destination} (${startMonth})${prefs}`);
                        
                        const query = `${activeTrip!.destination}${seasonQuery}${prefs}`;
                        const items = await searchPlacesAsync(query);
                        updates.libraryPois = items;
                    }

                    if (needsVideos) {
                        console.log('Researching inspiration videos via Pexels for:', activeTrip!.destination);
                        const pexelsKey = 'DrEuksUKaDCjKXcfM5P3ePBi3dP20ufRvk5vBynnMEaWDggIqLO3ALXk';
                        
                        try {
                            const response = await fetch(`https://api.pexels.com/v1/videos/search?query=${activeTrip!.destination} nature landscape cinematic&orientation=portrait&per_page=6`, {
                                headers: { Authorization: pexelsKey }
                            });
                            const data = await response.json();
                            
                            const pexelsVideos = (data.videos || []).map((v: any) => ({
                                id: v.id,
                                video: v.video_files.find((f: any) => f.quality === 'hd' || f.width >= 1080)?.link || v.video_files[0].link,
                                label: v.user.name,
                                thumbnail: v.image
                            }));

                            // If no videos found, use a fallback quality one
                            if (pexelsVideos.length === 0) {
                                pexelsVideos.push({
                                    id: 999,
                                    video: 'https://cdn.dev.beautifuldestinations.app/16891d31-1a48-4828-9814-8593e579ee09/original.mp4',
                                    label: 'Beautiful Destinations',
                                    thumbnail: 'https://images.pexels.com/photos/13911606/pexels-photo-13911606.jpeg?auto=compress&cs=tinysrgb&w=600'
                                });
                            }
                            
                            updates.inspirationVideos = pexelsVideos.slice(0, 4);
                        } catch (err) {
                            console.error('Pexels fetch failed:', err);
                            updates.inspirationVideos = [
                                { id: 1, video: 'https://assets.mixkit.co/videos/preview/mixkit-mysterious-waterfall-in-a-lush-green-jungle-4281-large.mp4', label: 'Nature' },
                                { id: 2, video: 'https://assets.mixkit.co/videos/preview/mixkit-beautiful-landscape-of-mountains-and-a-lake-4284-large.mp4', label: 'Views' }
                            ];
                        }
                    }

                    // Save to Firestore
                    await updateDoc(doc(db, 'trips', activeTrip!.id), sanitizeForFirestore(updates));
                } catch (err) {
                    console.error('Failed to generate trip assets:', err);
                } finally {
                    setIsGeneratingLibrary(false);
                }
            }
            
            generateTripAssets();
        }
    }, [activeTrip?.id, activeTrip?.destination, activeTrip?.libraryPois?.length, activeTrip?.inspirationVideos?.length]);

    const addPoi = useCallback(async (dayIso: string, poi: POI) => {
        if (!activeTripId || !activeTrip) return;
        
        const currentItems = itinerary[dayIso] || [];
        if (currentItems.find(i => i.id === poi.id)) return;

        const autoTime = getNextTime(currentItems);
        const poiWithTime: POI = { ...poi, time: poi.time ?? autoTime };
        
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`itinerary.${dayIso}`]: arrayUnion(sanitizeForFirestore(poiWithTime))
        });
    }, [activeTripId, activeTrip, itinerary]);

    const removePoi = useCallback(async (dayIso: string, poiId: string) => {
        if (!activeTripId || !activeTrip) return;

        const itemToRemove = (itinerary[dayIso] || []).find(i => i.id === poiId);
        if (!itemToRemove || itemToRemove.fixed) return;

        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`itinerary.${dayIso}`]: arrayRemove(itemToRemove)
        });
    }, [activeTripId, activeTrip, itinerary]);

    const clearDay = useCallback(async (dayIso: string) => {
        if (!activeTripId || !activeTrip) return;
        
        const currentItems = itinerary[dayIso] || [];
        const itemsToKeep = currentItems.filter(i => i.fixed);
        
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`itinerary.${dayIso}`]: sanitizeForFirestore(itemsToKeep)
        });
    }, [activeTripId, activeTrip, itinerary]);

    const clearItinerary = useCallback(async () => {
        if (!activeTripId || !activeTrip) return;
        
        const updatedItinerary: Record<string, POI[]> = {};
        for (const [dayIso, items] of Object.entries(itinerary) as [string, POI[]][]) {
            const itemsToKeep = items.filter(i => i.fixed);
            if (itemsToKeep.length > 0) {
                updatedItinerary[dayIso] = itemsToKeep;
            }
        }
        
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            itinerary: sanitizeForFirestore(updatedItinerary)
        });
    }, [activeTripId, activeTrip, itinerary]);

    const updatePoiTransportMode = useCallback(async (dayIso: string, poiId: string, mode: 'car' | 'bus' | 'walk' | 'bicycle') => {
        if (!activeTripId || !activeTrip) return;
        const currentItems = itinerary[dayIso] || [];
        const index = currentItems.findIndex(i => i.id === poiId);
        if (index === -1) return;

        const updatedItems = [...currentItems];
        updatedItems[index] = { ...updatedItems[index], transportModeTo: mode };

        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`itinerary.${dayIso}`]: sanitizeForFirestore(updatedItems)
        });
    }, [activeTripId, activeTrip, itinerary]);

    const addCustomPoi = useCallback(async (poi: POI) => {
        const newPois = [...customPois, poi];
        await setDoc(customPoisDocRef, { pois: newPois });
    }, [customPois, customPoisDocRef]);

    const getJsonContext = useCallback((): string => {
        if (!activeTrip) return '{}';
        
        const simplified = Object.entries(itinerary).reduce<Record<string, object[]>>((acc, [date, items]: [string, POI[]]) => {
            if (items.length === 0) return acc;
            acc[date] = items.map(item => ({
                id: item.id,
                title: typeof item.title === 'string' ? item.title : item.title.en,
                category: item.category,
                time: item.time,
                duration: item.duration,
                fixed: item.fixed ?? false,
            }));
            return acc;
        }, {} as Record<string, object[]>);
        
        return JSON.stringify({
            destination: activeTrip.destination,
            dates: `${activeTrip.startDate} to ${activeTrip.endDate}`,
            travelers: activeTrip.travelers,
            adults: activeTrip.adults,
            kids: activeTrip.kids,
            kidsAges: activeTrip.kidsAges,
            travelerProfiles: activeTrip.travelerProfiles,
            itinerary: simplified
        }, null, 2);
    }, [activeTrip, itinerary]);

    const createTrip = useCallback(async (tripData: Partial<Trip>): Promise<string> => {
        const start = tripData.startDate || toLocalIso(new Date());
        const end = tripData.endDate || toLocalIso(new Date(Date.now() + 7 * 86400000));
        let initialItinerary: Record<string, POI[]> = {};

        if (tripData.logistics?.stays) {
            initialItinerary = syncStaysToItinerary(tripData.logistics.stays, initialItinerary);
        }

        const newTrip: Partial<Trip> = {
            title: tripData.title || (tripData.destination ? `${tripData.destination} Trip` : 'New Trip'),
            destination: tripData.destination || 'Destination',
            startDate: start,
            endDate: end,
            travelers: tripData.travelers || 2,
            preferences: tripData.preferences || '',
            itinerary: initialItinerary,
            logistics: { flights: [], stays: [] },
            ...tripData
        };
        
        const tripRef = await addDoc(tripsCollectionRef, sanitizeForFirestore(newTrip));
        return tripRef.id;
    }, [tripsCollectionRef]);

    const updateTrip = useCallback(async (id: string, tripData: Partial<Trip>) => {
        const tripRef = doc(db, 'trips', id);
        await updateDoc(tripRef, sanitizeForFirestore(tripData));
    }, []);

    const deleteTrip = useCallback(async (id: string) => {
        if (activeTripId === id) {
             setActiveTripId(null);
        }
        await deleteDoc(doc(db, 'trips', id));
    }, [activeTripId]);

    const addReferenceDoc = useCallback(async (referenceDoc: { name: string; content: string }) => {
        if (!activeTripId) return;
        const tripRef = doc(db, 'trips', activeTripId);
        const docWithId = {
            ...referenceDoc,
            id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            uploadedAt: new Date().toISOString()
        };
        await updateDoc(tripRef, {
            referenceDocs: arrayUnion(sanitizeForFirestore(docWithId))
        });
    }, [activeTripId]);

    const removeReferenceDoc = useCallback(async (docId: string) => {
        if (!activeTripId || !activeTrip?.referenceDocs) return;
        const docToRemove = activeTrip.referenceDocs.find(d => d.id === docId);
        if (!docToRemove) return;
        
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            referenceDocs: arrayRemove(docToRemove)
        });
    }, [activeTripId, activeTrip]);

    const updatePoi = useCallback(async (poi: POI) => {
        if (!activeTripId || !activeTrip) return;
        
        const updatedTrip = { ...activeTrip };
        let changed = false;

        const newItinerary = { ...(updatedTrip.itinerary || {}) };
        for (const date in newItinerary) {
            const index = newItinerary[date].findIndex(p => p.id === poi.id);
            if (index !== -1) {
                newItinerary[date] = [...newItinerary[date]];
                newItinerary[date][index] = { ...newItinerary[date][index], ...poi };
                changed = true;
            }
        }
        if (changed) updatedTrip.itinerary = newItinerary;

        const newLibrary = [...(updatedTrip.libraryPois || [])];
        const libIndex = newLibrary.findIndex(p => 
            p.id === poi.id || 
            (poi.googlePlaceId && p.googlePlaceId === poi.googlePlaceId)
        );
        if (libIndex !== -1) {
            newLibrary[libIndex] = { ...newLibrary[libIndex], ...poi };
            updatedTrip.libraryPois = newLibrary;
            changed = true;
        } else if (!changed) {
            newLibrary.push(poi);
            updatedTrip.libraryPois = newLibrary;
            changed = true;
        }

        if (changed) {
            const tripRef = doc(db, 'trips', activeTripId);
            await updateDoc(tripRef, sanitizeForFirestore({
                itinerary: updatedTrip.itinerary,
                libraryPois: updatedTrip.libraryPois
            }));
        }
    }, [activeTripId, activeTrip]);

    // ── Sara AI Atomic Mutations ──────────────────────────────────────────

    const movePoi = useCallback(async (fromDayIso: string, toDayIso: string, poiId: string) => {
        if (!activeTripId || !activeTrip) return;
        const fromItems = itinerary[fromDayIso] || [];
        const poi = fromItems.find(p => p.id === poiId);
        if (!poi) return;

        const newFrom = fromItems.filter(p => p.id !== poiId);
        const toItems = itinerary[toDayIso] || [];
        const autoTime = getNextTime(toItems);
        const poiWithTime = { ...poi, time: autoTime };

        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, sanitizeForFirestore({
            [`itinerary.${fromDayIso}`]: newFrom,
            [`itinerary.${toDayIso}`]: [...toItems, poiWithTime]
        }));
    }, [activeTripId, activeTrip, itinerary]);

    const modifyPoi = useCallback(async (dayIso: string, poiId: string, changes: Partial<POI>) => {
        if (!activeTripId || !activeTrip) return;
        const currentItems = itinerary[dayIso] || [];
        const index = currentItems.findIndex(p => p.id === poiId);
        if (index === -1) return;

        const updatedItems = [...currentItems];
        updatedItems[index] = { ...updatedItems[index], ...changes };

        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`itinerary.${dayIso}`]: sanitizeForFirestore(updatedItems)
        });
    }, [activeTripId, activeTrip, itinerary]);

    const reorderPois = useCallback(async (dayIso: string, orderedIds: string[]) => {
        if (!activeTripId || !activeTrip) return;
        const currentItems = itinerary[dayIso] || [];
        const reordered: POI[] = [];
        for (const id of orderedIds) {
            const poi = currentItems.find(p => p.id === id);
            if (poi) reordered.push(poi);
        }
        // Add any items not in the ordered list at the end
        for (const poi of currentItems) {
            if (!orderedIds.includes(poi.id)) reordered.push(poi);
        }

        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`itinerary.${dayIso}`]: sanitizeForFirestore(reordered)
        });
    }, [activeTripId, activeTrip, itinerary]);

    const addStay = useCallback(async (stay: Omit<Stay, 'id'>) => {
        if (!activeTripId || !activeTrip) return;
        const newStay: Stay = {
            ...stay,
            id: `stay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            nights: Math.max(1, Math.round((parseDateString(stay.checkOutDate).getTime() - parseDateString(stay.checkInDate).getTime()) / 86400000))
        };
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            'logistics.stays': arrayUnion(sanitizeForFirestore(newStay))
        });
    }, [activeTripId, activeTrip]);

    const removeStay = useCallback(async (stayId: string) => {
        if (!activeTripId || !activeTrip) return;
        const stays = activeTrip.logistics?.stays || [];
        const stayToRemove = stays.find(s => s.id === stayId);
        if (!stayToRemove) return;
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            'logistics.stays': arrayRemove(stayToRemove)
        });
    }, [activeTripId, activeTrip]);

    const modifyStay = useCallback(async (stayId: string, changes: Partial<Stay>) => {
        if (!activeTripId || !activeTrip) return;
        const stays = [...(activeTrip.logistics?.stays || [])];
        const idx = stays.findIndex(s => s.id === stayId);
        if (idx === -1) return;
        stays[idx] = { ...stays[idx], ...changes };
        if (changes.checkInDate || changes.checkOutDate) {
            const ci = parseDateString(stays[idx].checkInDate);
            const co = parseDateString(stays[idx].checkOutDate);
            stays[idx].nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
        }
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            'logistics.stays': sanitizeForFirestore(stays)
        });
    }, [activeTripId, activeTrip]);

    const addFlight = useCallback(async (flight: Omit<Flight, 'id'>) => {
        if (!activeTripId || !activeTrip) return;
        const newFlight: Flight = {
            ...flight,
            id: `flight-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            durationMins: flight.durationMins || 0,
            stops: flight.stops || 0
        };
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            'logistics.flights': arrayUnion(sanitizeForFirestore(newFlight))
        });
    }, [activeTripId, activeTrip]);

    const removeFlight = useCallback(async (flightId: string) => {
        if (!activeTripId || !activeTrip) return;
        const flights = activeTrip.logistics?.flights || [];
        const flightToRemove = flights.find(f => f.id === flightId);
        if (!flightToRemove) return;
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            'logistics.flights': arrayRemove(flightToRemove)
        });
    }, [activeTripId, activeTrip]);

    const addDay = useCallback(async () => {
        if (!activeTripId || !activeTrip) return;
        const endDate = parseDateString(activeTrip.endDate);
        endDate.setDate(endDate.getDate() + 1);
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, { endDate: toLocalIso(endDate) });
    }, [activeTripId, activeTrip]);

    const removeDay = useCallback(async (dayIso: string) => {
        if (!activeTripId || !activeTrip) return;
        const newItinerary = { ...itinerary };
        delete newItinerary[dayIso];
        // Check if removing a day at the end
        const endDate = parseDateString(activeTrip.endDate);
        if (dayIso === toLocalIso(endDate)) {
            endDate.setDate(endDate.getDate() - 1);
            const tripRef = doc(db, 'trips', activeTripId);
            await updateDoc(tripRef, sanitizeForFirestore({
                endDate: toLocalIso(endDate),
                itinerary: newItinerary
            }));
        } else {
            const tripRef = doc(db, 'trips', activeTripId);
            await updateDoc(tripRef, sanitizeForFirestore({ itinerary: newItinerary }));
        }
    }, [activeTripId, activeTrip, itinerary]);

    const setDayTheme = useCallback(async (dayIso: string, theme: string) => {
        if (!activeTripId) return;
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            [`dayThemes.${dayIso}`]: theme
        });
    }, [activeTripId]);

    const addToLibrary = useCallback(async (poi: POI) => {
        if (!activeTripId) return;
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            libraryPois: arrayUnion(sanitizeForFirestore(poi))
        });
    }, [activeTripId]);

    const removeFromLibrary = useCallback(async (poiId: string) => {
        if (!activeTripId || !activeTrip) return;
        const library = activeTrip.libraryPois || [];
        const itemToRemove = library.find(p => p.id === poiId);
        if (!itemToRemove) return;
        const tripRef = doc(db, 'trips', activeTripId);
        await updateDoc(tripRef, {
            libraryPois: arrayRemove(itemToRemove)
        });
    }, [activeTripId, activeTrip]);

    return { 
        trips, 
        activeTripId, 
        activeTrip, 
        itinerary, 
        days,
        customPois, 
        addPoi, 
        removePoi, 
        clearDay,
        clearItinerary,
        addCustomPoi, 
        updatePoiTransportMode,
        getJsonContext,
        setActiveTripId,
        createTrip,
        updateTrip,
        deleteTrip,
        addReferenceDoc,
        removeReferenceDoc,
        updatePoi,
        isGeneratingLibrary,
        // Sara AI atomic mutations
        movePoi,
        modifyPoi,
        reorderPois,
        addStay,
        removeStay,
        modifyStay,
        addFlight,
        removeFlight,
        addDay,
        removeDay,
        setDayTheme,
        addToLibrary,
        removeFromLibrary
    };
}
