import { BilingualString } from './types';
import { aiTranslator } from './aiTranslator';

export function ensureBilingual(value: string | BilingualString | undefined): BilingualString {
  if (!value) return { en: '', cs: '' };
  if (typeof value === 'string') {
    return { en: value, cs: value };
  }
  return value;
}

/**
 * Ensures a value is a BilingualString. 
 * If it's a string, it uses AI to translate it into both languages.
 */
export async function ensureBilingualAsync(value: string | BilingualString | undefined): Promise<BilingualString> {
  if (!value) return { en: '', cs: '' };
  if (typeof value === 'string') {
    return await aiTranslator.translate(value);
  }
  
  // If it's already an object but one side is empty or identical to the other, 
  // maybe we should translate it too. But for now, just return.
  if (value.en && !value.cs && value.en !== '') {
     const t = await aiTranslator.translate(value.en);
     return { en: value.en, cs: t.cs };
  }
  if (!value.en && value.cs && value.cs !== '') {
     const t = await aiTranslator.translate(value.cs);
     return { en: t.en, cs: value.cs };
  }

  return value;
}

export function translate(value: string | BilingualString | undefined, lang: string): string {
  const b = ensureBilingual(value);
  return lang === 'cs' ? b.cs : b.en;
}

export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
  return cleaned.trim();
}

