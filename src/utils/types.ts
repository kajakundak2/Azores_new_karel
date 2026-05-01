import { POI, Category, TravelerProfile, ReferenceDoc } from '../data';

export interface BilingualString {
  en: string;
  cs: string;
  [key: string]: string;
}

export interface ParsedPOI {
  title: string | BilingualString;
  description: string | BilingualString;
  category: string;
  cost?: string;
  startTime?: string;
  duration?: number;
  address?: string;
  practicalTips?: string | BilingualString;
  coords?: { lat: number; lng: number };
  imageKeyword?: string;
}

export interface ParsedDay {
  dayNumber: number;
  title: string | BilingualString;
  activities: ParsedPOI[];
  dayNotes?: string | BilingualString;
}

export interface SplitterResult {
  totalDays: number;
  globalInfo: string | BilingualString;
  dayChunks: {
    dayNumber: number;
    title: string | BilingualString;
    rawText: string;
  }[];
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system' | 'assistant';
  text: string | BilingualString;
  uiCards?: POI[];
  isStreaming?: boolean;
  timestamp?: string;
}

export { type POI, type Category, type TravelerProfile, type ReferenceDoc };
