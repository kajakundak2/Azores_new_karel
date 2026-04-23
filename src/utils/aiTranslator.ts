import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from './geminiKeyManager';
import { BilingualString } from './itineraryParser';
import { stripCodeFences } from './bilingualUtils';

class AITranslator {
  private cache: Record<string, BilingualString> = {};

  async translate(text: string): Promise<BilingualString> {
    if (this.cache[text]) return this.cache[text];

    const apiKey = geminiKeyManager.getNextKey();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Translate the following text into both English (en) and Czech (cs). 
Return ONLY a JSON object: {"en": "...", "cs": "..."}

Text to translate:
"${text}"`;

    try {
      const result = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });
      const jsonStr = stripCodeFences(result.text || '');
      const bilingual = JSON.parse(jsonStr) as BilingualString;
      this.cache[text] = bilingual;
      return bilingual;
    } catch (e) {
      console.error('Translation failed:', e);
      return { en: text, cs: text };
    }
  }


}

export const aiTranslator = new AITranslator();
