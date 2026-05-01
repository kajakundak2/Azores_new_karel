/**
 * Itinerary Parser — Recursive Chunking Architecture
 * 
 * Implements the Exhaustive Extraction pipeline:
 *   Step A (Splitter): Analyzes the document to identify days & global info.
 *   Step B (Worker): Per-day Gemini calls with key rotation.
 *   Step C (Parser): Strict no-summarization extraction of every POI.
 *
 * Data Extraction:
 *   - Costs captured into `cost` field.
 *   - Timeframes captured into `startTime` field. 
 *   - Practical tips attached to the specific POI or day footer.
 *   - NO LIMITS on POI count per day.
 */

import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from './geminiKeyManager';
import { POI, Category } from '../data';
import { ensureBilingual, stripCodeFences } from './bilingualUtils';

import { BilingualString, ParsedPOI, ParsedDay, SplitterResult } from './types';

export type ProgressCallback = (message: string) => void;

// ── Step A: The Splitter ─────────────────────────────────────────────────────

/**
 * Analyzes the document to identify the number of days and extract per-day text chunks.
 * Uses Gemini to understand varied document formats.
 */
export async function splitDocument(
  documentText: string,
  onProgress?: ProgressCallback,
  targetDayNumbers?: number[]
): Promise<SplitterResult> {
  onProgress?.('Analyzing document structure...');

  let retryCount = 0;
  const maxRetries = 6;

  while (retryCount < maxRetries) {
    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) throw new Error('No API keys available.');

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are a document structure analyzer. Your ONLY job is to split this travel document into individual day chunks.

DOCUMENT TEXT:
---
${documentText}
---

INSTRUCTIONS:
1. Identify ALL text that appears BEFORE "Day 1" — this is the "globalInfo".
2. Identify EVERY day section (Day 1, Day 2, etc.) and extract the COMPLETE raw text for each day.
3. Include ALL text belonging to each day — every POI, every tip, every restaurant, every note. DO NOT summarize or omit anything.
4. The raw text for each day should end where the NEXT day begins (or at the end of the document).

Return ONLY valid JSON with this exact structure (no markdown code blocks):
{
  "totalDays": <number>,
  "globalInfo": { "en": "...", "cs": "..." },
  "dayChunks": [
    {
      "dayNumber": 1,
      "title": { "en": "...", "cs": "..." },
      "rawText": "..."
    }
  ]
}

CRITICAL: The rawText must contain the COMPLETE text for each day. Do NOT summarize or truncate. Every word matters.`;

      const result = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: 'You are a precise document parser. Output ONLY valid JSON. Never summarize — preserve all original text.',
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      let text = result.text || '';
      text = stripCodeFences(text);
      const parsed = JSON.parse(text.trim()) as SplitterResult;
      
      // Filter if targetDayNumbers provided
      if (targetDayNumbers && targetDayNumbers.length > 0) {
        parsed.dayChunks = parsed.dayChunks.filter(c => targetDayNumbers.includes(c.dayNumber));
      }

      onProgress?.(`Found ${parsed.totalDays} days in document.`);
      return parsed;
    } catch (err: any) {
      console.error('Splitter error:', err);
      if (err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('fetch failed')) {
        geminiKeyManager.markKeyFailed(apiKey, true, 60); // 60s cooldown on quotas/503
        retryCount++;
        const backoff = 2000 * Math.pow(2, retryCount) + Math.random() * 1000;
        await delay(backoff);
      } else {
        retryCount++;
        await delay(1000);
      }
    }
  }

  throw new Error('Splitter failed after max retries.');
}

// ── Step B+C: The Worker (per-day extractor) ─────────────────────────────────

/**
 * For a single day, extracts EVERY POI with full detail.
 * Forbids summarization. No limits on POI count.
 */
export async function extractDayPOIs(
  dayChunk: { dayNumber: number; title: string | BilingualString; rawText: string },
  globalInfo: string | BilingualString,
  destination: string,
  travelers: number,
  onProgress?: ProgressCallback
): Promise<ParsedDay> {
  const displayTitle = typeof dayChunk.title === 'string' ? dayChunk.title : dayChunk.title.en;
  onProgress?.(`Extracting Day ${dayChunk.dayNumber}: ${displayTitle}...`);

  let retryCount = 0;
  const maxRetries = 6;

  while (retryCount < maxRetries) {
    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) throw new Error('No API keys available.');

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are an exhaustive travel data extractor. Your job is to extract EVERY SINGLE point of interest, restaurant, viewpoint, beach, activity, and transit step from this day's text with ZERO summarization.

DESTINATION: ${destination}
TRAVELERS: ${travelers}
DAY ${dayChunk.dayNumber}: "${dayChunk.title}"

GLOBAL CONTEXT:
${globalInfo}

DAY TEXT (extract EVERYTHING from this):
---
${dayChunk.rawText}
---

EXTRACTION RULES — READ CAREFULLY:
1. **NO LIMITS**: If the text mentions 15 activities, you must return 15 activities. Extract EVERY single one.
2. **NO SUMMARIZATION**: Each POI description must contain ALL original details from the text — opening hours, specific tips, temperature ranges, alternative options, recommendations.
3. **BILINGUAL**: You MUST provide ALL text fields in BOTH English (en) and Czech (cs). Even if the source text is in only one language, translate it to the other.
4. **COSTS**: Capture ALL prices mentioned (e.g., "€65", "€1/hour", "€12 per person", "free") into the "cost" field.
5. **TIMEFRAMES**: Capture specific times (e.g., "between 7:00 and 9:00 AM", "after 4:00 PM", "7:00 AM to 11:00 PM") into the "startTime" field.
6. **PRACTICAL TIPS**: If a tip is specific to a POI (e.g., "Bring water shoes" for a thermal pool), attach it to that POI's "practicalTips" field (bilingual).
7. **DAY-LEVEL NOTES**: If practical tips apply to the whole day (e.g., "Bring plenty of water for the hike"), include them in the "dayNotes" field (bilingual).
8. **RESTAURANTS/FOOD**: Every restaurant, café, food truck, or food recommendation is a separate POI with category "Food".
9. **TRANSPORT**: Transfer instructions, car rental advice, parking info should be category "Transport".
10. **CATEGORY VALUES**: Use ONLY these: "Sightseeing", "Food", "Activity", "Transport", "Special", "City".
11. **DURATION**: Estimate intelligently: quick viewpoints=20min, museums=60min, hikes=120min, meals=60min, thermal pools=90min, whale watching=180min.

Return ONLY valid JSON (no markdown code blocks):
{
  "dayNumber": ${dayChunk.dayNumber},
  "title": { "en": "Day Title in En", "cs": "Název dne v češtině" },
  "activities": [
    {
      "title": { "en": "Exact Place Name", "cs": "Přesný název místa" },
      "description": { 
        "en": "FULL description with ALL original details, tips, and recommendations in English.", 
        "cs": "CELÝ popis se VŠEMI původními detaily, tipy a doporučeními v češtině." 
      },
      "category": "Sightseeing",
      "cost": "€12" or "free" or null,
      "startTime": "8:00 AM" or null,
      "duration": 60,
      "address": "Location/area name",
      "practicalTips": { "en": "Specific tips in English", "cs": "Specifické tipy v češtině" } or null,
      "coords": { "lat": 37.123, "lng": -25.456 },
      "imageKeyword": "tourist attraction landscape cinematic"
    }
  ],
  "dayNotes": { "en": "Day-level tips in English", "cs": "Tipy na úrovni dne v češtině" } or null
}`;

      const result = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: 'You are a meticulous travel data extractor. Output ONLY valid JSON. NEVER summarize — extract every detail verbatim from the source text. No POI count limits.',
          temperature: 0.15,
          responseMimeType: 'application/json'
        }
      });

      let text = result.text || '';
      text = stripCodeFences(text);
      const parsed = JSON.parse(text.trim());
      
      onProgress?.(`Day ${dayChunk.dayNumber}: Found ${parsed.activities?.length || 0} activities.`);
      return parsed as ParsedDay;
    } catch (err: any) {
      console.error(`Worker error (Day ${dayChunk.dayNumber}):`, err);
      if (err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('fetch failed')) {
        geminiKeyManager.markKeyFailed(apiKey, true, 60);
        retryCount++;
        const backoff = 2000 * Math.pow(2, retryCount) + Math.random() * 1000;
        await delay(backoff);
      } else {
        retryCount++;
        await delay(1000);
      }
    }
  }

  // If all retries fail, return a minimal result instead of crashing
  console.warn(`Day ${dayChunk.dayNumber} extraction failed. Returning empty day.`);
  return {
    dayNumber: dayChunk.dayNumber,
    title: dayChunk.title,
    activities: [],
    dayNotes: 'Extraction failed for this day.'
  };
}

