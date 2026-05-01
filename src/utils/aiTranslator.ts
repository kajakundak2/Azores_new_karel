import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from './geminiKeyManager';
import { BilingualString } from './types';
import { stripCodeFences } from './bilingualUtils';

class AITranslator {
  private cache: Record<string, BilingualString> = {};

  async translate(text: string): Promise<BilingualString> {
    if (this.cache[text]) return this.cache[text];

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) break;

      try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: [{ role: 'user', parts: [{ text: `Translate to English (en) and Czech (cs). Return ONLY JSON {"en":"...","cs":"..."}: "${text}"` }] }],
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        });
        const jsonStr = stripCodeFences(result.text || '');
        const bilingual = JSON.parse(jsonStr) as BilingualString;
        this.cache[text] = bilingual;
        return bilingual;
      } catch (err: any) {
        const is503 = err.message?.includes('503');
        const is429 = err.message?.includes('429');

        if (is503) {
          console.error('Gemini Service is currently unavailable (503). Stopping translation.');
          geminiKeyManager.reportServiceDown();
          throw new Error('Gemini Service Unavailable (503). Model is under heavy load. Please try again later.');
        }

        if (is429) {
          geminiKeyManager.markKeyFailed(apiKey, true, 60);
          retryCount++;
          await new Promise(r => setTimeout(r, 1000 * retryCount));
          continue;
        }

        console.error('Translation attempt failed:', err);
        geminiKeyManager.markKeyFailed(apiKey, false);
        retryCount++;
      }
    }

    console.error('All translation attempts failed for:', text);
    return { en: text, cs: text };
  }

  /**
   * Batch translate multiple strings in a SINGLE API call.
   * Much faster than calling translate() per string.
   * Max 20 strings per batch.
   */
  async translateBatch(texts: string[]): Promise<BilingualString[]> {
    if (texts.length === 0) return [];

    // Check cache first, separate cached vs uncached
    const results: (BilingualString | null)[] = texts.map(t => this.cache[t] || null);
    const uncachedIndices = results.map((r, i) => r === null ? i : -1).filter(i => i >= 0);
    const uncachedTexts = uncachedIndices.map(i => texts[i]);

    if (uncachedTexts.length === 0) return results as BilingualString[];

    // Batch translate uncached strings
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) break;

      try {
        const ai = new GoogleGenAI({ apiKey });
        const numberedList = uncachedTexts.map((t, i) => `${i + 1}. "${t}"`).join('\n');
        const result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: [{ role: 'user', parts: [{ text: `Translate each text to English (en) and Czech (cs). Return ONLY a JSON array of objects [{"en":"...","cs":"..."},...].\n\nTexts:\n${numberedList}` }] }],
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        });
        const jsonStr = stripCodeFences(result.text || '');
        const translations = JSON.parse(jsonStr) as BilingualString[];

        // Fill results and cache
        for (let i = 0; i < uncachedIndices.length; i++) {
          const translation = translations[i] || { en: uncachedTexts[i], cs: uncachedTexts[i] };
          results[uncachedIndices[i]] = translation;
          this.cache[uncachedTexts[i]] = translation;
        }

        return results as BilingualString[];
      } catch (err: any) {
        const is503 = err.message?.includes('503');
        const is429 = err.message?.includes('429');

        if (is503) {
          geminiKeyManager.reportServiceDown();
          break;
        }
        if (is429) {
          geminiKeyManager.markKeyFailed(apiKey, true, 60);
        } else {
          geminiKeyManager.markKeyFailed(apiKey, false);
        }
        retryCount++;
        await new Promise(r => setTimeout(r, 1000 * retryCount));
      }
    }

    // Fallback: return originals for uncached
    for (const i of uncachedIndices) {
      if (!results[i]) {
        results[i] = { en: texts[i], cs: texts[i] };
      }
    }
    return results as BilingualString[];
  }
}

export const aiTranslator = new AITranslator();
