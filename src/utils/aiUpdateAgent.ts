import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from './geminiKeyManager';
import { POI, Category } from '../data';
import { BilingualString } from './types';
import { stripCodeFences, ensureBilingual } from './bilingualUtils';
import { searchPlacesAsync } from '../hooks/usePlacesSearch';

import { toLocalIso, getFullTripContext } from '../useItineraryState';

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
  activeTrip: any,
  onProgress?: (msg: string) => void
): Promise<UpdateResponse> {
  const tripContext = getFullTripContext(activeTrip, currentItinerary);
  
  // Step 1: Analyze which days are affected
  onProgress?.('Analyzing update request...');
  const analysisPrompt = `
    You are a travel coordinator. Analyze the user request and the current trip state.
    Identify which days (dates) need to be modified, added, or removed.
    
    TRIP CONTEXT:
    ${tripContext}
    
    User Request: "${updateRequest}"
    
    Return JSON:
    {
      "affectedDates": ["YYYY-MM-DD", ...],
      "reasoning": { "en": "...", "cs": "..." },
      "strategy": "REPLACE_DAYS" | "ADD_NEW_DAYS" | "SUBTLE_ADJUSTMENT"
    }
  `;

  let affectedDates: string[] = [];
  let summary: BilingualString = { en: "Updated itinerary.", cs: "Itinerář byl aktualizován." };

  // Phase 1: Analysis with retry
  let analysisRetry = 0;
  while (analysisRetry < 4) {
    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) break;
    try {
      const ai = new GoogleGenAI({ apiKey });
      const analysisResult = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const analysis = JSON.parse(stripCodeFences(analysisResult.text || ''));
      affectedDates = analysis.affectedDates || [];
      summary = analysis.reasoning || summary;
      onProgress?.(`Identified ${affectedDates.length} days to update.`);
      break;
    } catch (e: any) {
      const isRateLimit = e.message?.includes('429') || e.message?.includes('503');
      geminiKeyManager.markKeyFailed(apiKey, isRateLimit, 60);
      analysisRetry++;
      await new Promise(r => setTimeout(r, 1000 * analysisRetry));
    }
  }

  if (affectedDates.length === 0 && analysisRetry >= 4) {
    console.warn('Analysis failed, falling back to full update');
    affectedDates = Object.keys(currentItinerary);
  }

  // Step 2: Update the affected days
  const updatedItinerary = { ...currentItinerary };

  for (const date of affectedDates) {
    onProgress?.(`Updating ${date}...`);
    const dayPois = currentItinerary[date] || [];
    
    const updatePrompt = `
      You are an expert travel planner. Modify the itinerary for the date: ${date}.
      Destination: ${activeTrip?.destination?.en || 'the selected destination'}
      
      Current POIs for this day:
      ${JSON.stringify(dayPois, null, 2)}
      
      User Global Request: "${updateRequest}"
      
      INSTRUCTIONS:
      1. Apply the user request to this specific day.
      2. If deleting, remove the relevant POIs.
      3. If adding, provide name, description, category, and imageKeyword.
      4. If moving, adjust startTime and duration.
      5. CRITICAL SCHEDULING: Assign a sequentially increasing 'startTime' (e.g. "09:00", "11:00", "14:30") and 'duration' (in minutes) to EVERY activity. Calculate start times so they account for the previous activity's duration plus transit. NEVER schedule multiple activities at the same time!
      6. ALL TEXT MUST BE BILINGUAL { "en": "...", "cs": "..." }.
      7. Return the FULL list of POIs for this day in logical order.
      8. Return JSON: { "pois": [...], "daySummary": { "en": "...", "cs": "..." } }
    `;

    let dayRetry = 0;
    let daySuccess = false;

    while (dayRetry < 4 && !daySuccess) {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) break;
      try {
        const ai = new GoogleGenAI({ apiKey });
        const dayResult = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: [{ role: 'user', parts: [{ text: updatePrompt }] }],
          config: { responseMimeType: "application/json" }
        });
        const dayData = JSON.parse(stripCodeFences(dayResult.text || ''));
        
        // Step 3: Local Enrichment (Google Maps)
        const processedPois: POI[] = [];
        for (const rawPoi of (dayData.pois || [])) {
          const isNew = !dayPois.some(p => p.id === rawPoi.id);
          if (isNew || !rawPoi.location) {
            try {
              const query = `${ensureBilingual(rawPoi.title).en} ${activeTrip?.destination?.en || ''}`;
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
                  googleMapsUrl: bestMatch.googleMapsUrl
                });
                continue;
              }
            } catch (err) { /* ignore map error */ }
          }
          processedPois.push({
            ...rawPoi,
            title: ensureBilingual(rawPoi.title),
            description: ensureBilingual(rawPoi.description),
          });
        }

        updatedItinerary[date] = processedPois;
        daySuccess = true;
      } catch (e: any) {
        const isRateLimit = e.message?.includes('429') || e.message?.includes('503');
        geminiKeyManager.markKeyFailed(apiKey, isRateLimit, 60);
        dayRetry++;
        await new Promise(r => setTimeout(r, 1500 * dayRetry));
      }
    }
  }

  return {
    updatedItinerary,
    summary
  };
}
