/**
 * Gemini API Key Rotation Manager
 * 
 * Handles revolving through multiple API keys to avoid 429 Rate Limit errors.
 * Implements a 60-second cooldown for keys that report errors.
 */

class GeminiKeyManager {
  private keys: string[] = [];
  private currentIdx: number = 0;
  private cooldowns: Map<string, number> = new Map();

  constructor() {
    // Collect all available keys from .env
    const env = import.meta.env;
    const key1 = env.VITE_GEMINI_API_KEY_1;
    const key2 = env.VITE_GEMINI_API_KEY_2;
    const key3 = env.VITE_GEMINI_API_KEY_3;
    const key4 = env.VITE_GEMINI_API_KEY_4;
    const key5 = env.VITE_GEMINI_API_KEY_5;
    const key6 = env.VITE_GEMINI_API_KEY_6;
    const key7 = env.VITE_GEMINI_API_KEY_7;
    const defaultKey = env.VITE_GEMINI_API_KEY;

    // Filter out undefined and duplicates
    const allKeys = [key1, key2, key3, key4, key5, key6, key7, defaultKey].filter(Boolean);
    this.keys = Array.from(new Set(allKeys));

    if (this.keys.length === 0) {
      console.warn('GeminiKeyManager: No API keys found in environment variables.');
    } else {
      console.log(`GeminiKeyManager: Initialized with ${this.keys.length} keys.`);
    }
  }

  private serviceStatus: 'up' | 'down' = 'up';
  private lastDownTime: number = 0;

  /**
   * Returns the next available API key that isn't on cooldown.
   */
  getNextKey(): string {
    if (this.serviceStatus === 'down') {
      const now = Date.now();
      if (now - this.lastDownTime < 300000) { // 5 minute global cooldown for 503
        return '';
      }
      this.serviceStatus = 'up';
    }

    if (this.keys.length === 0) return '';

    const startIdx = this.currentIdx;
    const now = Date.now();

    // Iterate through keys until we find one not on cooldown
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (startIdx + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldownUntil = this.cooldowns.get(key) || 0;

      if (now > cooldownUntil) {
        this.currentIdx = idx;
        return key;
      }
    }

    // If all keys are on cooldown, return the current one anyway (last resort)
    console.warn('GeminiKeyManager: All keys are currently on cooldown. Attempting with current key.');
    return this.keys[this.currentIdx];
  }

  /**
   * Reports a global service error (like 503).
   */
  reportServiceDown() {
    this.serviceStatus = 'down';
    this.lastDownTime = Date.now();
    console.error('GeminiKeyManager: Global service outage detected. Entering 5-minute cooldown.');
  }

  isServiceDown(): boolean {
    if (this.serviceStatus === 'down') {
      const now = Date.now();
      if (now - this.lastDownTime < 300000) return true;
      this.serviceStatus = 'up';
    }
    return false;
  }

  /**
   * Reports an error for the specific key, putting it on cooldown.
   * @param key The key that failed.
   * @param isFatal Whether the error is fatal (currently unused but kept for compatibility).
   * @param cooldownSec Cooldown duration in seconds (default 60).
   */
  markKeyFailed(key: string, isFatal: boolean = false, cooldownSec: number = 60) {
    if (!key) return;
    
    console.error(`GeminiKeyManager: Key reported error (fatal: ${isFatal}). Cooling down for ${cooldownSec}s: ${key.substring(0, 8)}...`);
    this.cooldowns.set(key, Date.now() + cooldownSec * 1000);
    
    // Immediately rotate to next key for next call
    this.currentIdx = (this.currentIdx + 1) % this.keys.length;
  }

  /**
   * Returns the count of active keys not on cooldown.
   */
  getAvailableCount(): number {
    const now = Date.now();
    return this.keys.filter(key => (this.cooldowns.get(key) || 0) < now).length;
  }
}

export const geminiKeyManager = new GeminiKeyManager();
