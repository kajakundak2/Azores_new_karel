# Work Instructions & Model Standards

## 🤖 Preferred Model
**Model Name:** `gemini-3.1-flash-lite-preview`
**Rationale:** This model provides the best balance of speed, rate limit headers, and multimodal performance for the platform's itinerary parsing and voice interaction features. Avoid using older models (Pro/Flash standard) unless specifically required for high-reasoning tasks.

## 🎨 UI & Design Standards
*   **Dark Mode Background:** Use `bg-zinc-950` (Tailwind) or `#09090b` (for inline styles/overrides like Google Maps InfoWindows).
*   **Theme Consistency:** Always use the `theme` prop (`dark` | `light`) for component styling. Avoid hardcoding dark-mode-only styles.
*   **Visual Polish:** Use `motion/react` for smooth transitions and subtle micro-animations.

## 🏗️ Architecture Patterns
*   **Day-by-Day Chunking:** For large document parsing or itinerary generation, use the recursive chunking strategy found in `src/utils/itineraryParser.ts`. This prevents API timeouts and ensures exhaustive detail extraction.
*   **API Key Rotation:** Use the `geminiKeyManager.ts` utility to ensure high availability and prevent 429 errors.
*   **Language Support:** All UI text must be externalized to the `TEXTS` dictionary in `src/data.ts`. Components should accept a `lang` prop (`en` | `cs`).

## 🛠️ Development Workflow
*   **Artifacts:** Keep the `implementation_plan.md` updated as the source of truth for project milestones.
*   **Cleanup:** Remove temporary test scripts or parsed output text files before concluding a phase.
