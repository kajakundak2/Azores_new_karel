import { useState, useCallback } from 'react';
import { POI, Category } from '../data';

/**
 * Hook for searching places using the NEW Google Places API (Place.searchByText).
 * Migrated from the deprecated PlacesService to google.maps.places.Place.
 * 
 * Requires "Places API (New)" to be enabled in Google Cloud Console.
 */

function categorizeFromTypes(types: string[]): Category {
  if (types.some(t => ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'political'].includes(t))) return 'City';
  if (types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_delivery', 'meal_takeaway'].includes(t))) return 'Food';
  if (types.some(t => ['bus_station', 'train_station', 'airport', 'transit_station', 'taxi_stand', 'car_rental'].includes(t))) return 'Transport';
  if (types.some(t => ['gym', 'stadium', 'amusement_park', 'bowling_alley', 'spa', 'swimming_pool', 'campground'].includes(t))) return 'Activity';
  if (types.some(t => ['tourist_attraction', 'point_of_interest', 'natural_feature', 'park', 'museum', 'church', 'art_gallery'].includes(t))) return 'Sightseeing';
  return 'Sightseeing';
}

/**
 * Maps priceLevel enum from the new API to a display string.
 */
function priceLevelToDisplay(priceLevel: string | undefined | null): string | undefined {
  if (!priceLevel) return undefined;
  const map: Record<string, string> = {
    'FREE': 'Free',
    'INEXPENSIVE': '$',
    'MODERATE': '$$',
    'EXPENSIVE': '$$$',
    'VERY_EXPENSIVE': '$$$$',
  };
  return map[priceLevel] || undefined;
}

/**
 * Converts a new Place API result to our POI format.
 */
export function newPlaceToPOI(place: google.maps.places.Place): POI | null {
  const loc = place.location;
  if (!loc) return null;

  // Get photo URL from first photo
  let photoUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
  const photos: string[] = [];
  if (place.photos && place.photos.length > 0) {
    try {
      photoUrl = place.photos[0].getURI({ maxWidth: 800 }) || photoUrl;
      photos.push(...place.photos.slice(0, 5).map(p => {
        try { return p.getURI({ maxWidth: 800 }) || ''; } catch { return ''; }
      }).filter(Boolean));
    } catch { /* photo URI failed */ }
  }

  const name = place.displayName || 'Unknown Place';
  const editorialSummary = (place as any).editorialSummary || '';
  const priceLevelStr = priceLevelToDisplay((place as any).priceLevel);

  return {
    id: place.id || `places-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    googlePlaceId: place.id ?? undefined,
    title: { en: name, cs: name },
    description: editorialSummary ? {
      en: editorialSummary,
      cs: editorialSummary,
    } : undefined,
    category: categorizeFromTypes(place.types || []),
    duration: 60,
    imageUrl: photoUrl,
    location: {
      lat: loc.lat(),
      lng: loc.lng(),
    },
    rating: place.rating ?? undefined,
    reviewCount: (place as any).userRatingCount ?? undefined,
    address: place.formattedAddress ?? undefined,
    googleMapsUrl: (place as any).googleMapsURI || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    images: photos.length > 0 ? photos : undefined,
    priceInEuro: priceLevelStr,
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

  const searchPlaces = useCallback(async (query: string, location?: { lat: number; lng: number }, searchInBounds?: boolean) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const pois = await searchPlacesAsync(query, location, searchInBounds);
      setResults(pois);
      if (pois.length === 0) {
        setError('No places found. Try a different search.');
      }
    } catch (err: any) {
      console.error('Places search error:', err);
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, isSearching, error, searchPlaces, clearResults };
}

/**
 * Standalone function to search places using the NEW Place API.
 * Returns a promise-based API for use in AI tools.
 */
export async function searchPlacesAsync(
  query: string,
  location?: { lat: number; lng: number },
  searchInBounds?: boolean
): Promise<POI[]> {
  // Check that the new Place class is available
  if (typeof google === 'undefined' || !google.maps?.places?.Place) {
    throw new Error('New Places API not available. Ensure "Places API (New)" is enabled.');
  }

  const { Place } = google.maps.places;

  const request: google.maps.places.SearchByTextRequest = {
    textQuery: query,
    fields: [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'photos',
      'rating',
      'userRatingCount',
      'priceLevel',
      'editorialSummary',
      'googleMapsURI',
      'types',
      'reviews',
    ],
    maxResultCount: 12,
    language: 'en',
  };

  // Add location bias if available
  if (searchInBounds && (window as any).lastMapBounds) {
    request.locationBias = (window as any).lastMapBounds;
  } else if (location) {
    // Create a circle bias centered on the location with 50km radius
    request.locationBias = new google.maps.Circle({
      center: new google.maps.LatLng(location.lat, location.lng),
      radius: 50000,
    });
  }

  const { places } = await Place.searchByText(request);

  if (!places || places.length === 0) {
    return [];
  }

  return places
    .map(newPlaceToPOI)
    .filter((p): p is POI => p !== null);
}