// ── Full Pipeline ────────────────────────────────────────────────────────────

/**
 * Processes a full document through the Split → Worker → Merge pipeline.
 */
export async function parseItineraryDocument(
  documentText: string,
  destination: string,
  travelers: number,
  onProgress?: ProgressCallback,
  targetDayNumbers?: number[]
): Promise<ParsedDay[]> {
  // Step A: Split the document
  const structure = await splitDocument(documentText, onProgress, targetDayNumbers);
  
  // Step B+C: Process each day sequentially (to avoid 429 bursts)
  const results: ParsedDay[] = [];
  
  for (const chunk of structure.dayChunks) {
    const dayResult = await extractDayPOIs(
      chunk,
      structure.globalInfo,
      destination,
      travelers,
      onProgress
    );
    results.push(dayResult);
    
    // Increased delay between days to be kind to rate limits
    if (structure.dayChunks.indexOf(chunk) < structure.dayChunks.length - 1) {
      await delay(1000);
    }
  }

  onProgress?.(`Extraction complete: ${results.reduce((sum, d) => sum + d.activities.length, 0)} total activities across ${results.length} days.`);
  return results;
}

/**
 * Generates a fresh itinerary (no document) using a two-step multi-agent architecture.
 * Step 1: Generate high-level outline.
 * Step 2: Extract day-by-day JSON details.
 */
