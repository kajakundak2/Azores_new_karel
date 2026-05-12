const WebSocket = require('ws');
const apiKey = "AIzaSyCJgjdErXp_neEoyRZXc4VLUrlP7uZ9sN4";

const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('WS OPEN');
  ws.send(JSON.stringify({
    setup: {
      model: "models/gemini-2.0-flash-exp",
      generation_config: {
        response_modalities: ["AUDIO", "TEXT"],
        speech_config: {
          voice_config: { 
            prebuilt_voice_config: { voice_name: "Aoede" } 
          },
          language_code: "en-US"
        }
      }
    }
  }));
});

ws.on('message', data => console.log('MSG', data.toString()));
ws.on('close', (code, reason) => console.log('CLOSE', code, reason.toString()));
ws.on('error', err => console.error('ERR', err));
