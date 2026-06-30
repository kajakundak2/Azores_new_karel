# Sara Itinerary - AI Agent Overview

Welcome! This document provides a high-level overview of the Sara Itinerary project, designed specifically for AI agents (like Antigravity) to understand the architecture, key files, and conventions without needing to review everything from scratch.

## 🚀 Project Purpose
Sara Itinerary is an AI-powered travel planning application. It allows users to create, modify, and manage travel itineraries. The core feature is "Sára", an intelligent travel assistant available via text chat and live voice interaction (using Gemini APIs). Sára can search for places, generate smart itineraries, modify specific activities, manage logistics (stays, flights), and maintain traveler profiles.

## 🏗️ Architecture & Key Components
The application is a React frontend built with Vite, styled with Tailwind CSS, and uses Firebase (Firestore) for backend state management.

### Key Files & Directories
*   **`src/components/TravelPortal.tsx`**: The main UI entry point and orchestration layer. It bridges the AI logic and the visual UI.
*   **`src/utils/saraTools.ts`**: The **Single Source of Truth** for AI capabilities. It exports `getToolDeclarations()` (defining all the functions the AI can call) and system prompts like `SARA_CAPABILITIES_PROMPT` and `SARA_IDENTITY_PROMPT`.
*   **`src/hooks/useItineraryAI.ts`**: Manages the text-based chat, smart itinerary generation, and tool execution logic for text interactions.
*   **`src/hooks/useLiveGemini.ts`**: Manages the WebSocket-based live voice interaction using the `gemini-3.1-flash-live-preview` model. It handles real-time audio streaming and function calls.
*   **`src/utils/itineraryParser.ts`**: Contains logic for parsing and chunking day-by-day itineraries to prevent API timeouts during large document processing.
*   **`src/utils/geminiKeyManager.ts`**: Manages Gemini API key rotation and error tracking (e.g., handling 403 Forbidden or 429 Too Many Requests errors gracefully).

## 🤖 AI Models & Tool Calling
*   **Voice Interactions**: Uses `gemini-3.1-flash-live-preview` over WebSockets. Function calls must be executed and responded to immediately.
*   **Text Interactions**: Uses `gemini-3.1-flash-lite-preview` or `gemini-flash-lite-latest` for cost-efficient, fast extraction and structured JSON output.
*   **Tool Calling**: The AI has access to a wide array of tools (e.g., `update_itinerary`, `modify_poi`, `searchGooglePlaces`, `add_stay`).
    *   **CRITICAL RULE**: The AI must **proactively** call these tools when the user requests an action (plan, generate, add, remove, modify). It should not merely acknowledge the request in text/voice without executing the corresponding tool.

## 🎨 UI & Design Standards
*   **Theme**: Supports Dark and Light modes. Use the `theme` prop (`dark` | `light`) for component styling. Dark mode background defaults to `bg-zinc-950` or `#09090b`.
*   **Animations**: Uses `motion/react` for smooth transitions.
*   **Localization**: All UI text must be externalized to the `TEXTS` dictionary in `src/data.ts`. The AI should respond in the user's language (English or Czech). Text responses are usually structured as `{"en": "...", "cs": "..."}`.

## 🛠️ Development Workflow & Guidelines
*   **Artifacts**: Keep implementation plans updated if generating new features.
*   **API Usage**: Rely on the provided Gemini configuration setups and `geminiKeyManager`. Do not hardcode new keys directly in components.
*   **State Mutations**: When creating new features that modify the itinerary, ensure a corresponding tool is declared in `saraTools.ts` so the AI can use it.

Check `AI instructions.md` for deeper Gemini API implementation details, and `CONVENTIONS.md` / `WORK_INSTRUCTIONS.md` for further standards.
