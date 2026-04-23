import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from './geminiKeyManager';
import { POI, Category } from '../data';
import { BilingualString } from './itineraryParser';
import { stripCodeFences, ensureBilingual } from './bilingualUtils';
import { searchPlacesAsync } from '../hooks/usePlacesSearch';

export interface UpdateResponse {
  updatedItinerary: Record<string, POI[]>;
  summary: BilingualString;
}

/**
 * RAG-like Itinerary Update Agent
 * 
 * 1. Analysis: Gemini determines which days need modification based on the request.
 * 2. Execution: affected days are updated one-by-one (or in small batches) to ensure high fidelity.
 * 3. Enrichment: New activities are looked up on Google Maps for real coordinates and cards.
 */
export async function applyItineraryUpdate(
  currentItinerary: Record<string, POI[]>,
  updateRequest: string,
  destination: string,
  onProgress?: (msg: string) => void
): Promise<UpdateResponse> {
  const apiKey = geminiKeyManager.getNextKey();
  const ai = new GoogleGenAI({ apiKey });

  // Step 1: Analyze which days are affected
  onProgress?.('Analyzing update request...');
  const analysisPrompt = `
    You are a travel coordinator. Analyze the user request and the current itinerary.
    Identify which days (dates) need to be modified, added, or removed.
    
    Current Itinerary (Dates): ${Object.keys(currentItinerary).join(', ')}
    User Request: "${updateRequest}"
    
    Return JSON:
    {
      "affectedDates": ["YYYY-MM-DD", ...],
      "reasoning": { "en": "...", "cs": "..." },
      "strategy": "REPLACE_DAYS" | "ADD_NEW_DAYS" | "SUBTLE_ADJUSTMENT"
    }
  `;

  let affectedDates: string[] = [];
  try {
    const analysisResult = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const analysis = JSON.parse(stripCodeFences(analysisResult.text || ''));
    affectedDates = analysis.affectedDates || [];
    onProgress?.(`Identified ${affectedDates.length} days to update.`);
  } catch (e) {
    console.warn('Analysis failed, falling back to full update:', e);
    affectedDates = Object.keys(currentItinerary);
  }

  // Step 2: Update the affected days
  const updatedItinerary = { ...currentItinerary };
  let summary: BilingualString = { en: "Updated itinerary.", cs: "Itinerář byl aktualizován." };

  for (const date of affectedDates) {
    onProgress?.(`Updating ${date}...`);
    const dayPois = currentItinerary[date] || [];
    
    const updatePrompt = `
      You are an expert travel planner. Modify the itinerary for the date: ${date}.
      Destination: ${destination}
      
      Current POIs for this day:
      ${JSON.stringify(dayPois, null, 2)}
      
      User Global Request: "${updateRequest}"
      
      INSTRUCTIONS:
      1. Apply the user request to this specific day.
      2. If deleting, remove the relevant POIs.
      3. If adding, provide name, description, category, and imageKeyword.
      4. If moving, adjust startTime and duration.
      5. ALL TEXT MUST BE BILINGUAL { "en": "...", "cs": "..." }.
      6. Return the FULL list of POIs for this day in logical order.
      7. SMART PLANNING: Ensure durations allow for travel time and typical visit lengths.
      
      Return JSON:
      {
        "pois": [...],
        "daySummary": { "en": "...", "cs": "..." }
      }
    `;

    try {
      const dayResult = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ role: 'user', parts: [{ text: updatePrompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const dayData = JSON.parse(stripCodeFences(dayResult.text || ''));
      
      // Step 3: Local Enrichment (Google Maps) for NEW activities
      const processedPois: POI[] = [];
      for (const rawPoi of (dayData.pois || [])) {
        // Detect if it's a "new" POI or significantly changed
        const isNew = !dayPois.some(p => p.id === rawPoi.id);
        
        if (isNew || !rawPoi.location) {
          try {
            const query = `${ensureBilingual(rawPoi.title).en} ${destination}`;
            const mapsData = await searchPlacesAsync(query);
            if (mapsData.length > 0) {
              const bestMatch = mapsData[0];
              processedPois.push({
                ...rawPoi,
                id: rawPoi.id || `upd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                title: ensureBilingual(rawPoi.title),
                description: ensureBilingual(rawPoi.description),
                category: rawPoi.category as Category,
                address: bestMatch.address || rawPoi.address,
                location: bestMatch.location || rawPoi.location,
                imageUrl: bestMatch.imageUrl || rawPoi.imageUrl,
                rating: bestMatch.rating,
                reviewCount: bestMatch.reviewCount,
                googleMapsUrl: bestMatch.googleMapsUrl
              });
              continue;
            }
          } catch (err) {
            console.warn('Map enrichment failed for', rawPoi.title);
          }
        }
        
        // Fallback or existing POI
        processedPois.push({
          ...rawPoi,
          title: ensureBilingual(rawPoi.title),
          description: ensureBilingual(rawPoi.description),
        });
      }

      updatedItinerary[date] = processedPois;
      summary = dayData.daySummary || summary;

    } catch (e) {
      console.error(`Failed to update day ${date}:`, e);
    }
  }

  return {
    updatedItinerary,
    summary
  };
}
