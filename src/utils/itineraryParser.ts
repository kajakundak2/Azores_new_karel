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

const genAIClients = new Map<string, GoogleGenAI>();
function getGenAIClient(apiKey: string) {
  if (!genAIClients.has(apiKey)) {
    genAIClients.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  return genAIClients.get(apiKey)!;
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
  const maxRetries = 6;

  while (retryCount < maxRetries) {
    const apiKey = geminiKeyManager.getNextKey();
    if (!apiKey) throw new Error('No API keys available.');

    try {
      const ai = getGenAIClient(apiKey);
      
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
        model: 'gemini-flash-lite-latest',
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
      const isLeaked = err.message?.toLowerCase().includes('leaked') || err.message?.includes('403');
      if (isLeaked) {
        geminiKeyManager.markKeyFailed(apiKey, true, 60, true);
        retryCount++;
        await delay(1000);
        continue;
      }
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
      const ai = getGenAIClient(apiKey);
      
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
5. **TIMEFRAMES**: Capture specific times into the "startTime" field. If no specific time is mentioned, you MUST assign a sequentially increasing "startTime" in 24h format (e.g. "09:00", "11:00", "14:30") to EVERY activity. Calculate start times so they account for the previous activity's duration plus transit. NEVER schedule multiple activities at the same time!
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
        model: 'gemini-flash-lite-latest',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: 'You are a meticulous travel data extractor. Output ONLY valid JSON. NEVER summarize — extract every detail verbatim from the source text. No POI count limits.',
          temperature: 0.15,
          responseMimeType: 'application/json'
        }
      });

      let text = result.text || '';
      text = stripCodeFences(text);
      console.log(`[ItineraryParser] RAW Output for Day ${dayChunk.dayNumber}:`, text);
      const parsed = JSON.parse(text.trim());
      
      onProgress?.(`Day ${dayChunk.dayNumber}: Found ${parsed.activities?.length || 0} activities.`);
      return parsed as ParsedDay;
    } catch (err: any) {
      console.error(`Worker error (Day ${dayChunk.dayNumber}):`, err);
      const isLeaked = err.message?.toLowerCase().includes('leaked') || err.message?.includes('403');
      if (isLeaked) {
        geminiKeyManager.markKeyFailed(apiKey, true, 60, true);
        retryCount++;
        await delay(1000);
        continue;
      }
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
 * Generates a fresh itinerary using a 3-agent multi-agent debate architecture:
 *   Agent 1 — Architect: Creates a logically-routed day-by-day outline.
 *   Agent 2 — Critic:    Reviews the outline, challenges weak choices, and produces
 *                        an improved, refined plan with specific reasons.
 *   Agent 3 — Detailer:  Expands each day of the final agreed plan into full POI JSON.
 *
 * This mirrors a real team discussion: propose → critique → finalize.
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

  onProgress?.(`🏗️ Agent 1 (Architect): Designing ${totalDays}-day outline for ${destination}...`);

  const getKey = () => {
    const key = geminiKeyManager.getNextKey();
    if (!key) throw new Error('No API keys available.');
    return key;
  };

  const callGemini = async (
    systemInstruction: string,
    userPrompt: string,
    temperature: number,
    useJson = false,
    retries = 8
  ): Promise<string> => {
    let attempt = 0;
    while (attempt < retries) {
      const apiKey = getKey();
      try {
        const ai = getGenAIClient(apiKey);
        // Race against a 90-second timeout to prevent infinite hangs
        const timeoutMs = 90_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const resultPromise = ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            temperature,
            ...(useJson ? { responseMimeType: 'application/json' } : {}),
            httpOptions: { signal: controller.signal } as any
          }
        });
        const result = await resultPromise;
        clearTimeout(timer);
        return result.text || '';
      } catch (err: any) {
        const msg = err.message || '';
        const isLeaked = msg.toLowerCase().includes('leaked') || msg.includes('403');
        const isRetryable = msg.includes('429') || msg.includes('503')
          || msg.includes('Failed to fetch') || msg.includes('fetch failed')
          || msg.includes('INSUFFICIENT_RESOURCES') || msg.includes('AbortError')
          || msg.includes('aborted') || msg.includes('network');
        if (isLeaked) {
          geminiKeyManager.markKeyFailed(apiKey, true, 60, true);
        } else if (isRetryable) {
          geminiKeyManager.markKeyFailed(apiKey, true, 30);
          // Exponential backoff with jitter, capped at 30s
          const backoff = Math.min(3000 * Math.pow(1.8, attempt), 30_000) + Math.random() * 2000;
          console.warn(`[MultiAgent] Retryable error (attempt ${attempt + 1}/${retries}), waiting ${(backoff / 1000).toFixed(1)}s:`, msg.substring(0, 120));
          await delay(backoff);
        } else {
          await delay(1500);
        }
        attempt++;
        if (attempt >= retries) throw err;
      }
    }
    throw new Error('Max retries exceeded.');
  };

  const isPartial = targetDayNumbers && targetDayNumbers.length > 0;
  const targetDaysStr = isPartial ? targetDayNumbers!.join(', ') : `1 to ${totalDays}`;

  // ── Agent 1: Architect ───────────────────────────────────────────────────────
  const architectPrompt = `You are the TRIP ARCHITECT. Your job is to design the FIRST DRAFT of a trip to ${destination}.
${isPartial ? `CRITICAL: You are ONLY replanning Day(s) ${targetDaysStr}. Do NOT plan any other days.` : `Plan all days from 1 to ${totalDays}.`}

Travelers: ${travelers} people. Pace: ${intensity}.
${referenceContext ? `PREFERENCES & CONTEXT:\n${referenceContext}\n` : ''}
RULES:
- Route logically to minimize backtracking each day.
- Allocate 2-3 REAL specific restaurants per day (breakfast, lunch, dinner).
- Balance sightseeing, nature, local culture, and food.
- Adjust activity density to the pace (relaxed = fewer, packed = more).
${isPartial ? '- MUST NOT reuse activities already present on other days (check the context).' : ''}
- DO NOT output JSON. Plain text only.

Output format:
${isPartial ? `Day ${targetDayNumbers![0]}: [Theme]` : `Day 1: [Theme]`}
- Morning: [Activity with brief rationale]
- Lunch: [Restaurant name]
- Afternoon: [Activity]
- Dinner: [Restaurant name]
...`;

  const architectOutline = await callGemini(
    'You are an expert travel architect. Create a first-draft itinerary outline. Plain text only, no JSON.',
    architectPrompt,
    0.75
  );
  console.log('[MultiAgent] Architect outline (first 500 chars):', architectOutline.substring(0, 500));

  // ── Agent 2: Critic ──────────────────────────────────────────────────────────
  onProgress?.(`🔍 Agent 2 (Critic): Reviewing and improving the plan...`);
  await delay(800);

  const criticPrompt = `You are the TRIP CRITIC. You have received the following first-draft itinerary for ${isPartial ? `Day(s) ${targetDaysStr} of ` : ''}a trip to ${destination}.

FIRST DRAFT:
---
${architectOutline}
---

Travelers: ${travelers} people. Pace: ${intensity}.
${referenceContext ? `USER PREFERENCES & CONTEXT:\n${referenceContext}\n` : ''}
YOUR TASK: Critically review the draft and produce an IMPROVED version. You MUST:
1. Identify at least 3 weaknesses (e.g., poor routing, generic restaurants, too many activities for the pace, missed key local experiences${isPartial ? ', or reusing places already seen on other days' : ''}).
2. Fix each weakness in the improved plan.
3. Ensure the improved plan is realistic and logistically sound.
4. Keep real, specific place names and restaurants.
${isPartial ? `5. ONLY output the improved plan for Day(s) ${targetDaysStr}.` : ''}

Output format:
CRITIQUE:
- [Issue 1]: [Fix applied]
- [Issue 2]: [Fix applied]
- [Issue 3]: [Fix applied]

IMPROVED PLAN:
${isPartial ? `Day ${targetDayNumbers![0]}: [Theme]` : `Day 1: [Theme]`}
- Morning: ...
...`;

  const criticResponse = await callGemini(
    'You are an expert travel critic and editor. Identify weaknesses and produce a stronger, refined travel plan. Plain text only.',
    criticPrompt,
    0.6
  );
  console.log('[MultiAgent] Critic response (first 500 chars):', criticResponse.substring(0, 500));

  // Extract the improved plan from the critic output
  const improvedPlanMatch = criticResponse.match(/IMPROVED PLAN[:\s\n]+([\s\S]+)/i);
  const finalOutline = improvedPlanMatch ? improvedPlanMatch[1].trim() : criticResponse;
  console.log('[MultiAgent] Final agreed plan (first 500 chars):', finalOutline.substring(0, 500));

  // ── Agent 3: Detailer (per-day) ──────────────────────────────────────────────
  const results: ParsedDay[] = [];
  const daysToProcess = targetDayNumbers || Array.from({ length: totalDays }, (_, i) => i + 1);

  for (const dayNum of daysToProcess) {
    onProgress?.(`📋 Agent 3 (Detailer): Expanding Day ${dayNum} of ${totalDays} into full schedule...`);

    const detailerPrompt = `You are the TRIP DETAILER. The planning team has agreed on the following trip outline:

${finalOutline}

Your task is to FULLY EXPAND Day ${dayNum} into a complete, detailed schedule.

CONTEXT:
- Destination: ${destination}
- Travelers: ${travelers}
- Intensity: ${intensity}
${referenceContext}

REQUIREMENTS FOR DAY ${dayNum}:
1. Extract or plan EVERY activity, restaurant, and viewpoint.
2. Include breakfast, lunch, dinner, and snack stops.
3. SMART SCHEDULING: Each activity gets a sequential "startTime" in "HH:MM" 24h format (e.g., "09:00", "11:30"). Account for duration and transit. NEVER two activities at the same time.
4. Duration in minutes: viewpoints=20, museums=60-90, hikes=90-180, meals=45-75, beaches=120.
5. REAL PLACES ONLY — realistic GPS coordinates (lat/lng) for the destination area.
6. Include approximate costs ("€15", "free", etc.).
7. BILINGUAL: ALL text in both English (en) and Czech (cs).
8. Category: use ONLY "Sightseeing", "Food", "Activity", "Transport", "Special", "City".

Return ONLY valid JSON:
{
  "dayNumber": ${dayNum},
  "title": { "en": "Day Title", "cs": "Nazev dne" },
  "activities": [
    {
      "title": { "en": "Exact Place Name", "cs": "Presny nazev mista" },
      "description": { "en": "Engaging 2-3 sentence description.", "cs": "Poutavy 2-3 vetny popis." },
      "category": "Sightseeing",
      "cost": "12 EUR",
      "startTime": "09:00",
      "duration": 60,
      "address": "Street or area name",
      "practicalTips": { "en": "Specific tip", "cs": "Specificky tip" },
      "coords": { "lat": 37.123, "lng": -25.456 },
      "imageKeyword": "descriptive photo search term"
    }
  ],
  "dayNotes": { "en": "Overall day tips", "cs": "Celkove tipy pro den" }
}`;

    let dayResult: ParsedDay | null = null;
    let retryCount = 0;
    const maxRetries = 6;

    while (!dayResult && retryCount < maxRetries) {
      try {
        const raw = await callGemini(
          'You are an expert trip detailer. Output ONLY valid JSON. Include REAL places with correct coordinates for the destination. NEVER invent fake places.',
          detailerPrompt,
          0.4,
          true
        );
        const cleaned = stripCodeFences(raw);
        console.log(`[MultiAgent] Detailer Day ${dayNum} raw (first 300):`, cleaned.substring(0, 300));
        dayResult = JSON.parse(cleaned.trim()) as ParsedDay;
      } catch (err: any) {
        console.error(`[MultiAgent] Detailer Day ${dayNum} error:`, err);
        retryCount++;
        await delay(1500 * retryCount);
      }
    }

    results.push(dayResult || {
      dayNumber: dayNum,
      title: { en: `Day ${dayNum}`, cs: `Den ${dayNum}` },
      activities: [],
      dayNotes: { en: 'Generation failed for this day — please retry.', cs: 'Generovani pro tento den selhalo — zkuste znovu.' }
    });

    if (dayNum < daysToProcess[daysToProcess.length - 1]) {
      // Generous inter-day delay to let browser connection pool recover
      await delay(2500 + Math.random() * 1000);
    }
  }

  const totalActivities = results.reduce((sum, d) => sum + d.activities.length, 0);
  onProgress?.(`✅ Multi-agent planning complete: ${totalActivities} activities across ${results.length} days.`);
  return results;
}


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

  const ai = getGenAIClient(apiKey);
  
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
      model: 'gemini-flash-lite-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        systemInstruction: 'You are a precise travel data assistant. Output ONLY valid JSON.',
        temperature: 0.2,
        responseMimeType: 'application/json'
      },
    });
    
    let text = response.text || '';
    text = stripCodeFences(text);
    const parsed = JSON.parse(text);
    
    return {
      description: parsed.description || { en: '', cs: '' },
      cost: parsed.cost !== null ? parsed.cost : undefined,
      duration: parsed.duration || 60
    };
  } catch (err: any) {
    console.error('Failed to enrich place via AI:', err);
    if (err.message?.toLowerCase().includes('leaked') || err.message?.includes('403')) {
      geminiKeyManager.markKeyFailed(apiKey, true, 60, true);
    }
    throw new Error('Failed to generate place details.');
  }
}