export async function generateItineraryFromScratch(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  intensity: 'relaxed' | 'balanced' | 'packed' = 'balanced',
  referenceContext: string = '',
  onProgress?: ProgressCallback,
  targetDayNumbers?: number[]
): Promise<ParsedDay[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

  onProgress?.(`Planning ${totalDays}-day trip to ${destination}...`);

  let apiKey = geminiKeyManager.getNextKey();
  if (!apiKey) throw new Error('No API keys available.');
  let ai = new GoogleGenAI({ apiKey });

  // Phase 1: High Level Outline
  onProgress?.(`Phase 1: Generating high-level outline for ${totalDays} days...`);
  let outline = '';
  let outlineRetries = 0;
  
  while (outlineRetries < 3 && !outline) {
    try {
      const outlinePrompt = `Create a plain-text logically routed outline for a ${totalDays}-day trip to ${destination}. Do NOT output JSON.
Travelers: ${travelers} people. Pace: ${intensity}.
${referenceContext ? `REFERENCE CONTEXT & PREFERENCES:\n${referenceContext}\n` : ''}
Format as:
Day 1: [Theme]
- Morning: [Activity]
- Lunch: [Restaurant idea]
...etc`;

      const outlineResult = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ role: 'user', parts: [{ text: outlinePrompt }] }],
        config: {
          systemInstruction: "You are the trip architect. Draft a logically routed day-by-day plan. Ensure each full day has enough activities according to the pace and 2-3 specific real-world restaurants.",
          temperature: 0.7
        }
      });
      outline = outlineResult.text || '';
    } catch (err: any) {
      console.error('Outline generation error:', err);
      if (err.message?.includes('429') || err.message?.includes('503')) {
        geminiKeyManager.markKeyFailed(apiKey, true, 60);
        apiKey = geminiKeyManager.getNextKey();
        if (!apiKey) throw new Error('Quota exhausted or service unavailable during outline Phase 1.');
        ai = new GoogleGenAI({ apiKey });
      }
      outlineRetries++;
      await delay(2000 * outlineRetries);
    }
  }

  if (!outline) throw new Error('Failed to generate high-level outline after retries.');

  // Phase 2: Day details
  const results: ParsedDay[] = [];
  const daysToProcess = targetDayNumbers || Array.from({ length: totalDays }, (_, i) => i + 1);

  for (const dayNum of daysToProcess) {
    onProgress?.(`Phase 2: Planning Day ${dayNum} of ${totalDays}...`);

    let retryCount = 0;
    const maxRetries = 6;
    let dayResult: ParsedDay | null = null;

    while (!dayResult && retryCount < maxRetries) {
      apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) throw new Error('No API keys available.');

      try {
        ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Here is the high-level outline for the trip to ${destination}:

${outline}

Extract and expand the details for DAY ${dayNum} ONLY.

CONTEXT:
Travelers: ${travelers}
Intensity: ${intensity}
${referenceContext}

REQUIREMENTS:
- Extract or plan EVERY activity, restaurant, and viewpoint for this day.
- Include FOOD stops (breakfast, lunch, dinner, snacks).
- SMART SCHEDULING: Allocate realistic duration times (e.g., 2 hours for a hike, 90 mins for lunch).
- Logically order activities by start time, accounting for transit!
- MUST output REAL PLACES ONLY with realistic GPS coordinates (lat/lng).
- Include approximate costs (e.g. "€15", "free").
- Suggest start times for EVERY activity (e.g. "09:30").
- Duration in minutes.

Return ONLY valid JSON:
{
  "dayNumber": ${dayNum},
  "title": { "en": "Day Title", "cs": "Název dne" },
  "activities": [
    {
      "title": { "en": "Place Name", "cs": "Název místa" },
      "description": { "en": "Expert description...", "cs": "Detailní popis..." },
      "category": "Sightseeing"|"Food"|"Activity"|"Transport"|"Special"|"City",
      "cost": "€10",
      "startTime": "09:00",
      "duration": 60,
      "address": "Area Name",
      "practicalTips": { "en": "Tip...", "cs": "Tip..." },
      "coords": { "lat": 37.123, "lng": -25.456 },
      "imageKeyword": "photo search term"
    }
  ],
  "dayNotes": { "en": "Notes...", "cs": "Poznámky..." }
}`;

        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: 'You are an expert trip detailer. Output strictly valid JSON. YOU MUST OUTPUT REAL PLACES ONLY. PLAN SMARTLY.',
            temperature: 0.4,
            responseMimeType: 'application/json'
          }
        });

        let text = result.text || '';
        text = stripCodeFences(text);
        dayResult = JSON.parse(text.trim()) as ParsedDay;
        
      } catch (err: any) {
        console.error(`Generation error (Day ${dayNum}):`, err);
        if (err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('fetch failed')) {
          geminiKeyManager.markKeyFailed(apiKey, true, 60);
          retryCount++;
          const backoff = 2000 * Math.pow(2, retryCount);
          await delay(backoff);
        } else {
          retryCount++;
          await delay(1000);
        }
      }
    }

    if (dayResult) {
      results.push(dayResult);
    } else {
      results.push({
        dayNumber: dayNum,
        title: { en: `Day ${dayNum}`, cs: `Den ${dayNum}` },
        activities: [],
        dayNotes: { en: 'Failed to generate.', cs: 'Nepodařilo se vygenerovat.' }
      });
    }

    if (dayNum < totalDays) {
      await delay(1000);
    }
  }

  onProgress?.(`Generation complete: ${results.reduce((sum, d) => sum + d.activities.length, 0)} total activities.`);
  return results;
}

// ── Conversion: ParsedDay[] → POI[] ready for itinerary ──────────────────────

/**
 * Converts a ParsedDay into an array of POIs keyed by ISO date.
 */
export function parsedDaysToItinerary(
  days: ParsedDay[],
  tripStartDate: string
): Record<string, POI[]> {
  const result: Record<string, POI[]> = {};
  const startAt = new Date(tripStartDate);
  startAt.setHours(0, 0, 0, 0);

  for (const day of days) {
    const dayDate = new Date(startAt);
    dayDate.setDate(dayDate.getDate() + (day.dayNumber - 1));
    const iso = dayDate.toISOString().split('T')[0];

    const pois: POI[] = day.activities.map((act, idx) => ({
      id: `parsed-${day.dayNumber}-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: ensureBilingual(act.title),
      description: buildBilingualDescription(act),
      category: (act.category as Category) || 'Sightseeing',
      duration: act.duration || 60,
      cost: act.cost ? parseCost(act.cost) : undefined,
      startTime: act.startTime || undefined,
      address: act.address || (typeof act.title === 'string' ? act.title : act.title.en),
      imageUrl: act.imageKeyword
        ? `https://source.unsplash.com/800x600/?${encodeURIComponent(act.imageKeyword)}`
        : `https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?auto=format&fit=crop&w=800&q=80`,
      location: act.coords ? { lat: act.coords.lat, lng: act.coords.lng } : undefined,
    }));

    // Add day notes as a special "info" POI if present
    if (day.dayNotes) {
      pois.push({
        id: `daynotes-${day.dayNumber}-${Date.now()}`,
        title: { en: `📋 Day ${day.dayNumber} Tips`, cs: `📋 Tipy pro den ${day.dayNumber}` },
        description: ensureBilingual(day.dayNotes),
        category: 'Special' as Category,
        duration: 0,
      });
    }

    result[iso] = pois;
  }

  return result;
}

