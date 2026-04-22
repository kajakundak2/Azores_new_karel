import React, { useState, useEffect, useCallback, useRef } from 'react';
import CharacterAvatar from './CharacterAvatar';
import { SIDEKICK_ASSETS } from '../../hooks/useCharacterState';
import { TravelerProfile, TEXTS } from '../../data';
import { GoogleGenAI } from '@google/genai';
import { geminiKeyManager } from '../../utils/geminiKeyManager';
import { Loader2, Plus, Trash2, Sparkles, UserRound, User, Baby, X } from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category: 'clothing' | 'electronics' | 'documents' | 'toiletries' | 'health' | 'misc';
}

type ItemsByProfile = Record<string, ChecklistItem[]>;

interface PackingChecklistProps {
  tripId: string | null;
  onComplete: () => void;
  isOpen: boolean;
  onClose: () => void;
  lang?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelersCount?: number;
  travelerProfiles?: TravelerProfile[];
  packingRequirements?: string;
  onAIAdjust?: (instruction: string) => void;
  theme?: 'light' | 'dark';
}

const CATEGORY_ICONS: Record<string, string> = {
  clothing: '👕',
  electronics: '📱',
  documents: '📄',
  toiletries: '🧴',
  health: '💊',
  misc: '📦',
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  clothing: { en: 'Clothing', cs: 'Oblečení' },
  electronics: { en: 'Electronics', cs: 'Elektronika' },
  documents: { en: 'Documents', cs: 'Dokumenty' },
  toiletries: { en: 'Toiletries', cs: 'Hygiena' },
  health: { en: 'Health', cs: 'Zdraví' },
  misc: { en: 'Other', cs: 'Ostatní' },
};

const GENDER_ICON: Record<string, any> = { male: UserRound, female: User, child: Baby, unspecified: UserRound };
const GENDER_LABEL: Record<string, Record<string, string>> = {
  male: { en: 'Man', cs: 'Muž' },
  female: { en: 'Woman', cs: 'Žena' },
  child: { en: 'Child', cs: 'Dítě' },
  unspecified: { en: 'Traveler', cs: 'Cestovatel' }
};

