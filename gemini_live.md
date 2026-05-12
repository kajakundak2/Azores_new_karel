# Sara — Gemini AI Integration

> **Last updated:** May 12, 2026
> **Status:** ✅ Working in production

---

## Overview

Sara uses **two Gemini models** for different interaction modes:

| Model | Alias | Purpose | Status |
|---|---|---|---|
| `gemini-3.1-flash-lite` | **`gemini-flash-lite-latest`** | Text chat, itinerary parsing, translation, AI updates, packing list | ✅ GA (stable) |
| `gemini-3.1-flash-live-preview` | *(none)* | Real-time voice conversations | ⚠️ Preview (no GA yet) |

### Text/Chat Model — `gemini-flash-lite-latest`

Used across all non-voice AI features. The `gemini-flash-lite-latest` alias automatically resolves to the latest stable Flash Lite version (currently `gemini-3.1-flash-lite`), eliminating the need for manual updates on future releases.

**Used in:**
- `src/utils/itineraryParser.ts` — document parsing & POI extraction (5 calls)
- `src/utils/aiUpdateAgent.ts` — bulk itinerary modifications (2 calls)
- `src/utils/aiTranslator.ts` — bilingual translation EN↔CS (2 calls)
- `src/hooks/useItineraryAI.ts` — smart chat with tool calling (1 call)
- `src/hooks/usePlannerChat.ts` — trip parameter extraction chat (1 call)
- `src/components/characters/PackingChecklist.tsx` — AI packing list generation (1 call)

**Migration history:**
- `gemini-3.1-flash-lite-preview` → `gemini-flash-lite-latest` *(migrated May 12, 2026)*
- The preview model reached GA on May 7, 2026. Using the `-latest` alias ensures auto-upgrades.

### Voice Model — `gemini-3.1-flash-live-preview`

Used for real-time voice conversations via the Gemini Live API (WebSocket-based). Users speak naturally to Sara, who responds with audio and executes trip-modification tools.

**Used in:**
- `src/hooks/useLiveGemini.ts` — Live voice hook (consumed by `TravelPortal.tsx` and `LandingPage.tsx`)

---

## Architecture

### Connection Flow

```
User clicks "Call Sara"
    ↓
AudioContext initialized (16kHz input, interactive latency)
    ↓
AudioWorklet loaded (/pcm-processor.worklet.js)
    ↓
Microphone captured (16kHz, mono, echo cancellation + noise suppression)
    ↓
WebSocket opened to Gemini Live API (v1beta, WSS)
    ↓
Setup message sent (model, tools, system instruction, voice config)
    ↓
setupComplete received → audio streaming begins
    ↓
Bidirectional: mic PCM → Gemini → 24kHz PCM audio response
```

