# Character Asset Inventory & Usage Map

This document tracks all **36 character image assets** for **Sara**, **Kaja**, and **Pedro**, and maps them to application states.

> [!NOTE]
> For implementation details on how to use these in the code, see the [Animated Characters Guide](../../../../Users/kajko/.gemini/antigravity/brain/a832ab66-0e33-4c3a-8515-82f988d9a745/animated_characters_guide.md).

---

## 👱‍♀️ Sara (The AI Assistant) — 20 assets

Sara has two visual modes: **Standalone (Full Body)** and **At Desk (Professional)**.

### Standalone Poses (no desk, full-body, ~100KB each)

| # | Pose / State | Asset Name | Description |
|---|:---|:---|:---|
| 1 | Confident Idle | `Sara.png` | Hands on hips, big smile. The original character reference. |
| 2 | Neutral Idle | `sara_idle.png` | Standing relaxed, slight smile, arms down. |
| 3 | Bored / Yawning | `sara_bored.png` | Hand on cheek, mouth wide open yawning, eyes closed. |
| 4 | Excited / Jumping | `sara_excited.png` | Both arms raised, jumping in the air, huge grin. |
| 5 | Listening (standalone) | `sara_listening.png` | Hand cupping ear, curious expression, standing. |
| 6 | Talking (phone, standing) | `sara_talking.png` | Hand to ear with phone, mouth open, happy. |
| 7 | Talking (variant) | `sara_talking (1).png` | Similar to talking, slightly different framing. |
| 8 | Thinking | `sara_thinking.png` | Finger on chin, looking up, contemplating. |
| 9 | Typing (laptop, sitting) | `sara_typing.png` | Sitting on floor with laptop, typing, smiling. |
| 10 | Waving | `sara_waving.png` | One hand raised waving, other on hip, friendly. |
| 11 | Reading | `sara_reading.png` | Sitting at desk, focused on laptop, working. |

### At-Desk Poses (with desk, chair, laptop, coffee — ~170KB each)

| # | Pose / State | Asset Name | Description |
|---|:---|:---|:---|
| 12 | Desk Waving (Default) | `sara_desk_waving.png` | At desk, waving at user, big smile. Phone & laptop on desk. |
| 13 | Desk Bored | `sara_bored_awaiting_call.png` | At desk, chin on hand, bored/sad expression. Waiting for user. |
| 14 | Desk Thinking | `sara_desk_thinking.png` | At desk, hand on chin, furrowed brow, deep thought. |
| 15 | Desk Typing | `sara_desk_typing.png` | At desk, both hands on laptop, focused, working. |
| 16 | Desk Listening (Phone) | `sara_desk_listening.png` | At desk, phone to ear, serious/focused expression. |
| 17 | Desk Excited (Phone) | `sara_desk_listening_excited.png` | At desk, phone to ear, mouth open, happy/excited. |
| 18 | Phone Ringing (Pre-Call) | `sara_phone_ringing.png` | At desk, finger on lip, looking at ringing phone on desk. |

### Lip-Sync Frames (at desk, phone to ear — for voice-volume cycling)

| # | Pose / State | Asset Name | Description |
|---|:---|:---|:---|
| 19 | Mouth Closed | `sara_talking_mouth_closed.png` | At desk, phone to ear, mouth closed, hand gesturing. |
| 20 | Mouth Slightly Open | `sara_talking_mouth_slightly_open.png` | At desk, phone to ear, mouth halfway open, hand gesturing. |
| 21 | Mouth Open | `sara_talking_mouth_open.png` | At desk, phone to ear, mouth wide open, hand gesturing. |

> [!TIP]
> The 3 lip-sync frames have identical body position and only differ in mouth openness, making them perfect for rapid cycling based on `voiceVolume`.

---

## 🧔 Kaja (The Adventurous Sidekick) — 4 solo assets

Kaja: blonde/ginger beard, sunglasses, green/teal Hawaiian shirt with yellow flowers, blue shorts, sandals with socks.

| # | Pose / State | Asset Name | Description |
|---|:---|:---|:---|
| 1 | Idle | `Kaja.png` | Standing, hands on hips, confident smile. |
| 2 | Waving | `kaja_waiving.png` | Right hand waving, friendly smile. |
| 3 | Surfing | `kaja_surfing.png` | On surfboard riding a wave, wet splash effects. |
| 4 | Skiing | `kaja_skiing.png` | Full ski gear (helmet, teal floral ski suit), skiing downhill. |

