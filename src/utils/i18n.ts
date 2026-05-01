import { TEXTS } from '../data';

/**
 * Robust translation helper with placeholder support
 * Example: t('days_count', { count: 10 })
 */
export const createT = (lang: string) => {
  return (key: string, params?: Record<string, any>) => {
    const entry = TEXTS[key];
    if (!entry) return key;

    let val = entry[lang] || entry['en'] || key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(`{{${k}}}`, String(v));
      });
    }
    
    return val;
  };
};

/**
 * Standard translator for simple cases
 */
export const getT = (key: string, lang: string) => createT(lang)(key);
