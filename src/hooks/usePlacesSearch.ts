import { useState, useCallback, useRef } from 'react';
import { POI, Category } from '../data';

/**
 * Hook for searching places using Google Places API via PlacesService.
 * Requires the `places` library to be loaded via APIProvider.
 * Falls back to a text search when PlacesService isn't available.
 */

function categorizeFromTypes(types: string[]): Category {
  if (types.some(t => ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'political'].includes(t))) return 'City';
  if (types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_delivery', 'meal_takeaway'].includes(t))) return 'Food';
  if (types.some(t => ['bus_station', 'train_station', 'airport', 'transit_station', 'taxi_stand', 'car_rental'].includes(t))) return 'Transport';
  if (types.some(t => ['gym', 'stadium', 'amusement_park', 'bowling_alley', 'spa', 'swimming_pool', 'campground'].includes(t))) return 'Activity';
  if (types.some(t => ['tourist_attraction', 'point_of_interest', 'natural_feature', 'park', 'museum', 'church', 'art_gallery'].includes(t))) return 'Sightseeing';
  return 'Sightseeing';
}

function placeResultToPOI(place: google.maps.places.PlaceResult): POI | null {
  if (!place.geometry?.location) return null;

  const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 800 }) ||
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

  return {
    id: `places-${place.place_id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: { en: place.name || 'Unknown Place', cs: place.name || 'Neznámé místo' },
    description: { en: place.formatted_address || '', cs: place.formatted_address || '' },
    category: categorizeFromTypes(place.types || []),
    duration: 60,
    imageUrl: photoUrl,
    location: {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    },
    rating: place.rating,
    reviewCount: place.user_ratings_total,
    address: place.formatted_address,
    googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    images: place.photos?.slice(0, 5).map(p => p.getUrl({ maxWidth: 800 })),
  };
}

export interface PlacesSearchState {
  results: POI[];
  isSearching: boolean;
  error: string | null;
  searchPlaces: (query: string, location?: { lat: number; lng: number }, searchInBounds?: boolean) => void;
  clearResults: () => void;
}

export function usePlacesSearch(): PlacesSearchState {
  const [results, setResults] = useState<POI[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);

  const getService = useCallback(() => {
    if (serviceRef.current) return serviceRef.current;
    
    // PlacesService doesn't strictly need a map — can use a div
    if (typeof google === 'undefined' || !google.maps?.places?.PlacesService) {
      return null;
    }
    const dummyDiv = document.createElement('div');
    serviceRef.current = new google.maps.places.PlacesService(dummyDiv);
    return serviceRef.current;
  }, []);

  const searchPlaces = useCallback((query: string, location?: { lat: number; lng: number }, searchInBounds?: boolean) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);

    const service = getService();
    if (!service) {
      setError('Places service not available. Please enable the Maps JavaScript API.');
      setIsSearching(false);
      return;
    }

    const bounds = searchInBounds ? (window as any).lastMapBounds : undefined;

    const request: google.maps.places.TextSearchRequest = {
      query,
      ...(bounds ? { bounds } : location ? {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: 50000, // 50km radius
      } : {}),
    };

    service.textSearch(request, (results, status) => {
      setIsSearching(false);
      
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const pois = results
          .map(placeResultToPOI)
          .filter((p): p is POI => p !== null)
          .slice(0, 12); // Limit to 12 results
        
        setResults(pois);
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        setResults([]);
        setError('No places found. Try a different search.');
      } else {
        setError(`Search failed: ${status}`);
        setResults([]);
      }
    });
  }, [getService]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, isSearching, error, searchPlaces, clearResults };
}

/**
 * Standalone function to search places (for use in AI tools).
 * Returns a promise-based API.
 */
export function searchPlacesAsync(
  query: string,
  location?: { lat: number; lng: number }
): Promise<POI[]> {
  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined' || !google.maps?.places?.PlacesService) {
      reject(new Error('Places service not available'));
      return;
    }

    const dummyDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(dummyDiv);

    const request: google.maps.places.TextSearchRequest = {
      query,
      ...(location ? {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: 50000,
      } : {}),
    };

    service.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const pois = results
          .map(placeResultToPOI)
          .filter((p): p is POI => p !== null)
          .slice(0, 8);
        resolve(pois);
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error(`Places search failed: ${status}`));
      }
    });
  });
}
