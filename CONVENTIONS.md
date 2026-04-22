# SarAItinerary — Development Conventions

All features in this project must follow these rules. They apply to every new component, hook, utility, and modification.

---

## 1. Language / Internationalization (i18n)

- **Every user-facing string** must support both **English (`en`)** and **Czech (`cs`)**.
- Use the `TEXTS` dictionary in `src/data.ts` for all static UI text.
  ```ts
  // In data.ts
  export const TEXTS = {
    my_label: { en: 'My Label', cs: 'Můj popisek' },
  };
  ```
- Reference translations via the `t(key)` helper:
  ```tsx
  const t = (key: string) => TEXTS[key]?.[lang] || key;
  ```
- Dynamic content from the AI or user input does not need translation but should be passed through unchanged.
- The language toggle (`lang` state: `'en' | 'cs'`) must be respected everywhere. Components receive `lang` as a prop.
- When Sara (AI) detects the user's language, she responds in that language. The system instruction includes multilingual directives.

---

## 2. Theme (Light / Dark Mode)

- Every component must accept a `theme: 'dark' | 'light'` prop (or read it from context).
- Use conditional Tailwind classes:
  ```tsx
  className={`${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
  ```
- **Do NOT rely on Tailwind's `dark:` prefix** as the sole mechanism — the `theme` prop is the source of truth.
- The theme toggle must immediately affect all visible components.
- **Exception**: The Packing List modal is always rendered in dark mode regardless of the global theme.

---

## 3. Currency

- The app supports three currencies: `EUR`, `CZK`, `USD`.
- Exchange rates are fetched on app load from `api.frankfurter.app` and stored in `rates: Record<string, number>`.
- Any displayed price must be converted using the active `currency` and `rates`:
  ```ts
  const convert = (euroAmount: number) => (euroAmount * rates[currency]).toFixed(2);
  ```
- The currency switcher in the TopBar must affect all price displays across the app.

---

## 4. Sara AI Integration

- **Every feature that can be done manually by the user must also be doable by Sara** through AI function declarations.
- When adding a new manual feature (e.g., "Add Stay", "Update Dates"), you must:
  1. Add a corresponding `functionDeclaration` in both `useLiveGemini.ts` (voice) and `handleSendMessage` in `App.tsx` (text chat).
  2. Add a callback prop (e.g., `onAddStay`) to the hook and wire it in the parent.
  3. Update Sara's system instruction to mention the new capability.
- Sara's conversation history is persisted per trip in Firestore (`trips/{tripId}/chatHistory`).
- The system instruction always includes the current itinerary state, trip details, and a summary of past conversations.

---

## 5. Component Structure

- All components live in `src/components/`.
- Hooks live in `src/hooks/`.
- Utilities live in `src/utils/`.
- Character-related components (Sara, sidekicks, packing list) live in `src/components/characters/`.
- Data types and constants live in `src/data.ts`.

---

## 6. Styling

- **Framework**: Tailwind CSS (via utility classes).
- **Color Palette**:
  - Primary: `emerald-500` (buttons, accents, active states)
  - Background dark: `#0B0F1A` / `slate-950`
  - Background light: `white` / `slate-50`
  - Danger: `red-500` / `rose-500`
  - Info: `blue-500`
  - Warning: `amber-500`
- **Border Radius**: Use `rounded-2xl` or `rounded-3xl` for cards, `rounded-xl` for buttons/inputs.
- **Typography**: Use `font-black uppercase tracking-widest` for labels, `text-xs` / `text-sm` for body.
- **Animations**: Use `motion/react` (Framer Motion) for enter/exit animations. Use Tailwind `animate-*` for simple loops.

---

## 7. Firebase / Firestore

- All trip data is stored in Firestore collection `trips`.
- Chat history stored in subcollection `trips/{tripId}/chatHistory`.
- Packing list state stored in `localStorage` keyed by `packing_{tripId}`.
- Use `sanitizeForFirestore()` before writing any object to remove `undefined` values.
- Never store `undefined` — use `null` or omit the field.

---

## 8. Asset Paths

- Character images: `/pictures/Guides/`
- Slideshow backgrounds: `/pictures/`
- All image paths are defined as constants in `src/hooks/useCharacterState.ts` (`SARA_ASSETS`, `SIDEKICK_ASSETS`).

---

## 9. Testing

- No automated test suite exists yet.
- Verify all changes manually in the browser (`npm run dev`).
- When adding a feature, test:
  1. Light mode + English
  2. Dark mode + Czech
  3. Currency switch (EUR → CZK → USD)
  4. AI can trigger the feature via chat and voice
  5. Mobile responsive layout