### WebSocket Endpoint

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}
```

Uses the **v1beta** endpoint (required for 3.1 models). API key is provided by the `GeminiKeyManager` (supports rotation of up to 7 keys with 60s cooldown on failures).

---

## What's Currently Working ✅

### Core Voice

| Feature | Status | Details |
|---|---|---|
| **Audio input** | ✅ | 16-bit PCM, 16kHz, mono via AudioWorklet |
| **Audio output** | ✅ | 24kHz PCM playback with scheduled buffering |
| **Voice selection** | ✅ | Using "Aoede" (Breezy) voice |
| **Response modality** | ✅ | Audio only (`responseModalities: ["AUDIO"]`) |
| **Barge-in / Interruption** | ✅ | Model detects user speech → stops current audio playback |
| **VAD** | ✅ | Using Gemini's built-in automatic voice activity detection |

### Session Management

| Feature | Status | Details |
|---|---|---|
| **Session resumption** | ✅ | Stores `sessionHandle`, replays unconsumed messages on reconnect |
| **GoAway handling** | ✅ | Listens for `go_away` → proactive reconnect (code 4000) |
| **Auto-reconnect** | ✅ | Up to 3 retries with 2s delay (proactive reconnects don't count) |
| **Message buffering** | ✅ | Indexed message buffer with pruning via `lastConsumedClientMessageIndex` |
| **API key rotation** | ✅ | Automatic failover across 7 keys with cooldown on 429/503 errors |

### Tool Calling

| Feature | Status | Details |
|---|---|---|
| **Function calling** | ✅ | Full tool execution with response sent back to model |
| **Unified tool router** | ✅ | All tools routed through single `onToolCall` callback |
| **Tool declarations** | ✅ | Shared from `saraTools.ts` (same as chat) |

**All 20+ tools work during voice sessions**, including:
- `searchGooglePlaces` — search real places with photos/ratings
- `trigger_smart_itinerary_generation` — generate full itinerary
- `update_itinerary` — bulk/complex modifications
- `modify_poi`, `move_poi`, `reorder_day` — atomic edits
- `add_stay`, `modify_stay`, `remove_stay` — accommodation management
- `add_flight`, `remove_flight` — flight records
- `update_trip_details` — change destination, dates, travelers
- `set_traveler_profiles` — individual traveler info
- `clear_day`, `clear_itinerary` — reset operations
- `add_to_library`, `remove_from_library` — saved places
- `set_day_theme` — day theming
- `set_packing_requirements` — packing list
- `add_day`, `remove_day` — trip structure

### Audio Processing

| Feature | Status | Details |
|---|---|---|
| **AudioWorklet** | ✅ | Custom `pcm-processor.worklet.js` for low-latency capture |
| **Local volume metering** | ✅ | RMS calculation from mic input, throttled to 100ms updates |
| **Remote volume metering** | ✅ | AnalyserNode on playback chain for Sara's voice visualization |
| **Echo cancellation** | ✅ | Browser-native via `getUserMedia` constraints |
| **Noise suppression** | ✅ | Browser-native via `getUserMedia` constraints |
| **Auto gain control** | ✅ | Browser-native via `getUserMedia` constraints |

### Transcription

| Feature | Status | Details |
|---|---|---|
| **Input transcription** | ✅ | User speech → text displayed in chat UI (with `isFinal` flag) |
| **Output transcription** | ✅ | Sara's speech → text displayed in chat UI |

### UI Integration

| Feature | Status | Details |
|---|---|---|
| **Status callbacks** | ✅ | `idle` → `connecting` → `connected` → `error` with messages |
| **Tool status display** | ✅ | Shows "Processing {toolName}..." during execution |
| **Interrupt callback** | ✅ | Notifies UI when barge-in occurs |
| **Graceful cleanup** | ✅ | Stops tracks, closes context, clears buffers on unmount/stop |

---

## What's NOT Implemented Yet ❌

| Feature | Status | Notes |
|---|---|---|
| **Context window compression** | ❌ | Could extend sessions beyond 15min. Would need `contextWindowCompression` in setup. |
| **Mid-session system instruction update** | ❌ | 3.1 Flash Live does NOT support `clientContent` with `role: "system"`. SI is set once in setup; new SI applies on next reconnect. |
| **Affective dialog** | ❌ | Not yet supported in gemini-3.1-flash-live-preview |
| **Proactive audio** | ❌ | Not yet supported in gemini-3.1-flash-live-preview |
| **Video/camera input** | ❌ | API supports it; not needed for trip planning |
| **Custom VAD** | ❌ | Using Gemini's built-in VAD; no need for manual ActivityStart/End |
| **Language code config** | ❌ | Not setting `language_code` in `speechConfig`; Sara auto-detects from system instruction context |
| **Transparent session resumption** | ❌ | Using basic resumption (handle-based). Transparent mode (`transparent: true`) would return explicit `lastConsumedClientMessageIndex` for tighter replay. |

---

## Setup Message Structure

The setup message sent on WebSocket open (camelCase required for raw WebSocket protocol):

```json
{
  "setup": {
    "model": "models/gemini-3.1-flash-live-preview",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Aoede"
          }
        }
      }
    },
    "systemInstruction": {
      "parts": [{
        "text": "You are \"Sara,\" the intelligent travel assistant..."
      }]
    },
    "tools": [{
      "functionDeclarations": [
        // ... 20+ tool declarations from saraTools.ts
      ]
    }]
  }
}
```

When resuming a session, `sessionResumption.handle` is added to the setup.

---

## Audio Format Specs

| Direction | Format | Sample Rate | Bit Depth | Channels |
|---|---|---|---|---|
| **Input** (mic → Gemini) | Raw PCM, base64-encoded | 16,000 Hz | 16-bit signed LE | Mono |
| **Output** (Gemini → speakers) | Raw PCM, base64-encoded | 24,000 Hz | 16-bit signed LE | Mono |

### Playback Scheduling

Audio chunks are scheduled using `AudioBufferSourceNode.start(time)` with a lookahead buffer:
- Chunks are queued with `nextStartTime` tracking
- 10ms padding on initial chunk to prevent clicks
- Active sources tracked for interruption (barge-in stops all queued audio)

---

## Error Handling & Reconnection

### WebSocket Close Codes

| Code | Meaning | Action |
|---|---|---|
| `1000` | Normal close | Stop, clear session state |
| `1008` | Policy violation / bad key | Fatal stop, clear session |
| `4000` | Proactive reconnect (GoAway) | Immediate reconnect (100ms), no counter increment |
| `4001` | Fatal application error | Fatal stop |
| Other | Unexpected disconnect | Retry with 2s delay, up to 3 attempts |

### API Key Management

- 7 rotating API keys via `GeminiKeyManager`
- 60s cooldown per key on rate limit (429)
- 5min global cooldown on service outage (503)
- On WebSocket error → current key marked as failed, auto-rotates to next

---

## Model Details

### gemini-flash-lite-latest (Text/Chat)

| Property | Value |
|---|---|
| **Alias** | `gemini-flash-lite-latest` |
| **Resolves to** | `gemini-3.1-flash-lite` (as of May 2026) |
| **Status** | ✅ Generally Available (GA since May 7, 2026) |
| **Input** | Text, images |
| **Output** | Text |
| **Strengths** | Fast, low-cost, optimized for structured extraction (JSON) |
| **Function calling** | ✅ Supported |
| **Structured output (JSON)** | ✅ Supported (`responseMimeType: "application/json"`) |
| **Thinking** | ✅ Supported |
| **Knowledge cutoff** | January 2025 |

**Why the `-latest` alias?** It auto-resolves to the newest stable Flash Lite version. When Google ships 3.2 or 4.0, no code changes are needed — the alias will point to the new version automatically.

### gemini-3.1-flash-live-preview (Voice)

| Property | Value |
|---|---|
| **Model code** | `gemini-3.1-flash-live-preview` |
| **Status** | ⚠️ Preview (no GA replacement as of May 2026) |
| **Input** | Text, images, audio, video |
| **Output** | Text and audio |
| **Input token limit** | 131,072 |
| **Output token limit** | 65,536 |
| **Function calling** | ✅ Supported (synchronous only) |
| **Thinking** | ✅ Supported (default: minimal for lowest latency) |
| **Async function calling** | ❌ Not supported |
| **Affective dialog** | ❌ Not yet supported |
| **Proactive audio** | ❌ Not yet supported |
| **Knowledge cutoff** | January 2025 |
| **Latest update** | March 2026 |

### Key Differences from Gemini 2.5 Flash Live

When Sara migrated from `gemini-2.5-flash-native-audio-preview-12-2025`:
- **Thinking:** Uses `thinkingLevel` (minimal/low/medium/high) instead of `thinkingBudget`
- **Server events:** Single event can contain multiple parts (audio + transcript). Code processes all parts.
- **Client content:** `send_client_content` only for initial context seeding. Use `send_realtime_input` for live updates.
- **Turn coverage:** Defaults to `TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO`
- **No proactive audio or affective dialog** in 3.1 yet

---

## Available Voices (30 options)

Sara currently uses **Aoede** (Breezy). Other options:

| Voice | Style | | Voice | Style |
|---|---|---|---|---|
| Zephyr | Bright | | Puck | Upbeat |
| Kore | Firm | | Fenrir | Excitable |
| Orus | Firm | | Aoede ★ | Breezy |
| Autonoe | Bright | | Enceladus | Breathy |
| Umbriel | Easy-going | | Algieba | Smooth |
| Erinome | Clear | | Algenib | Gravelly |
| Laomedeia | Upbeat | | Achernar | Soft |
| Schedar | Even | | Gacrux | Mature |
| Achird | Friendly | | Zubenelgenubi | Casual |
| Sadachbia | Lively | | Sadaltager | Knowledgeable |
| Charon | Informative | | Leda | Youthful |
| Callirrhoe | Easy-going | | Iapetus | Clear |
| Despina | Smooth | | Rasalgethi | Informative |
| Alnilam | Firm | | Pulcherrima | Forward |
| Vindemiatrix | Gentle | | Sulafat | Warm |

---

## Supported Languages (24)

| Language | BCP-47 | | Language | BCP-47 |
|---|---|---|---|---|
| Arabic (Egyptian) | ar-EG | | Korean | ko-KR |
| Bengali (Bangladesh) | bn-BD | | Marathi | mr-IN |
| Dutch | nl-NL | | Polish | pl-PL |
| English (India) | en-IN | | Portuguese (Brazil) | pt-BR |
| English (US) | en-US | | Romanian | ro-RO |
| French | fr-FR | | Russian | ru-RU |
| German | de-DE | | Spanish (US) | es-US |
| Hindi | hi-IN | | Tamil | ta-IN |
| Indonesian | id-ID | | Telugu | te-IN |
| Italian | it-IT | | Thai | th-TH |
| Japanese | ja-JP | | Turkish | tr-TR |
| Ukrainian | uk-UA | | Vietnamese | vi-VN |

> **Note:** Sara doesn't explicitly set `language_code`. She detects language from the user's speech and system instruction context. Czech is not in the official supported list but works reasonably well through the system instruction approach.

---

## Session Limits

| Limit | Value | Notes |
|---|---|---|
| **Audio-only session** | 15 minutes | Without context compression |
| **Audio+video session** | 2 minutes | Not used by Sara |
| **Connection lifetime** | ~10 minutes | GoAway sent 60s before; Sara reconnects automatically |
| **Max concurrent sessions** | 1,000/project | Pay-as-you-go plan |
| **Session resumption window** | ~10 minutes | After disconnect, can reconnect with handle |
| **Session resume validity** | 24 hours | Handle can be used to resume within this window |

---

## Future Improvements

1. **Context Window Compression** — Enable `contextWindowCompression` with `triggerTokens: 100000` and `slidingWindow: { targetTokens: 4000 }` to allow unlimited session duration. Currently sessions are capped at ~15min.

2. **Transparent Session Resumption** — Switch to `transparent: true` mode for explicit `lastConsumedClientMessageIndex` tracking. Currently using basic handle-based resumption.

3. **Language Code Configuration** — Set `language_code` in `speechConfig` for better Czech/English accuracy. Currently relying on auto-detection.

4. **Affective Dialog** — Enable once supported in gemini-3.1-flash-live to allow Sara to respond to emotional tone.

5. **GA Live Model Migration** — When `gemini-3.1-flash-live` (without `-preview`) is released, update the model string in the setup message. Consider switching to a `gemini-flash-live-latest` alias if Google introduces one, matching the pattern already used for the text model.