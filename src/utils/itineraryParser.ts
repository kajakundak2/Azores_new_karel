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

// ── Types ────────────────────────────────────────────────────────────────────

export interface BilingualString {
  en: string;
  cs: string;
  [key: string]: string;
}

export interface ParsedPOI {
  title: string | BilingualString;
  description: string | BilingualString;
  category: Category;
  cost?: string;          // e.g. "€65", "€8", "free"
  startTime?: string;     // e.g. "7:00 AM", "16:00"
  duration?: number;      // minutes
  address?: string;
  practicalTips?: string | BilingualString;  // Tips specifically for this POI
  coords?: { lat: number; lng: number };
  imageKeyword?: string;  // keyword for targeted image search, e.g. "Sete Cidades lake azores"
}

export interface ParsedDay {
  dayNumber: number;
  title: string | BilingualString;         // e.g. "First Steps in Ponta Delgada"
  activities: ParsedPOI[];
  dayNotes?: string | BilingualString;     // Footer/practical tips for the whole day
}

export interface SplitterResult {
  totalDays: number;
  globalInfo: string | BilingualString;     // Intro/overview text before day 1
  dayChunks: {
    dayNumber: number;
    title: string | BilingualString;
    rawText: string;      // The full text for this day
  }[];
}

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
  const maxRetries = 3;

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
        geminiKeyManager.markKeyFailed(apiKey, true, 30); // 30s cooldown on quotas/503
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
  const maxRetries = 3;

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
      "imageKeyword": "terra nostra thermal pool azores"
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
        geminiKeyManager.markKeyFailed(apiKey, true, 30);
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
  intensity: string,
  referenceContext: string,
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
  try {
    const outlinePrompt = `Create a plain-text logically routed outline for a ${totalDays}-day trip to ${destination}. Do NOT output JSON.
Travelers: ${travelers} people. Pace: ${intensity}.
${referenceContext ? `REFERENCE PREFERENCES:\n${referenceContext}\n` : ''}
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
    throw new Error('Failed to generate high-level outline: ' + err.message);
  }

  // Phase 2: Day details
  const results: ParsedDay[] = [];

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    // If specific target days are requested, skip others
    if (targetDayNumbers && targetDayNumbers.length > 0 && !targetDayNumbers.includes(dayNum)) {
      continue;
    }

    onProgress?.(`Phase 2: Planning Day ${dayNum} of ${totalDays}...`);

    let retryCount = 0;
    const maxRetries = 3;
    let dayResult: ParsedDay | null = null;

    while (!dayResult && retryCount < maxRetries) {
      apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) throw new Error('No API keys available.');

      try {
        ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Here is the high-level outline for the trip to ${destination}:

${outline}

Extract and expand the details for DAY ${dayNum} ONLY.

REQUIREMENTS:
- Extract or plan EVERY activity, restaurant, and viewpoint for this day. No limits on count.
- Include FOOD stops (breakfast, lunch, dinner, snacks).
- SMART SCHEDULING: Allocate realistic duration times for people to actually visit and enjoy each place (e.g., 2 hours for a major museum or hike, 45 mins for a coffee, 1.5 hours for lunch).
- Logically order activities by start time, ensuring you account for driving/transit time between points!
- MUST output REAL PLACES ONLY with realistic GPS coordinates (lat/lng) so it can be viewed on Google Maps.
- Include costs where known (e.g. "€12", "free").
- Include suggested start times for every single activity (e.g. "09:00").
- Duration in minutes for each activity.

Return ONLY valid JSON (no markdown code blocks):
{
  "dayNumber": ${dayNum},
  "title": {
    "en": "A descriptive title for this day based on the outline",
    "cs": "Czech translation of the title"
  },
  "activities": [
    {
      "title": { "en": "Place Name", "cs": "Czech translation of Place Name" },
      "description": { 
        "en": "Detailed engaging description with all practical info",
        "cs": "Czech translation of the description"
      },
      "category": "Sightseeing"|"Food"|"Activity"|"Transport"|"Special"|"City",
      "cost": "€12" or "free" or null,
      "startTime": "09:00",
      "duration": 60,
      "address": "Location name",
      "practicalTips": { "en": "Tips...", "cs": "Czech tips..." },
      "coords": { "lat": 37.123, "lng": -25.456 },
      "imageKeyword": "descriptive photo keyword for this place"
    }
  ],
  "dayNotes": { "en": "Notes...", "cs": "Czech notes..." }
}`;

        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: 'You are an expert trip detailer. Output strictly valid JSON matching the schema for ONE day. YOU MUST OUTPUT REAL PLACES ONLY. Every activity and restaurant MUST exist in the real world with realistic GPS coordinates. PLAN SMARTLY: Allocate realistic durations for normal tourists and ensure geographic transit time makes sense between consecutive items.',
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
          geminiKeyManager.markKeyFailed(apiKey, true, 30);
          retryCount++;
          const backoff = 2000 * Math.pow(2, retryCount);
          console.warn(`Applying backoff of ${backoff}ms before retrying...`);
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
        title: `Day ${dayNum}`,
        activities: [],
        dayNotes: 'Generation failed for this day.'
      });
    }

    // Increased delay between days
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