function buildBilingualDescription(act: ParsedPOI): BilingualString {
  const desc = ensureBilingual(act.description);
  const tips = act.practicalTips ? ensureBilingual(act.practicalTips) : null;

  return {
    en: desc.en + (tips ? `\n\n💡 ${tips.en}` : ''),
    cs: desc.cs + (tips ? `\n\n💡 ${tips.cs}` : '')
  };
}

function parseCost(costStr: string): number | undefined {
  if (!costStr || costStr.toLowerCase() === 'free') return 0;
  const match = costStr.match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(',', '.')) : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function enrichPlaceWithAi(placeTitle: string, location?: {lat: number, lng: number}): Promise<{
  description: BilingualString;
  cost?: number;
  duration?: number;
}> {
  const apiKey = geminiKeyManager.getNextKey();
  if (!apiKey) throw new Error('No API keys available.');

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are a travel data assistant. I have a location from Google Maps:
Title: ${placeTitle}
${location ? `Coordinates: ${location.lat}, ${location.lng}` : ''}

Please return ONLY a valid JSON object with detailed travel information about this place.
Do not wrap it in markdown block quotes.

Format required:
{
  "description": {
    "en": "A 2-3 sentence engaging description about what this place is and why to visit.",
    "cs": "Czech translation of the description."
  },
  "cost": 15.5, // Numeric estimated entrance fee or cost in Euros. Return 0 if free, or null if unknown or completely unpredictable
  "duration": 60 // Estimated typical visit duration in minutes
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.2 },
    });
    
    let text = response.text || '';
    text = stripCodeFences(text);
    const parsed = JSON.parse(text);
    
    return {
      description: parsed.description || { en: '', cs: '' },
      cost: parsed.cost !== null ? parsed.cost : undefined,
      duration: parsed.duration || 60
    };
  } catch (err) {
    console.error('Failed to enrich place via AI:', err);
    throw new Error('Failed to generate place details.');
  }
}
