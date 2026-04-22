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

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedPOI {
  title: string;
  description: string;
  category: Category;
  cost?: string;          // e.g. "€65", "€8", "free"
  startTime?: string;     // e.g. "7:00 AM", "16:00"
  duration?: number;      // minutes
  address?: string;
  practicalTips?: string;  // Tips specifically for this POI
  coords?: { lat: number; lng: number };
  imageKeyword?: string;  // keyword for targeted image search, e.g. "Sete Cidades lake azores"
}

export interface ParsedDay {
  dayNumber: number;
  title: string;         // e.g. "First Steps in Ponta Delgada"
  activities: ParsedPOI[];
  dayNotes?: string;     // Footer/practical tips for the whole day
}

export interface SplitterResult {
  totalDays: number;
  globalInfo: string;     // Intro/overview text before day 1
  dayChunks: {
    dayNumber: number;
    title: string;
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
  onProgress?: ProgressCallback
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
  "globalInfo": "<all text before Day 1>",
  "dayChunks": [
    {
      "dayNumber": 1,
      "title": "<day title, e.g. 'First Steps in Ponta Delgada'>",
      "rawText": "<COMPLETE verbatim text for this entire day, including all subsections, tips, restaurants, notes>"
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
      const parsed = JSON.parse(text.trim());
      
      onProgress?.(`Found ${parsed.totalDays} days in document.`);
      return parsed as SplitterResult;
    } catch (err: any) {
      console.error('Splitter error:', err);
      if (err.message?.includes('429') || err.message?.includes('503')) {
        geminiKeyManager.markKeyFailed(apiKey, true, 30); // 30s cooldown on quotas/503
        retryCount++;
        await delay(1500);
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
  dayChunk: { dayNumber: number; title: string; rawText: string },
  globalInfo: string,
  destination: string,
  travelers: number,
  onProgress?: ProgressCallback
): Promise<ParsedDay> {
  onProgress?.(`Extracting Day ${dayChunk.dayNumber}: ${dayChunk.title}...`);

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
3. **COSTS**: Capture ALL prices mentioned (e.g., "€65", "€1/hour", "€12 per person", "free") into the "cost" field.
4. **TIMEFRAMES**: Capture specific times (e.g., "between 7:00 and 9:00 AM", "after 4:00 PM", "7:00 AM to 11:00 PM") into the "startTime" field.
5. **PRACTICAL TIPS**: If a tip is specific to a POI (e.g., "Bring water shoes" for a thermal pool), attach it to that POI's "practicalTips" field.
6. **DAY-LEVEL NOTES**: If practical tips apply to the whole day (e.g., "Bring plenty of water for the hike"), include them in the "dayNotes" field.
7. **RESTAURANTS/FOOD**: Every restaurant, café, food truck, or food recommendation is a separate POI with category "Food".
8. **TRANSPORT**: Transfer instructions, car rental advice, parking info should be category "Transport".
9. **CATEGORY VALUES**: Use ONLY these: "Sightseeing", "Food", "Activity", "Transport", "Special", "City".
10. **DURATION**: Estimate intelligently: quick viewpoints=20min, museums=60min, hikes=120min, meals=60min, thermal pools=90min, whale watching=180min.

Return ONLY valid JSON (no markdown code blocks):
{
  "dayNumber": ${dayChunk.dayNumber},
  "title": "${dayChunk.title}",
  "activities": [
    {
      "title": "Exact Place Name",
      "description": "FULL description with ALL original details, tips, and recommendations. Do NOT shorten.",
      "category": "Sightseeing",
      "cost": "€12" or "free" or null,
      "startTime": "8:00 AM" or null,
      "duration": 60,
      "address": "Location/area name",
      "practicalTips": "Specific tips for this POI" or null,
      "coords": { "lat": 37.123, "lng": -25.456 },
      "imageKeyword": "terra nostra thermal pool azores"
    }
  ],
  "dayNotes": "Day-level practical tips" or null
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
      if (err.message?.includes('429') || err.message?.includes('503')) {
        geminiKeyManager.markKeyFailed(apiKey, true, 30);
        retryCount++;
        await delay(2000);
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
  onProgress?: ProgressCallback
): Promise<ParsedDay[]> {
  // Step A: Split the document
  const structure = await splitDocument(documentText, onProgress);
  
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
    
    // Small delay between days to be kind to rate limits
    if (structure.dayChunks.indexOf(chunk) < structure.dayChunks.length - 1) {
      await delay(500);
    }
  }

  onProgress?.(`Extraction complete: ${results.reduce((sum, d) => sum + d.activities.length, 0)} total activities across ${results.length} days.`);
  return results;
}

/**
 * Generates a fresh itinerary (no document) using the same chunked approach.
 * One Gemini call per day to avoid token limits on long trips.
 */
export async function generateItineraryFromScratch(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  intensity: string,
  referenceContext: string,
  onProgress?: ProgressCallback
): Promise<ParsedDay[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

  onProgress?.(`Planning ${totalDays}-day trip to ${destination}...`);

  const results: ParsedDay[] = [];
  const previousContext: string[] = [];

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    onProgress?.(`Planning Day ${dayNum} of ${totalDays}...`);

    let retryCount = 0;
    const maxRetries = 3;
    let dayResult: ParsedDay | null = null;

    while (!dayResult && retryCount < maxRetries) {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) throw new Error('No API keys available.');

      try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Create a HIGHLY detailed single-day itinerary for Day ${dayNum} of a ${totalDays}-day trip to ${destination}.
Travelers: ${travelers} people. Pace: ${intensity}.

${referenceContext ? `REFERENCE DOCUMENTS (FAVOR these places and descriptions):\n${referenceContext}\n` : ''}
${previousContext.length > 0 ? `PREVIOUS DAYS (don't repeat, ensure geographic flow):\n${previousContext.slice(-2).join('\n')}\n` : ''}

REQUIREMENTS:
- Extract or plan EVERY activity, restaurant, and viewpoint for this day. No limits on count.
- Include FOOD stops (breakfast, lunch, dinner, snacks).
- Cluster locations geographically for efficient routing.
- Include costs where known (e.g. "€12", "free").
- Include suggested start times for time-sensitive activities.
- Duration in minutes for each activity.

Return ONLY valid JSON (no markdown code blocks):
{
  "dayNumber": ${dayNum},
  "title": "A descriptive title for this day",
  "activities": [
    {
      "title": "Place Name",
      "description": "Detailed engaging description with all practical info",
      "category": "Sightseeing"|"Food"|"Activity"|"Transport"|"Special"|"City",
      "cost": "€12" or "free" or null,
      "startTime": "8:00 AM" or null,
      "duration": 60,
      "address": "Location name",
      "practicalTips": null,
      "coords": { "lat": 37.123, "lng": -25.456 },
      "imageKeyword": "descriptive photo keyword for this place"
    }
  ],
  "dayNotes": null
}`;

        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: 'You are a professional travel planner. Output ONLY valid JSON. Be very detailed. No limits on activity count.',
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        });

        let text = result.text || '';
        text = stripCodeFences(text);
        dayResult = JSON.parse(text.trim()) as ParsedDay;
        
        // Build context for next day
        previousContext.push(`Day ${dayNum} "${dayResult.title}": ${dayResult.activities.map(a => a.title).join(', ')}`);
        
      } catch (err: any) {
        console.error(`Generation error (Day ${dayNum}):`, err);
        if (err.message?.includes('429')) {
          geminiKeyManager.markKeyFailed(apiKey, true);
          retryCount++;
          await delay(2000);
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

    // Small delay between days
    if (dayNum < totalDays) {
      await delay(500);
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
      title: { en: act.title, cs: act.title },
      description: { 
        en: buildDescription(act), 
        cs: buildDescription(act) 
      },
      category: (act.category as Category) || 'Sightseeing',
      duration: act.duration || 60,
      cost: act.cost ? parseCost(act.cost) : undefined,
      startTime: act.startTime || undefined,
      address: act.address || act.title,
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
        description: { en: day.dayNotes, cs: day.dayNotes },
        category: 'Special' as Category,
        duration: 0,
      });
    }

    result[iso] = pois;
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDescription(act: ParsedPOI): string {
  let desc = act.description;
  if (act.practicalTips) {
    desc += `\n\n💡 ${act.practicalTips}`;
  }
  return desc;
}

function parseCost(costStr: string): number | undefined {
  if (!costStr || costStr.toLowerCase() === 'free') return 0;
  const match = costStr.match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(',', '.')) : undefined;
}

function stripCodeFences(text: string): string {
  if (text.startsWith('```json')) text = text.substring(7);
  else if (text.startsWith('```')) text = text.substring(3);
  if (text.endsWith('```')) text = text.substring(0, text.lastIndexOf('```'));
  return text.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