---

## 🏄 Pedro (The Pragmatic Sidekick) — 5 solo assets

Pedro: stocky build, dark hair, tan straw hat, blue/orange Hawaiian shirt, blue shorts, sandals with socks.

| # | Pose / State | Asset Name | Description |
|---|:---|:---|:---|
| 1 | Idle | `Pedro.png` | Standing, hands on hips, chin up. |
| 2 | Waving | `pedro_waving.png` | Right hand waving, friendly smile. |
| 3 | Map Reading | `pedro_map.png` | Holding map, scratching head, confused look. Road sign behind. |
| 4 | Suitcase (struggling) | `pedro_suitcase.png` | Frown, hands on hips, overflowing suitcase behind him. |
| 5 | Suitcase (packed) | `pedro_suitcase_packed.png` | Thumbs up, big smile, neatly packed suitcase beside him. |
| 6 | Diving | `pedro_diving.png` | Full scuba suit + tank, goggles, flippers. Coral at feet. |

---

## 🤝 Joint Scenes (Kaja & Pedro together) — 5 assets

| # | Scene | Asset Name | Description |
|---|:---|:---|:---|
| 1 | Lost with Map | `kaja_pedro_lost.png` | Both looking confused at map with "Dead End" and "You Are Here... Probably" text. |
| 2 | Found the Way | `kaja_pedro_found.png` | Both triumphant, map shows "VICTORY!" and "Clear Path", fist pump. |
| 3 | Packing (struggling) | `kaja_pedro_packing_unsuccessful.png` | Kaja standing ON the suitcase, Pedro stuffing clothes, mess everywhere. |
| 4 | Packing (success) | `kaja_pedro_packing_successful.png` | Both laughing, suitcase closed (mostly), thumbs up. |
| 5 | Jeep Ride | `Pedro_karel_jeep.png` | Kaja driving green Jeep, Pedro worried passenger. Adventure vibes. |

---

## 🛠 State → Asset Mapping (Code Reference)

### Sara State Machine
```
Page Load          → sara_desk_waving.png           (idle animation)
Idle > 15 seconds  → sara_bored_awaiting_call.png   (float animation)
Chat Query Sent    → sara_desk_thinking.png          (idle animation)
Chat Streaming     → sara_desk_typing.png            (idle animation)
Call Connecting     → sara_phone_ringing.png          (shake animation)
Call Connected      → sara_desk_listening_excited.png (bounce, then lip-sync)
Voice Active:
  voiceVolume > 0.3 → sara_talking_mouth_open.png
  voiceVolume > 0.1 → sara_talking_mouth_slightly_open.png
  voiceVolume ≤ 0.1 → sara_talking_mouth_closed.png
User Speaking       → sara_desk_listening.png         (idle animation)
```

### Sidekick Ambient Rotation
```
Default (no trip)   → kaja_pedro_lost.png
Trip Created        → kaja_pedro_found.png
Random Ambient Pool:
  - kaja_waiving.png, kaja_surfing.png, kaja_skiing.png
  - pedro_waving.png, pedro_map.png, pedro_diving.png
  - Pedro_karel_jeep.png
  - pedro_suitcase.png → pedro_suitcase_packed.png
```

### Packing Checklist Feature
```
Before completion → kaja_pedro_packing_unsuccessful.png
After completion  → kaja_pedro_packing_successful.png
```

---

## 📊 File Statistics

| Category | Count | Avg Size |
|:---|:---:|:---:|
| Sara Standalone | 11 | ~100 KB |
| Sara At-Desk | 7 | ~175 KB |
| Sara Lip-Sync | 3 | ~172 KB |
| Kaja Solo | 4 | ~152 KB |
| Pedro Solo | 6 | ~152 KB |
| Joint Scenes | 5 | ~148 KB |
| **Total** | **36** | **~143 KB** |
| **Total Size** | | **~5.1 MB** |

> [!NOTE]
> Total asset payload is ~5.1 MB. With lazy loading and modern image compression, initial pageload impact will be minimal (only the active Sara desk pose loads immediately).
