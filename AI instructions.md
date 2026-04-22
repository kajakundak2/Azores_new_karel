 Google Gemini 3 / 3.1 Model Documentation & Implementation Guide
This document contains strictly the latest specifications and implementation patterns for the Gemini 3 and 3.1 family models based on official documentation.
1. Model Capability & Limit Matrix
Feature	gemini-3.1-flash-live-preview	gemini-3-flash-preview	gemini-3.1-flash-lite-preview
Primary Use	Real-time voice/multimodal	Complex logic, high context	Cost-efficient, fast extraction
Input Tokens	131,072	1,048,576	1,048,576
Output Tokens	65,536	65,536	65,536
Input Types	Text, Image, Audio, Video	Text, Image, Video, Audio, PDF	Text, Image, Video, Audio, PDF
Output Types	Text, Audio	Text	Text
Live API (WS)	YES	NO	NO
Structured JSON	NO	YES	YES
Thinking	thinkingLevel (minimal-high)	thinkingBudget	thinkingBudget
Google Maps	NO	YES	YES
Search Grounding	YES	YES	YES
Computer Use	NO	YES	NO
2. Implementation: Node.js (Backend)
Use the @google/genai SDK for standard generations and configuration provisioning.
Structured Output & Itinerary Logic (gemini-3-flash-preview)
Use this model for complex planning where a specific JSON schema is required.
code
JavaScript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Example: Generating structured itinerary data
async function generateItinerary(userPrompt) {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          activities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                location: { type: "STRING" },
                duration: { type: "NUMBER" }
              }
            }
          }
        }
      }
    },
    // Grounding with Google Search
    tools: [{ googleSearch: {} }] 
  });
  return JSON.parse(result.response.text());
}
3. Implementation: React (Frontend / Live API)
The gemini-3.1-flash-live-preview model requires a WebSocket connection for real-time multimodal interaction.
WebSocket Connection Pattern
Endpoint: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
Setup Message Structure
You must send this as the first message after the connection opens.
code
JavaScript
const setupMessage = {
  setup: {
    model: "models/gemini-3.1-flash-live-preview",
    generationConfig: {
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
      }
    },
    // NEW: Use thinkingLevel for 3.1 Flash Live (NOT thinkingBudget)
    thinkingConfig: {
      thinkingLevel: "minimal" // Options: minimal, low, medium, high
    },
    tools: [
      {
        functionDeclarations: [
          {
            name: "update_itinerary",
            description: "Modifies the trip schedule",
            parameters: {
              type: "OBJECT",
              properties: {
                day: { type: "NUMBER" },
                activity: { type: "STRING" }
              }
            }
          }
        ]
      }
    ]
  }
};
Audio Data Handling
Input: Must be 16-bit, Little Endian PCM at 16kHz. Sent as Base64 in realtimeInput.
Output: Received as Base64 PCM in serverContent.
code
JavaScript
// Sending audio chunk
ws.send(JSON.stringify({
  realtimeInput: {
    mediaChunks: [{
      mimeType: "audio/pcm;rate=16000",
      data: base64AudioChunk
    }]
  }
}));

// Handling Server Response (Audio + Function Calls)
ws.onmessage = async (event) => {
  const data = JSON.parse(await event.data.text());
  
  // Audio part
  if (data.serverContent?.modelTurn?.parts) {
    const audioPart = data.serverContent.modelTurn.parts.find(p => p.inlineData);
    if (audioPart) playAudio(audioPart.inlineData.data);
    
    // Function Call part
    const call = data.serverContent.modelTurn.parts.find(p => p.functionCall);
    if (call) {
      const result = executeLocalFunction(call.functionCall);
      // Respond back to model
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{
            parts: [{
              functionResponse: { id: call.functionCall.id, name: call.functionCall.name, response: result }
            }]
          }],
          turnComplete: true
        }
      }));
    }
  }
};
4. Critical Constraints & Usage Notes
3.1 Flash Live Function Calling: Does NOT support asynchronous function calls. Execution must be handled immediately and the response sent back to maintain the voice turn.
Flash-Lite Specialization: Use gemini-3.1-flash-lite-preview specifically for high-volume text/image/PDF extraction. It supports JSON schemas and search but lacks "Computer Use".
Video Processing (Live): The model assesses all frames. To save costs, only stream video frames from the React client when voice activity is detected.
Audio Generation: Only gemini-3.1-flash-live-preview supports native audio generation. Other models output text only.