// ── localStorage helpers ─────────────────────────────────────────────────────
const lsKey = (tripId: string | null, suffix: string) =>
  `packing_${tripId || 'draft'}_${suffix}`;

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function lsSave(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
// ────────────────────────────────────────────────────────────────────────────

export function PackingChecklist({
  tripId,
  onComplete,
  isOpen,
  onClose,
  lang = 'en',
  destination,
  startDate,
  endDate,
  travelersCount = 1,
  travelerProfiles = [],
  packingRequirements,
  theme = 'dark',
}: PackingChecklistProps) {
  // ── Profiles: hydrate from localStorage first, fall back to prop ───────────
  const [localProfiles, setLocalProfiles] = useState<TravelerProfile[]>(() => {
    const saved = lsLoad<TravelerProfile[]>(lsKey(tripId, 'profiles'), []);
    if (saved.length > 0) return saved;
    if (travelerProfiles.length > 0) return travelerProfiles;
    // Auto-create based on travelersCount
    const defaults: TravelerProfile[] = Array.from({ length: travelersCount }).map((_, i) => ({
      id: `t-${Date.now()}-${i}`,
      name: `Traveler ${i + 1}`,
      gender: 'unspecified'
    }));
    return defaults;
  });

  // ── Items per profile: fully loaded from localStorage on mount ─────────────
  const [itemsByProfile, setItemsByProfile] = useState<ItemsByProfile>(() => {
    const saved = lsLoad<TravelerProfile[]>(lsKey(tripId, 'profiles'), []);
    const profiles = saved.length > 0 ? saved : travelerProfiles;
    const byProfile: ItemsByProfile = {};
    for (const p of profiles) {
      byProfile[p.id] = lsLoad<ChecklistItem[]>(lsKey(tripId, `items_${p.id}`), []);
    }
    return byProfile;
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const saved = lsLoad<TravelerProfile[]>(lsKey(tripId, 'profiles'), []);
    if (saved.length > 0) return saved[0].id;
    if (travelerProfiles.length > 0) return travelerProfiles[0].id;
    return `t-${Date.now()}-0`; // The first default we created
  });

  const [newItemText, setNewItemText] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // Track generation status to avoid redundant triggers
  const generatedProfilesKey = lsKey(tripId, 'generated_profiles');
  const [generatedProfiles, setGeneratedProfiles] = useState<Set<string>>(() => {
    return new Set(lsLoad<string[]>(generatedProfilesKey, []));
  });

  const markAsGenerated = useCallback((profileId: string) => {
    setGeneratedProfiles(prev => {
      const next = new Set(prev).add(profileId);
      lsSave(generatedProfilesKey, Array.from(next));
      return next;
    });
  }, [generatedProfilesKey]);

  const t = useCallback((key: string) => TEXTS[key]?.[lang] || key, [lang]);

  // ── Sync incoming travelerProfiles prop (only if localStorage is empty) ────
  useEffect(() => {
    const savedProfiles = lsLoad<TravelerProfile[]>(lsKey(tripId, 'profiles'), []);
    if (savedProfiles.length === 0 && travelerProfiles.length > 0) {
      setLocalProfiles(travelerProfiles);
      setItemsByProfile(prev => {
        const next = { ...prev };
        for (const p of travelerProfiles) {
          if (!(p.id in next)) {
            next[p.id] = lsLoad<ChecklistItem[]>(lsKey(tripId, `items_${p.id}`), []);
          }
        }
        return next;
      });
      if (!selectedProfileId) setSelectedProfileId(travelerProfiles[0]?.id || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── React to AI adding NEW traveler profiles mid-session ───────────────────
  useEffect(() => {
    if (travelerProfiles.length === 0) return;
    setLocalProfiles(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newProfiles = travelerProfiles.filter(p => !existingIds.has(p.id));
      if (newProfiles.length === 0) return prev;
      // Auto-generate for each new profile
      for (const p of newProfiles) {
        if (!generatedProfiles.has(p.id)) {
          markAsGenerated(p.id);
          generateForProfile(p);
        }
      }
      return [...prev, ...newProfiles];
    });
    if (!selectedProfileId && travelerProfiles.length > 0) {
      setSelectedProfileId(travelerProfiles[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelerProfiles]);

  // ── Persist profiles whenever they change ──────────────────────────────────
  useEffect(() => {
    lsSave(lsKey(tripId, 'profiles'), localProfiles);
    // Ensure every profile has an entry in itemsByProfile
    setItemsByProfile(prev => {
      let changed = false;
      const next = { ...prev };
      for (const p of localProfiles) {
        if (!(p.id in next)) {
          next[p.id] = lsLoad<ChecklistItem[]>(lsKey(tripId, `items_${p.id}`), []);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [localProfiles, tripId]);

  // ── Set selectedProfileId when profiles arrive and none is selected ─────────
  useEffect(() => {
    if (!selectedProfileId && localProfiles.length > 0) {
      setSelectedProfileId(localProfiles[0].id);
    }
  }, [localProfiles, selectedProfileId]);

  // ── Auto-generate when modal opens for ALL profiles that have no items ─────
  useEffect(() => {
    if (!isOpen) return;
    for (const profile of localProfiles) {
      const items = itemsByProfile[profile.id] || [];
      if (items.length === 0 && !generatedProfiles.has(profile.id)) {
        markAsGenerated(profile.id);
        generateForProfile(profile);
        break; // generate one at a time, next will trigger when selected
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Auto-generate when switching to a profile with no items ─────────────────
  useEffect(() => {
    if (!isOpen || !selectedProfileId) return;
    const items = itemsByProfile[selectedProfileId] || [];
    if (items.length === 0 && !generatedProfiles.has(selectedProfileId) && !isGenerating) {
      const profile = localProfiles.find(p => p.id === selectedProfileId);
      if (profile) {
        markAsGenerated(selectedProfileId);
        generateForProfile(profile);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedProfileId]);

  // ── Completion ────────────────────────────────────────────────────────────
  const currentItems = itemsByProfile[selectedProfileId] || [];
  const totalItems = currentItems.length;
  const completedItems = currentItems.filter(i => i.checked).length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
  const isComplete = totalItems > 0 && completedItems === totalItems;

  useEffect(() => {
    if (isComplete && isOpen) onComplete();
  }, [isComplete, isOpen, onComplete]);

  // ── Helper to update items for a profile and persist ──────────────────────
  const setProfileItems = useCallback((profileId: string, items: ChecklistItem[]) => {
    setItemsByProfile(prev => ({ ...prev, [profileId]: items }));
    lsSave(lsKey(tripId, `items_${profileId}`), items);
  }, [tripId]);

  // ── AI Generation ─────────────────────────────────────────────────────────
  const generateForProfile = useCallback(async (profile: TravelerProfile) => {
    setIsGenerating(true);
    setGeneratingFor(profile.id);
    let retryCount = 0;

    const execute = async (): Promise<void> => {
      const apiKey = geminiKeyManager.getNextKey();
      if (!apiKey) { setIsGenerating(false); return; }
      try {
        const ai = new GoogleGenAI({ apiKey });
        const genderNote = profile.gender === 'female'
          ? 'This traveler is a woman — include feminine hygiene products, skincare, and women-specific clothing.'
          : profile.gender === 'child'
          ? 'This traveler is a child — include sunscreen, toys/entertainment, snacks, and kid-appropriate clothing.'
          : profile.gender === 'male' 
          ? 'This traveler is a man — include practical male-specific items.'
          : 'This traveler has no specific known gender. Include standard unisex practical clothing and items.';

        const prompt = `Generate a personalized packing list for ONE traveler.
Traveler: ${profile.name || 'Traveler'} (${profile.gender}${profile.age ? `, age ${profile.age}` : ''})
Destination: ${destination || 'International trip'}
Dates: ${startDate || 'Unknown'} to ${endDate || 'Unknown'}
Notes: ${packingRequirements || 'None'}
${genderNote}
Categories: clothing, electronics, documents, toiletries, health, misc
${lang === 'cs' ? 'Generate all item names in Czech.' : 'Generate all item names in English.'}
Return ONLY a JSON array: [{"text":"...","category":"..."}]
Generate 18-25 practical items.`;

        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const jsonMatch = (result.text || '').match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const newItems: ChecklistItem[] = JSON.parse(jsonMatch[0]).map((item: any, i: number) => ({
            id: `ai-${Date.now()}-${i}`,
            text: item.text,
            checked: false,
            category: item.category || 'misc',
          }));
          setProfileItems(profile.id, newItems);
        }
      } catch (err: any) {
        const isRateLimit = err?.message?.includes('429') || err?.status === 429;
        geminiKeyManager.markKeyFailed(apiKey, isRateLimit);
        if (isRateLimit && retryCount < 3) { retryCount++; return await execute(); }
        console.error('Packing gen error:', err);
      } finally {
        setIsGenerating(false);
        setGeneratingFor(null);
      }
    };
    await execute();
  }, [destination, startDate, endDate, lang, packingRequirements, setProfileItems]);

  if (!isOpen) return null;

  // ── Handlers ────────────────────────────────────────────────────────────
  const toggleItem = (id: string) => {
    const updated = currentItems.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
    setProfileItems(selectedProfileId, updated);
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      checked: false,
      category: (activeCategory as any) || 'misc',
    };
    setProfileItems(selectedProfileId, [newItem, ...currentItems]);
    setNewItemText('');
  };

  const removeItem = (id: string) => {
    setProfileItems(selectedProfileId, currentItems.filter(item => item.id !== id));
  };

  const addProfile = () => {
    const newProfile: TravelerProfile = { id: `t-${Date.now()}`, name: '', gender: 'unspecified' };
    setLocalProfiles(prev => [...prev, newProfile]);
    setSelectedProfileId(newProfile.id);
    markAsGenerated(newProfile.id);
    generateForProfile(newProfile);
  };

  const updateProfile = (id: string, updates: Partial<TravelerProfile>) => {
    setLocalProfiles(prev => {
      const next = prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          // If gender changed to something specific, and it's different, maybe regenerate.
          // But to avoid infinite loops, we handle regeneration if gender changed.
          if (updates.gender && updates.gender !== p.gender) {
             setTimeout(() => { generateForProfile(updated); }, 100);
          }
          return updated;
        }
        return p;
      });
      return next;
    });
  };

  const removeProfile = (id: string) => {
    setLocalProfiles(prev => {
      const next = prev.filter(p => p.id !== id);
      if (selectedProfileId === id && next.length > 0) setSelectedProfileId(next[0].id);
      return next;
    });
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setActiveCategory(null);
    // Load items if not yet loaded
    setItemsByProfile(prev => {
      if (prev[id]) return prev;
      return { ...prev, [id]: lsLoad<ChecklistItem[]>(lsKey(tripId, `items_${id}`), []) };
    });
  };

  const categories = ['clothing', 'electronics', 'documents', 'toiletries', 'health', 'misc'];
  const filteredItems = activeCategory ? currentItems.filter(i => i.category === activeCategory) : currentItems;
  const selectedProfile = localProfiles.find(p => p.id === selectedProfileId);

  // ── Theme helpers ────────────────────────────────────────────────────────
  const isDark = theme === 'dark';
  const cls = {
    text: isDark ? 'text-white' : 'text-slate-900',
    subtext: isDark ? 'text-white/30' : 'text-slate-400',
    border: isDark ? 'border-white/5' : 'border-slate-200',
    bg: isDark ? 'bg-white/5' : 'bg-slate-100',
    itemBg: isDark ? 'bg-white/3 border-white/5 hover:bg-white/7' : 'bg-white border-slate-100 hover:border-slate-200',
    itemChecked: isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-200',
    input: isDark ? 'text-white placeholder-white/20' : 'text-slate-800 placeholder-slate-400',
    tabInactive: isDark ? 'bg-white/5 text-white/40 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700',
  };

  return (
    <div
      className={`rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[88vh] border relative ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-200'}`}
      onClick={e => e.stopPropagation()}
    >
      {/* Absolute Close Button (Global) */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 z-[450] p-2 rounded-xl transition-all ${isDark ? 'bg-white/10 text-white/40 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* ══ LEFT PANEL ═══════════════════════════════════════════════════════ */}
      <div className={`p-6 flex flex-col items-center md:w-[40%] shrink-0 overflow-y-auto no-scrollbar
        ${isComplete
          ? (isDark ? 'bg-gradient-to-br from-emerald-950/50 to-teal-950/30' : 'bg-gradient-to-br from-emerald-50 to-teal-100')
          : (isDark ? 'bg-gradient-to-br from-amber-950/40 to-orange-950/20' : 'bg-gradient-to-br from-amber-50 to-orange-50')}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
          <CharacterAvatar
            src={isComplete ? SIDEKICK_ASSETS.packing_success : SIDEKICK_ASSETS.packing_struggle}
            alt="Packing progress"
            size="md"
            animation={isComplete ? 'bounce' : 'float'}
            speechBubble={isComplete ? t('lets_go') : t('so_many_things')}
          />

          {/* Progress bar */}
          <div className="w-full mt-4">
            <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <div
                className={`h-full transition-all duration-700 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className={`mt-1.5 text-center text-[10px] font-black uppercase tracking-widest ${cls.subtext}`}>
              {completedItems}/{totalItems} • {progressPercent}%
            </p>
          </div>

          {/* Travelers */}
          <div className={`w-full mt-4 border-t pt-4 ${cls.border}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${cls.subtext}`}>
                {t('packing_traveler')}
              </h4>
              <button
                onClick={addProfile}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10' : 'bg-slate-100 text-slate-400 hover:text-slate-700'}`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5">
              {localProfiles.map(profile => {
                const GenderIcon = GENDER_ICON[profile.gender] || UserRound;
                const isSelected = profile.id === selectedProfileId;
                const profileItems = itemsByProfile[profile.id] || [];
                const done = profileItems.filter(i => i.checked).length;

                return (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                      isSelected
                        ? (isDark ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300')
                        : (isDark ? 'bg-white/3 border-white/5 hover:bg-white/7' : 'bg-white border-slate-200 hover:border-slate-300')
                    }`}
                    onClick={() => handleSelectProfile(profile.id)}
                  >
                    {/* Gender toggles */}
                    <div className="flex gap-0.5 shrink-0">
                      {(['male', 'female', 'child', 'unspecified'] as const).map(g => {
                        const Icon = GENDER_ICON[g] || UserRound;
                        const active = profile.gender === g;
                        return (
                          <button
                            key={g}
                            title={GENDER_LABEL[g][lang] || g}
                            onClick={ev => { ev.stopPropagation(); updateProfile(profile.id, { gender: g }); }}
                            className={`p-1 rounded-md transition-all ${
                              active
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : (isDark ? 'text-white/25 hover:text-white/70' : 'text-slate-300 hover:text-slate-600')
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>

                    {/* Name */}
                    <input
                      type="text"
                      value={profile.name}
                      onChange={e => updateProfile(profile.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      placeholder={t('name')}
                      className={`flex-1 min-w-0 bg-transparent border-none text-xs outline-none font-bold ${isDark ? 'text-white placeholder-white/20' : 'text-slate-800 placeholder-slate-400'}`}
                    />

                    {/* Count badge */}
                    {profileItems.length > 0 && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                        done === profileItems.length
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : (isDark ? 'bg-white/10 text-white/40' : 'bg-slate-100 text-slate-400')
                      }`}>
                        {done}/{profileItems.length}
                      </span>
                    )}

                    {/* Remove */}
                    <button
                      onClick={ev => { ev.stopPropagation(); removeProfile(profile.id); }}
                      className={`p-1 shrink-0 transition-colors ${isDark ? 'text-white/15 hover:text-red-400' : 'text-slate-200 hover:text-red-500'}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {localProfiles.length === 0 && (
                <p className={`text-[10px] text-center py-3 ${cls.subtext}`}>
                  {t('packing_add_traveler')}
                </p>
              )}
            </div>
          </div>

          {/* Regenerate */}
          {selectedProfile && (
            <button
              onClick={() => generateForProfile(selectedProfile)}
              disabled={isGenerating}
              className="mt-4 w-full py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-40"
            >
              {isGenerating && generatingFor === selectedProfile.id
                ? <><Loader2 className="w-3 h-3 animate-spin" />{t('packing_generating')}</>
                : <><Sparkles className="w-3 h-3" />{t('packing_regenerate')}</>
              }
            </button>
          )}
        </div>

        {/* ══ RIGHT PANEL ══════════════════════════════════════════════════════ */}
        <div className={`flex-1 flex flex-col overflow-hidden min-w-0 ${isDark ? 'bg-zinc-900' : 'bg-slate-50'}`}>
          {/* Header */}
          <div className={`flex justify-between items-start px-5 py-4 border-b shrink-0 ${cls.border}`}>
            <div className="min-w-0 pr-3">
              <h3 className={`text-lg font-black uppercase tracking-tight truncate ${cls.text}`}>
                {selectedProfile?.name || t('packing_list')}
              </h3>
              {selectedProfile && (
                <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${cls.subtext}`}>
                  {GENDER_LABEL[selectedProfile.gender]?.[lang] || selectedProfile.gender}
                  {' • '}
                  {completedItems}/{totalItems} {t('packing_packed')}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={`shrink-0 p-2 rounded-xl transition-colors md:flex hidden ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className={`px-5 pt-3 pb-2 flex gap-1.5 overflow-x-auto border-b shrink-0 no-scrollbar ${cls.border}`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${!activeCategory ? 'bg-emerald-500 text-white' : cls.tabInactive}`}
            >
              {t('packing_all')} ({totalItems})
            </button>
            {categories.map(cat => {
              const count = currentItems.filter(i => i.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-emerald-500 text-white' : cls.tabInactive}`}
                >
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat][lang] || cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Add Item */}
          <form onSubmit={addItem} className={`px-5 py-2.5 border-b shrink-0 ${cls.border}`}>
            <input
              type="text"
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              placeholder={t('packing_add_item')}
              className={`w-full bg-transparent border-none text-sm outline-none px-1 ${cls.input}`}
            />
          </form>

          {/* Items */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 space-y-1 min-h-0">
            {isGenerating && generatingFor === selectedProfileId && filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                <p className={`text-xs font-bold uppercase tracking-widest ${cls.subtext}`}>
                  {t('packing_generating')}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40">
                <p className={`text-xs font-bold uppercase tracking-widest ${cls.subtext}`}>
                  {t('packing_no_items')}
                </p>
              </div>
            ) : filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all group ${
                  item.checked ? cls.itemChecked : cls.itemBg
                }`}
              >
                {/* Check circle */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  item.checked
                    ? 'bg-emerald-500 border-emerald-500'
                    : (isDark ? 'border-white/15 group-hover:border-emerald-400/60' : 'border-slate-300 group-hover:border-emerald-400')
                }`}>
                  {item.checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <span className="text-sm shrink-0">{CATEGORY_ICONS[item.category]}</span>

                <span className={`text-sm font-semibold flex-1 transition-all ${
                  item.checked
                    ? (isDark ? 'line-through text-white/20' : 'line-through text-slate-400')
                    : (isDark ? 'text-white' : 'text-slate-800')
                }`}>
                  {item.text}
                </span>

                <button
                  onClick={e => { e.stopPropagation(); removeItem(item.id); }}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${isDark ? 'text-white/20 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
}

export default PackingChecklist;
