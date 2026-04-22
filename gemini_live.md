Gemini Live API overview




Caution: gemini-live-2.5-flash-preview-native-audio-09-2025 will be deprecated and removed on March 19, 2026. Migrate any workflows to gemini-live-2.5-flash-native-audio.


Gemini Live API enables low-latency, real-time voice and video interactions with Gemini. It processes continuous streams of audio, video, or text to deliver immediate, human-like spoken responses. This creates a natural conversational experience for your users.

Try Gemini Live API in Vertex AI Studio

Example use cases
Gemini Live API can be used to build real-time voice and video agents for a variety of industries, including:

E-commerce and retail: Shopping assistants that offer personalized recommendations and support agents that resolve customer issues.
Gaming: Interactive non-player characters (NPCs), in-game help assistants, and real-time translation of in-game content.
Next-gen interfaces: Voice- and video-enabled experiences in robotics, smart glasses, and vehicles.
Healthcare: Health companions for patient support and education.
Financial services: AI advisors for wealth management and investment guidance.
Education: AI mentors and learner companions that provide personalized instruction and feedback.
Key features
Gemini Live API offers a comprehensive set of features for building robust voice and video agents:

High audio quality: Gemini Live API provides natural, realistic-sounding speech across multiple languages.
Multilingual support: Converse in 24 supported languages.
Barge-in: Users can interrupt the model at any time for responsive interactions.
Affective dialog: Adapts response style and tone to match the user's input expression.
Tool use: Integrates tools like function calling and Google Search for dynamic interactions.
Audio transcriptions: Provides text transcripts of both user input and model output.
Proactive audio: (Preview) Lets you control when the model responds and in what contexts.
Technical specifications
The following table outlines the technical specifications for the Gemini Live API:

Category	Details
Input modalities	Audio (raw 16-bit PCM audio, 16kHz, little-endian), images/video (JPEG 1FPS), text
Output modalities	Audio (raw 16-bit PCM audio, 24kHz, little-endian), text
Protocol	Stateful WebSocket connection (WSS)
Supported models
The following models support Gemini Live API. Select the appropriate model based on your interaction requirements.

Model ID	Availability	Use case	Key features
gemini-live-2.5-flash-native-audio	Generally available	Recommended. Low-latency voice agents. Supports seamless multilingual switching and emotional tone.	
Native audio
Audio transcriptions
Voice activity detection
Affective dialog
Proactive audio
Tool use
gemini-live-2.5-flash-preview-native-audio-09-2025	Public preview	Cost-efficiency in real-time voice agents.	
Native audio
Audio transcriptions
Voice activity detection
Affective dialog
Proactive audio
Tool use
Get started
Select the guide that matches your development environment:

Recommended for ease of use
Gen AI SDK tutorial
Connect to the Gemini Live API using the Gen AI SDK to build a real-time multimodal application with a Python backend.

Raw protocol control
WebSocket tutorial
Connect to the Gemini Live API using WebSockets to build a real-time multimodal application with a JavaScript frontend and a Python backend.

Agent development kit
ADK tutorial
Create an agent and use the Agent Development Kit (ADK) Streaming to enable voice and video communication.

Partner integrations
If you want to integrate with some of our partners, these platforms have already integrated Gemini Live API over the WebRTC protocol to streamline the development of real-time audio and video applications.

Daily
LiveKit
Twilio
Voximplant


Best practices with Gemini Live API



To see examples of using Gemini Live API Native Audio, run the following notebooks in the environment of your choice:

"Getting Started with Gemini Live API Native Audio":

Open in Colab | Open in Colab Enterprise | Open in Vertex AI Workbench | View on GitHub

"Getting Started with Gemini Live API Native Audio using WebSockets":

Open in Colab | Open in Colab Enterprise | Open in Vertex AI Workbench | View on GitHub

To get better results from Gemini Live API, focus on the following best practices:

Design clear system instructions
Define tools precisely
Craft effective prompts
Design clear system instructions
To get the best performance out of Gemini Live API, we recommend having a clearly-defined set of system instructions (SIs) that defines the agent persona, conversational rules, and guardrails, in this order.

For best results, separate each agent into a distinct SI.

Specify the agent persona: Provide detail on the agent's name, role, and any preferred characteristics. If you want to specify the accent, be sure to also specify the preferred output language (such as a British accent for an English speaker).

Specify the conversational rules: Put these rules in the order you expect the model to follow. Delineate between one-time elements of the conversation and conversational loops. For example:

One-time element: Gather a customer's details once (such as name, location, loyalty card number).
Conversational loop: The user can discuss recommendations, pricing, returns, and delivery, and may want to go from topic to topic. Let the model know that it's OK to engage in this conversational loop for as long as the user wants.
Specify tool calls within a flow in distinct sentences: For example, if a one-time step to gather a customer's details requires invoking a get_user_info function, you might say: Your first step is to gather user information. First, ask the user to provide their name, location, and loyalty card number. Then invoke get_user_info with these details.

Add any necessary guardrails: Provide any general conversational guardrails you don't want the model to do. Feel free to provide specific examples of if x happens, you want the model to do y. If you're still not getting the preferred level of precision, use the word unmistakably to guide the model to be precise.

Define tools precisely
When using tools with Gemini Live API, be specific in your tool definitions. Be sure to tell Gemini under what conditions a tool call should be invoked. For more details, see Tool definitions in the example section.

Craft effective prompts
Use clear prompts: Provide examples of what the models should and shouldn't do in the prompts, and try to limit prompts to one prompt per persona or role at a time. Instead of lengthy, multi-page prompts, consider using prompt chaining instead. The model performs best on tasks with single function calls.
Provide starting commands and information: Gemini Live API expects user input before it responds. To have Gemini Live API initiate the conversation, include a prompt asking it to greet the user or begin the conversation. Include information about the user to have Gemini Live API personalize that greeting.
Session resumption
Use transparent session resumption: Configure the connection with SessionResumptionConfig(transparent=True) in genai.types.LiveConnectConfig. This signals that the client intends to handle session resumption seamlessly, allowing for features like replaying unconsumed messages upon reconnection.


from google.genai import types

session_handle: str | None = None

live_config = types.LiveConnectConfig(
  session_resumption=types.SessionResumptionConfig(
      handle=session_handle,
      transparent=True,
  ),
)
Maintain and update session handle: Listen for session_resumption_update messages from the server. If resumable is true and a new_handle is provided, store this handle. This handle is essential for reconnecting to the same session state if a disconnection occurs.

Buffer sent messages and prune acknowledged ones: To ensure no client messages are lost during a disconnection, maintain a buffer of messages sent to Gemini Live API. The session_resumption_update message will contain last_consumed_client_message_index when transparent session resumption is enabled, indicating the last message processed by the server. Use this index to remove acknowledged messages from the buffer.

Handle disconnections gracefully:

GoAway Signal: The server sends a go_away message before an expected disconnection (such as a timeout). The manager should listen for this, and then proactively reconnect using the latest handle.
API Errors: Network issues can cause genai_errors.APIError (for example, codes 1000 or 1006 for WebSocket errors). The manager should catch these errors in both sending and receiving loops and trigger the session update or reconnection process.
Implement reconnection with message replay: When a disconnection occurs, create a new session using client.aio.live.connect with the latest session handle. After establishing the new connection, resend any messages in the buffer that were not acknowledged by the server before the disconnection.

Enable context window compression
Use ContextWindowCompressionConfig to configure the context window of the session for long sessions, as native audio tokens accumulate rapidly (approximately 25 tokens per sec of audio).

Warning: Context compression will cause conversation history loss.



from google.genai import types

live_config = types.LiveConnectConfig(
  context_window_compression=types.ContextWindowCompressionConfig(
    trigger_tokens=100_000,
    sliding_window=types.SlidingWindow(target_tokens=4_000),
  ),
)
Voice activity detection (VAD)
By default, the Gemini Live API uses the VAD provided by Gemini.

If you prefer to use a custom activity detection system, you must deactivate the default Voice Activity Detection (VAD) and manually signal the user turns to the Gemini model. This is accomplished by transmitting ActivityStart or ActivityEnd events to define the interaction boundaries.



from google.genai import live
from google.genai import types

# Disable VAD in config
live_config = types.LiveConnectConfig(
  realtime_input_config=types.RealtimeInputConfig(
    automatic_activity_detection=types.AutomaticActivityDetection(
        disabled=True
    ),
  ),
)

session: live.AsyncSession
await session.send_realtime_input( # Send activity start
    activity_start=types.ActivityStart()
)
for audio_bytes in bytes_to_send_queue: # Send user data.
    await session.send_realtime_input(
        audio=types.Blob(
            data=audio_bytes,
            mime_type=f"audio/pcm;rate=16000",
        )
    )
await session.send_realtime_input(activity_end=types.ActivityEnd()) # Send activity end
Set audio language code
Explicitly setting the language and voice code in your configuration is recommended to maintain consistency; without this definition, Gemini might alter the conversation language depending on the provided context.



from google.genai import types

config = types.LiveConnectConfig(
  speech_config=types.SpeechConfig(
    language_code="en-US",
  ),
)
Also mention in the system instruction:



RESPOND IN {OUTPUT_LANGUAGE}. YOU MUST RESPOND UNMISTAKABLY IN {OUTPUT_LANGUAGE}.
Set transcription language code
Specify the transcription language codes to increase the transcription accuracy using the BCP-47 language code format.

Note: Enabling transcription introduces more tokens.



from google.genai import types

config = types.LiveConnectConfig(
  input_audio_transcription=types.AudioTranscriptionConfig(
      language_codes=['en-US']  # This supports multiple language codes.
  ),
  output_audio_transcription=types.AudioTranscriptionConfig(
      language_codes=['en-US']
  ),
)
Client buffering
Don't buffer input audio significantly (for example, 1 second) before sending. Send small chunks (between 20 ms and 40 ms) to minimize latency.

Resampling
Ensure your client application resamples microphone input (often 44.1 kHz or 48 kHz) to 16 kHz before transmission.

Example
This example combines both the best practices and guidelines for system instruction design to guide the model's performance as a career coach.



**Persona:**
You are Laura, a career coach from Brooklyn, NY. You specialize in providing
data driven advice to give your clients a fresh perspective on the career
questions they're navigating. Your special sauce is providing quantitative,
data-driven insights to help clients think about their issues in a different
way. You leverage statistics, research, and psychology as much as possible.
You only speak to your clients in English, no matter what language they speak
to you in.

**Conversational Rules:**

1. **Introduce yourself:** Warmly greet the client.

2. **Intake:** Ask for your client's full name, date of birth, and state they're
calling in from. Call `create_client_profile` to create a new patient profile.

3. **Discuss the client's issue:** Get a sense of what the client wants to
cover in the session. DO NOT repeat what the client is saying back to them in
your response. Don't ask more than a few questions here.

4. **Reframe the client's issue with real data:** NO PLATITUDES. Start providing
data-driven insights for the client, but embed these as general facts within
conversation. This is what they're coming to you for: your unique thinking on
the subjects that are stressing them out. Show them a new way of thinking about
something. Let this step go on for as long as the client wants. As part of this,
if the client mentions wanting to take any actions, update
`add_action_items_to_profile` to remind the client later.

5. **Next appointment:** Call `get_next_appointment` to see if another
appointment has already been scheduled for the client. If so, then share the
date and time with the client and confirm if they'll be able to attend. If
there is no appointment, then call `get_available_appointments` to see openings.
Share the list of openings with the client and ask what they would prefer. Save
their preference with `schedule_appointment`. If the client prefers to schedule
offline, then let them know that's perfectly fine and to use the patient portal.

**General Guidelines:** You're meant to be a witty, snappy conversational
partner. Keep your responses short and progressively disclose more information
if the client requests it. Don't repeat back what the client says back to them.
Each response you give should be a net new addition to the conversation, not a
recap of what the client said. Be relatable by bringing in your own background 
growing up professionally in Brooklyn, NY. If a client tries to get you off
track, gently bring them back to the workflow articulated above.

**Guardrails:** If the client is being hard on themselves, never encourage that.
Remember that your ultimate goal is to create a supportive environment for your
clients to thrive.
Tool definitions
This JSON defines the relevant functions called in the career coach example. For best results when defining functions, include their names, descriptions, parameters, and invocation conditions.



[
 {
   "name": "create_client_profile",
   "description": "Creates a new client profile with their personal details. Returns a unique client ID. \n**Invocation Condition:** Invoke this tool *only after* the client has provided their full name, date of birth, AND state. This should only be called once at the beginning of the 'Intake' step.",
   "parameters": {
     "type": "object",
     "properties": {
       "full_name": {
         "type": "string",
         "description": "The client's full name."
       },
       "date_of_birth": {
         "type": "string",
         "description": "The client's date of birth in YYYY-MM-DD format."
       },
       "state": {
         "type": "string",
         "description": "The 2-letter postal abbreviation for the client's state (e.g., 'NY', 'CA')."
       }
     },
     "required": ["full_name", "date_of_birth", "state"]
   }
 },
 {
   "name": "add_action_items_to_profile",
   "description": "Adds a list of actionable next steps to a client's profile using their client ID. \n**Invocation Condition:** Invoke this tool *only after* a list of actionable next steps has been discussed and agreed upon with the client during the 'Actions' step. Requires the `client_id` obtained from the start of the session.",
   "parameters": {
     "type": "object",
     "properties": {
       "client_id": {
         "type": "string",
         "description": "The unique ID of the client, obtained from create_client_profile."
       },
       "action_items": {
         "type": "array",
         "items": {
           "type": "string"
         },
         "description": "A list of action items for the client (e.g., ['Update resume', 'Research three companies'])."
       }
     },
     "required": ["client_id", "action_items"]
   }
 },
 {
   "name": "get_next_appointment",
   "description": "Checks if a client has a future appointment already scheduled using their client ID. Returns the appointment details or null. \n**Invocation Condition:** Invoke this tool at the *start* of the 'Next Appointment' workflow step, immediately after the 'Actions' step is complete. This is used to check if an appointment *already exists*.",
   "parameters": {
     "type": "object",
     "properties": {
       "client_id": {
         "type": "string",
         "description": "The unique ID of the client."
       }
     },
     "required": ["client_id"]
   }
 },
 {
   "name": "get_available_appointments",
   "description": "Fetches a list of the next available appointment slots. \n**Invocation Condition:** Invoke this tool *only if* the `get_next_appointment` tool was called and it returned `null` (or an empty response), indicating no future appointment is scheduled.",
   "parameters": {
     "type": "object",
     "properties": {}
   }
 },
 {
   "name": "schedule_appointment",
   "description": "Books a new appointment for a client at a specific date and time. \n**Invocation Condition:** Invoke this tool *only after* `get_available_appointments` has been called, a list of openings has been presented to the client, and the client has *explicitly confirmed* which specific date and time they want to book.",
   "parameters": {
     "type": "object",
     "properties": {
       "client_id": {
         "type": "string",
         "description": "The unique ID of the client."
       },
       "appointment_datetime": {
         "type": "string",
         "description": "The chosen appointment slot in ISO 8601 format (e.g., '2025-10-30T14:30:00')."
       }
     },
     "required": ["client_id", "appointment_datetime"]
   }
 }
]

Configure language and voice



This document describes how to configure synthesized speech responses and voice activity detection in Gemini Live API. You can configure responses in a variety of HD voices and languages, and also configure voice activity detection settings to allow users to interrupt the model.

Set the language and voice
Native audio models like gemini-live-2.5-flash-native-audio can switch between languages naturally during conversation. You can also restrict the languages it speaks in by specifying it in the system instructions.

For non-native-audio models like gemini-live-2.5-flash, you can configure the language in speech_config.language_code.

Voice is configured in the voice_name field for all models.

The following code sample shows you how to configure language and voice.



from google.genai.types import LiveConnectConfig, SpeechConfig, VoiceConfig, PrebuiltVoiceConfig

config = LiveConnectConfig(
  response_modalities=["AUDIO"],
  speech_config=SpeechConfig(
    voice_config=VoiceConfig(
        prebuilt_voice_config=PrebuiltVoiceConfig(
            voice_name=voice_name,
        )
    ),
    language_code="en-US",
  ),
)
Tip: For the best results when prompting and requiring the model to respond in a non-English language, include the following as part of your system instructions:


RESPOND IN LANGUAGE. YOU MUST RESPOND UNMISTAKABLY IN LANGUAGE.
    
Voices supported
Gemini Live API supports the following 30 voice options in the voice_name field:

Zephyr -- Bright
Kore -- Firm
Orus -- Firm
Autonoe -- Bright
Umbriel -- Easy-going
Erinome -- Clear
Laomedeia -- Upbeat
Schedar -- Even
Achird -- Friendly
Sadachbia -- Lively	Puck -- Upbeat
Fenrir -- Excitable
Aoede -- Breezy
Enceladus -- Breathy
Algieba -- Smooth
Algenib -- Gravelly
Achernar -- Soft
Gacrux -- Mature
Zubenelgenubi -- Casual
Sadaltager -- Knowledgeable	Charon -- Informative
Leda -- Youthful
Callirrhoe -- Easy-going
Iapetus -- Clear
Despina -- Smooth
Rasalgethi -- Informative
Alnilam -- Firm
Pulcherrima -- Forward
Vindemiatrix -- Gentle
Sulafat -- Warm
Languages supported
Gemini Live API supports the following languages:

Language	BCP-47 Code
Arabic (Egyptian)	ar-EG
Bengali (Bangladesh)	bn-BD
Dutch (Netherlands)	nl-NL
English (India)	en-IN & hi-IN bundle
English (US)	en-US
French (France)	fr-FR
German (Germany)	de-DE
Hindi (India)	hi-IN
Indonesian (Indonesia)	id-ID
Italian (Italy)	it-IT
Japanese (Japan)	ja-JP
Korean (Korea)	ko-KR
Marathi (India)	mr-IN
Polish (Poland)	pl-PL
Portuguese (Brazil)	pt-BR
Romanian (Romania)	ro-RO
Russian (Russia)	ru-RU
Spanish (US)	es-US
Tamil (India)	ta-IN
Telugu (India)	te-IN
Thai (Thailand)	th-TH
Turkish (Turkey)	tr-TR
Ukrainian (Ukraine)	uk-UA
Vietnamese (Vietnam)	vi-VN
Configure voice activity detection
Voice activity detection (VAD) allows the model to recognize when a person is speaking. This is essential for creating natural conversations, because it allows a user to interrupt the model at any time.

When VAD detects an interruption, the ongoing generation is canceled and discarded. Only the information already sent to the client is retained in the session history. The server then sends a BidiGenerateContentServerContent message to report the interruption. The server then discards any pending function calls and sends a BidiGenerateContentServerContent message with the IDs of the canceled calls.

Python


config = {
    "response_modalities": ["audio"],
    "realtime_input_config": {
        "automatic_activity_detection": {
            "disabled": False, # default
            "start_of_speech_sensitivity": "low",
            "end_of_speech_sensitivity": "low",
            "prefix_padding_ms": 20,
            "silence_duration_ms": 100,
        }
    }
}
      

      Get started with Gemini Live API using the Google Gen AI SDK



This tutorial shows you how to connect to Gemini Live API by using the Google Gen AI SDK for Python. In this tutorial, you build a real-time multimodal application with a robust Python backend handling the API connection.

Before you begin
Complete the following steps to set up your environment.

In the Google Cloud console, on the project selector page, select or create a Google Cloud project.

Roles required to select or create a project

Note: If you don't plan to keep the resources that you create in this procedure, create a project instead of selecting an existing project. After you finish these steps, you can delete the project, removing all resources associated with the project.
Go to project selector

Verify that billing is enabled for your Google Cloud project.

Enable the Vertex AI API.

Roles required to enable APIs

Enable the API

Install the Google Cloud CLI.

If you're using an external identity provider (IdP), you must first sign in to the gcloud CLI with your federated identity.

To initialize the gcloud CLI, run the following command:



gcloud init
Install Git.
Install Python 3.
Clone the demo app
Clone the demo app repository and navigate to that directory:



git clone https://github.com/GoogleCloudPlatform/generative-ai.git &&
cd generative-ai/gemini/multimodal-live-api/native-audio-websocket-demo-apps/plain-js-python-sdk-demo-app
Project structure
The application includes the following files:



/
├── main.py                 # FastAPI server and WebSocket endpoint
├── gemini_live.py          # Gemini Live API wrapper using Gen AI SDK
├── requirements.txt        # Python dependencies
└── frontend/
    ├── index.html          # User Interface
    ├── main.js             # Application logic
    ├── gemini-client.js    # WebSocket client for backend communication
    ├── media-handler.js    # Audio/Video capture and playback
    └── pcm-processor.js    # AudioWorklet for PCM processing
Configure environment variables
For the purposes of this demo, the only environment variable that we need to configure is the one that defines the ID of your Google Cloud project. The following command creates an .env file that sets the environment variable PROJECT_ID. Replace PROJECT_ID with the project ID of your Google Cloud project.



echo "PROJECT_ID=PROJECT_ID" > .env
Run the backend server
The backend (main.py) handles the connection between the client and the Gemini Live API. The entry point is a FastAPI server that exposes a WebSocket endpoint. It accepts audio and video chunks from the frontend and forwards them to the GeminiLive session. The GeminiLive class in gemini_live.py wraps the genai.Client to manage the session.



# Connects using the SDK
async with self.client.aio.live.connect(model=self.model, config=config) as session:
    # Manages input/output queues
    await asyncio.gather(
        send_audio(),
        send_video(),
        receive_responses()
    )
To run the backend server, run the following commands:

Install dependencies:



pip3 install -r requirements.txt
Authenticate with Google Cloud:



gcloud auth application-default login
Start the server:



python3 main.py
Open the frontend UI and connect with Gemini
The frontend manages audio and video capture and playback. The gemini-client.js file handles the WebSocket connection to the backend. It sends base64-encoded media chunks to the backend and receives audio responses from Gemini Live API, which are then played back to the user.

To open the frontend UI and connect with Gemini, do the following:

Open your browser and navigate to http://localhost:8000.
Click Connect.
Interact with Gemini
Try to do the following:

Text input: You can write a text message to Gemini by entering your message in the message field and clicking Send. Gemini responds to the message using audio.
Voice input: To speak to Gemini, click Start mic. Gemini responds to the prompt using audio.
Video input: To let Gemini see through your camera, click Start camera. You can talk to Gemini about what it sees through your camera.


Start and manage live sessions



The Gemini Live API enables low-latency voice and text interactions by processing continuous streams of audio or text called sessions to deliver immediate, human-like spoken responses. Session lifecycle management, from the initial handshake to graceful termination, is controlled by the developer.

This page shows you how to start a conversation session with Gemini models using the Gemini Live API. You can start a session using Vertex AI Studio, the Gen AI SDK, or WebSockets.

This page also shows you how to do the following:

Extend a session beyond the default time limit
Resume a previous session
Update system instructions during a session
Configure the context window of a session
Enable transcription for a session
Session lifetime
Without compression, audio-only sessions are limited to 15 minutes, and audio-video sessions are limited to 2 minutes. Exceeding these limits will terminate the session, but you can use context window compression to extend sessions to an unlimited amount of time.

The lifetime of a connection is limited to around 10 minutes. When the connection terminates, the session terminates as well. In this case, you can configure a single session to stay active over multiple connections using session resumption. You'll also receive a GoAway message before the connection ends, allowing you to take further actions.

Maximum concurrent sessions
You can have up to 1,000 concurrent sessions per project on a pay-as-you-go (PayGo) plan. This limit does not apply to customers using Provisioned Throughput.

Start a session
The following tabs show how to start a live conversation session using Vertex AI Studio, the Gen AI SDK, or WebSockets:

Console
Python
Python
Open Vertex AI Studio > Stream realtime.
Click mic Start session to initiate the conversation.
To end the session, click stop_circleStop session.

Note: While some parameters including system instructions can be adjusted mid-session, the model and other parameters are typically immutable once the setup message is processed.
Extend a session
Note: Session extension is only available when using the Gen AI SDK, not Vertex AI Studio.
The default maximum length of a conversation session is 10 minutes. A goAway notification (BidiGenerateContentServerMessage.goAway) is sent to the client 60 seconds before the session ends.

To extend a session past the 10-minute connection limit, you must reconnect using session resumption. When you receive a goAway notification, or when the connection is terminated for other reasons, you can start a new connection using a session handle obtained during the session. This resumes your session with its context intact on the new connection. There's no limit to the number of times you can do this. For an example of resuming a session, see Resume a previous session.

The following example shows how to detect an impending session termination by listening for a goAway notification:

Python


async for response in session.receive():
    if response.go_away is not None:
        # The connection will soon be terminated
        print(response.go_away.time_left)
      
Resume a previous session
Important: If you need to ensure zero data retention in your application, don't enable session resumption.
The Gemini Live API supports session resumption to prevent the user from losing conversation context during a brief disconnect (for example, switching from Wifi to 5G). You can resume a previous session within 24 hours. Session resumption is achieved by storing cached data, including text, video, audio prompts, and model outputs. Project-level privacy is enforced for this cached data.

By default, session resumption is disabled. To enable session resumption, set the sessionResumption field of the BidiGenerateContentSetup message. If enabled, the server periodically sends SessionResumptionUpdate messages containing a session_id and a resumption token. If the WebSocket disconnects, the client can reconnect and include these credentials in the new setup message. The server then restores the previous context, allowing the conversation to continue seamlessly.

The resumption window is finite (typically around 10 minutes). If the client does not reconnect within this timeframe, the session state is discarded to free up server resources.

The following example connects to the service, obtains a session resumption handle, simulates a disconnect, and then reconnects using the handle to resume the session:

Python


import asyncio
from google import genai
from google.genai import types
import websockets

# Replace the PROJECT_ID and LOCATION with your Project ID and location.
client = genai.Client(vertexai=True, project="PROJECT_ID", location="LOCATION")

# Configuration
MODEL = "gemini-live-2.5-flash-native-audio"

async def resumable_session_example():
    """Demonstrates session resumption by connecting, disconnecting, and reconnecting."""
    session_handle = None

    print("Starting a new session...")
    try:
        async with client.aio.live.connect(
            model=MODEL,
            config=types.LiveConnectConfig(
                response_modalities=["audio"],
                session_resumption=types.SessionResumptionConfig(handle=None),
            ),
        ) as session:
            await session.send_content(
                content=types.Content(role="user", parts=[types.Part(text="Hello!")])
            )
            async for message in session.receive():
                if message.session_resumption_update:
                    update = message.session_resumption_update
                    if update.resumable and update.new_handle:
                        session_handle = update.new_handle
                        print(f"Received session handle: {session_handle}")
                        # For demonstration, we break to simulate a disconnect
                        # after receiving a handle.
                        break
                if message.server_content and message.server_content.turn_complete:
                    break
    except websockets.exceptions.WebSocketException as e:
        print(f"Initial connection failed: {e}")
        return

    if not session_handle:
        print("Did not receive a session handle. Cannot demonstrate resumption.")
        return

    print(f"\nSimulating disconnect and reconnecting with handle {session_handle}...")

    try:
        async with client.aio.live.connect(
            model=MODEL,
            config=types.LiveConnectConfig(
                response_modalities=["audio"],
                session_resumption=types.SessionResumptionConfig(handle=session_handle),
            ),
        ) as session:
            print("Successfully resumed session.")
            await session.send_content(
                content=types.Content(role="user", parts=[types.Part(text="I am back!")])
            )
            async for message in session.receive():
                if message.session_resumption_update:
                    update = message.session_resumption_update
                    if update.resumable and update.new_handle:
                        session_handle = update.new_handle
                        print(f"Received updated session handle: {session_handle}")
                if message.server_content:
                    print(f"Received server content: {message.server_content}")
                    if message.server_content.turn_complete:
                        break
            print("Resumed session finished.")
    except websockets.exceptions.WebSocketException as e:
        print(f"Failed to resume session: {e}")

if __name__ == "__main__":
    asyncio.run(resumable_session_example())
      
Enable seamless session resumption with transparent mode
When you enable session resumption, you can also enable transparent mode to help make the resumption process more seamless for the user. When transparent mode is enabled, the index of the client message that corresponds with the context snapshot is explicitly returned. This helps identify which client message you need to send again, when you resume the session from the resumption handle.

To enable transparent mode:

Python


config = {
   "response_modalities": ["audio"],
   "session_resumption_config": {
    "transparent": True,
   }
}
      
Update system instructions during a session
The Gemini Live API lets you update the system instructions during an active session. Use this to adapt the model's responses, such as changing the response language or modifying the tone.

To update the system instructions mid-session, you can send text content with the system role. The updated system instruction will remain in effect for the remaining session.

Python


session.send_client_content(
      content=types.Content(
          role="system", parts=[types.Part(text="new system instruction")]
      ),
      turn_complete=False
  )
      
Configure the context window of the session
The Gemini Live API context window is used to store real-time streamed data (25 tokens per second (TPS) for audio and 258 TPS for video) and other content, including text inputs and model outputs. All Gemini Live API models have a context window limit of 128k tokens.

In long-running sessions, as the conversation progresses, the history of audio and text tokens accumulates. If this history exceeds the model's limit, the model may hallucinate, slow down, or the session may be forcibly terminated. To enable longer sessions, you can enable context window compression by setting the contextWindowCompression field as part of the session configuration.

Context window compression uses a a server-side sliding window to truncate the oldest turns when enabled. When the accumulated tokens exceed a defined maximum length (set using the Max content size slider in Vertex AI Studio, or trigger_tokens in the API), the server automatically prunes the oldest turns or summarizes them to maintain context within the limit. In the ContextWindowCompressionConfig, you can configure a sliding-window mechanism and the number of tokens defined in the target_tokens parameter that triggers compression.

This allows for theoretically infinite session durations from the user's perspective, as the "memory" is constantly managed. Without compression, audio-only sessions might be limited to approximately 15 minutes before hitting hard limits.

The minimum and maximum lengths for the context length and target size are:

Setting (API flag)	Minimum value	Maximum value
Maximum context length (trigger_tokens)	5,000	128,000
Target context size (target_tokens)	0	128,000
To set the context window:

Console
Python
Open Vertex AI Studio > Stream realtime.
Click to open the Advanced menu.
In the Session Context section, use the Max context size slider to set the context size to a value between 5,000 and 128,000.
(Optional) In the same section, use the Target context size slider to set the target size to a value between 0 and 128,000.
Enable audio transcription for the session
You can enable transcriptions for both the input and output audio.

To receive transcriptions, you must update your session configuration. You need to add the input_audio_transcription and output_audio_transcription objects and ensure text is included in response_modalities.



config = {
    "response_modalities": ["audio", "text"],
    "input_audio_transcription": {},
    "output_audio_transcription": {},
}
Processing the response
The following code sample demonstrates how to connect using the configured session and extract the text parts (transcriptions) alongside the audio data.



# Receive Output Loop
async for message in session.receive():
    server_content = message.server_content
    if server_content:
        # Handle Model Turns (Audio + Text)
        model_turn = server_content.model_turn
        if model_turn and model_turn.parts:
            for part in model_turn.parts:
                # Handle Text (Transcriptions)
                if part.text:
                    print(f"Transcription: {part.text}")
                # Handle Audio
                if part.inline_data:
                    audio_data = part.inline_data.data
                    # Process audio bytes...
                    pass

        # Check for turn completion
        if server_content.turn_complete:
            print("Turn complete.")


Configure Gemini capabilities



This document shows you how to configure various capabilities of Gemini models when using Gemini Live API. You can configure tool use such as function calling and grounding, and native audio capabilities such as affective dialog and proactive audio.


To learn more, run the following notebooks in the environment of your choice:

"Introduction to the Multimodal Live API (WebSocket)":

Open in Colab | Open in Colab Enterprise | Open in Vertex AI Workbench | View on GitHub

"Introduction to the Multimodal Live API (Google Gen AI SDK)":

Open in Colab | Open in Colab Enterprise | Open in Vertex AI Workbench | View on GitHub

Configure tool use
Several tools are compatible with various versions of Gemini Live API-supported models, including:

Function calling
Grounding with Google Search
Grounding with Vertex AI RAG Engine (Preview)
To enable a particular tool for usage in returned responses, include the name of the tool in the tools list when you initialize the model. The following sections provide examples of how to use each of the built-in tools in your code.

Function calling
Use function calling when you want the model to interact with external systems or APIs that you manage. Use this for tasks like checking a database, sending an email, or interacting with a custom API.

The model generates a function call, and your application executes the code and sends the results back to the model.

All functions must be declared at the start of the session by sending tool definitions as part of the LiveConnectConfig message.

To enable function calling, include function_declarations in the tools list in the setup message:

Python


import asyncio

from google import genai
from google.genai.types import (
    Content,
    LiveConnectConfig,
    Part,
)

# Initialize the client.
client = genai.Client(
    vertexai=True,
    project="GOOGLE_CLOUD_PROJECT",  # Replace with your project ID
    location="LOCATION",  # Replace with your location
)

MODEL_ID = "gemini-live-2.5-flash-native-audio"


def get_current_weather(location: str) -> str:
    """Example method. Returns the current weather.

    Args:
        location: The city and state, e.g. San Francisco, CA
    """
    weather_map: dict[str, str] = {
        "Boston, MA": "snowing",
        "San Francisco, CA": "foggy",
        "Seattle, WA": "raining",
        "Austin, TX": "hot",
        "Chicago, IL": "windy",
    }
    return weather_map.get(location, "unknown")


async def main():
    config = LiveConnectConfig(
        response_modalities=["AUDIO"],
        tools=[get_current_weather],
    )

    async with client.aio.live.connect(
        model=MODEL_ID,
        config=config,
    ) as session:
        text_input = "Get the current weather in Boston."
        print(f"Input: {text_input}")

        await session.send_client_content(
            turns=Content(role="user", parts=[Part(text=text_input)])
        )

        async for message in session.receive():
            if message.tool_call:
                function_responses = []
                for function_call in message.tool_call.function_calls:
                    print(f"FunctionCall > {function_call}")
                    # Execute the tool and send the response back to the model.
                    result = get_current_weather(**function_call.args)
                    function_responses.append(
                        {
                            "name": function_call.name,
                            "response": {"result": result},
                            "id": function_call.id,
                        }
                    )
                if function_responses:
                    await session.send_tool_response(function_responses=function_responses)


if __name__ == "__main__":
    asyncio.run(main())
  
For examples using function calling in system instructions, see our best practices example.

Grounding with Google Search
Use Grounding with Google Search when you want the model to provide more accurate and factual responses by anchoring them to verifiable sources of information. Use this for tasks like searching the web.

Unlike function calling, the server-side integration handles the retrieval of information automatically.

To enable Grounding with Google Search, include google_search in the tools list in the setup message:

Python


import asyncio

from google import genai
from google.genai.types import (
    Content,
    LiveConnectConfig,
    Part,
)

# Initialize the client.
client = genai.Client(
    vertexai=True,
    project="GOOGLE_CLOUD_PROJECT",  # Replace with your project ID
    location="LOCATION",  # Replace with your location
)

MODEL_ID = "gemini-live-2.5-flash-native-audio"


async def main():
    config = LiveConnectConfig(
        response_modalities=["AUDIO"],
        tools=[{"google_search": {}}],
    )

    async with client.aio.live.connect(
        model=MODEL_ID,
        config=config,
    ) as session:
        text_input = "What is the current weather in Toronto, Canada?"
        print(f"Input: {text_input}")

        await session.send_client_content(
            turns=Content(role="user", parts=[Part(text=text_input)])
        )

        async for message in session.receive():
            # Consume the messages from the model.
            # In native audio, the model response is in audio format.
            pass


if __name__ == "__main__":
    asyncio.run(main())
  
Grounding with Vertex AI RAG Engine
Preview

This feature is subject to the "Pre-GA Offerings Terms" in the General Service Terms section of the Service Specific Terms. Pre-GA features are available "as is" and might have limited support. For more information, see the launch stage descriptions.

You can use Vertex AI RAG Engine with the Live API for grounding, storing, and retrieving contexts. Use this for tasks like retrieving information from a document corpus. Like Grounding with Google Search, RAG grounding is handled server-side and automatically retrieves information from your specified corpus:

Python


import asyncio

from google import genai
from google.genai.types import (
    Content,
    LiveConnectConfig,
    Part,
    Retrieval,
    Tool,
    VertexRagStore,
    VertexRagStoreRagResource,
)

# Initialize the client.
client = genai.Client(
    vertexai=True,
    project="GOOGLE_CLOUD_PROJECT",  # Replace with your project ID
    location="LOCATION",  # Replace with your location
)

MODEL_ID = "gemini-live-2.5-flash-native-audio"


async def main():
    rag_store = VertexRagStore(
        rag_resources=[
            VertexRagStoreRagResource(
                rag_corpus="RESOURCE_NAME"  # Replace with your corpus resource name
            )
        ],
        # Set `store_context` to true to allow Live API sink context into your memory corpus.
        store_context=True,
    )

    config = LiveConnectConfig(
        response_modalities=["AUDIO"],
        tools=[Tool(retrieval=Retrieval(vertex_rag_store=rag_store))],
    )

    async with client.aio.live.connect(
        model=MODEL_ID,
        config=config,
    ) as session:
        text_input = "YOUR_TEXT_INPUT"
        print(f"Input: {text_input}")

        await session.send_client_content(
            turns=Content(role="user", parts=[Part(text=text_input)])
        )

        async for message in session.receive():
            # Consume the messages from the model.
            # In native audio, the model response is in audio format.
            pass


if __name__ == "__main__":
    asyncio.run(main())
  
For more information, see Use Vertex AI RAG Engine in Gemini Live API.

Configure native audio capabilities
Preview

This feature is subject to the "Pre-GA Offerings Terms" in the General Service Terms section of the Service Specific Terms. Pre-GA features are available "as is" and might have limited support. For more information, see the launch stage descriptions.

Models that have native audio capabilities support the following features:

30 HD voices
24 languages
Proactive Audio
Affective Dialog
Note: Native Audio doesn't support response_modalities=["TEXT"].
Configure Affective Dialog
Important: Affective Dialog can produce unexpected results.
When Affective Dialog is enabled, the model attempts to understand and respond based on the tone of voice and emotional expressions of the user.

To enable Affective Dialog, set enable_affective_dialog to true in the setup message:

Python


config = LiveConnectConfig(
    response_modalities=["AUDIO"],
    enable_affective_dialog=True,
)
  
Configure Proactive Audio
Proactive Audio lets you control when the model responds. For example, you can ask Gemini to only respond when prompted or when specific topics are discussed. To see a video demonstration of Proactive Audio, see Gemini LiveAPI Native Audio Preview.

To enable Proactive Audio, configure the proactivity field in the setup message and set proactive_audio to true:

Python


config = LiveConnectConfig(
    response_modalities=["AUDIO"],
    proactivity=ProactivityConfig(proactive_audio=True),
)
  
Example conversation

The following is a sample of what a conversation with Gemini about cooking might look like:



Prompt: "You are an AI assistant in Italian cooking; only chime in when the topic is about Italian cooking."

Speaker A: "I really love cooking!" (No response from Gemini.)

Speaker B: "Oh yes, me too! My favorite is French cuisine." (No response from
Gemini.)

Speaker A: "I really like Italian food; do you know how to make a pizza?"

(Italian cooking topic will trigger response from Gemini.)
Gemini Live API: "I'd be happy to help! Here's a recipe for a pizza."
Common use cases
When using Proactive Audio, Gemini performs as follows:

Responds with minimal latency: Gemini responds after the user is done speaking, reducing interruptions and helping Gemini not lose context if an interruption happens.
Avoids interruptions: Proactive Audio helps Gemini avoid interruptions from background noise or external chatter, and prevents Gemini from responding if external chatter is introduced during a conversation.
Handles interruptions: If the user needs to interrupt during a response from Gemini, Proactive Audio makes it easier for Gemini to appropriately back-channel (meaning appropriate interruptions are handled), rather than if a user uses filler words such as umm or uhh.
Co-listens to audio: Gemini can co-listen to an audio file that's not the speaker's voice and subsequently answer questions about that audio file later in the conversation.
Billing
While Gemini is listening to a conversation, input audio tokens will be charged.

For output audio tokens, you're only charged when Gemini responds. If Gemini does not respond or stays silent, there will be no charge to your output audio tokens.

For more information, see Vertex AI pricing.

What's next
For more information on using Gemini Live API, see:

Gemini Live API overview
Gemini Live API reference guide
Start and manage live sessions

React Demo app:
https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/multimodal-live-api/native-audio-websocket-demo-apps/react-demo-app


Gemini 3.1 Flash Live Preview



Gemini 3.1 Flash Live Preview is our low-latency, audio-to-audio model optimized for real-time dialogue and voice-first AI applications with acoustic nuance detection, numeric precision, and multimodal awareness.

Try in Google AI Studio
Documentation
Visit the Live API guide for full coverage of features and capabilities.

gemini-3.1-flash-live-preview
Property	Description
Model code	gemini-3.1-flash-live-preview
Supported data types
Inputs

Text, images, audio, video

Output

Text and audio

Token limits[*]
Input token limit

131,072

Output token limit

65,536

Capabilities
Audio generation

Supported

Batch API

Not supported

Caching

Not supported

Code execution

Not supported

File search

Not Supported

Function calling

Supported

Grounding with Google Maps

Not supported

Image generation

Not supported

Live API

Supported

Search grounding

Supported

Structured outputs

Not supported

Thinking

Supported

URL context

Not supported

Versions	
Read the model version patterns for more details.
Preview: gemini-3.1-flash-live-preview
Latest update	March 2026
Knowledge cutoff	January 2025
Migrating from Gemini 2.5 Flash Live
Gemini 3.1 Flash Live Preview is optimized for low-latency, real-time dialogue. When migrating from gemini-2.5-flash-native-audio-preview-12-2025, consider the following:

Model string: Update your model string from gemini-2.5-flash-native-audio-preview-12-2025 to gemini-3.1-flash-live-preview.
Thinking configuration: Gemini 3.1 uses thinkingLevel (with settings like minimal, low, medium, and high) instead of thinkingBudget. The default is minimal to optimize for lowest latency. See Thinking levels and budgets.
Server events: A single BidiGenerateContentServerContent event can now contain multiple content parts simultaneously (for example, audio chunks and transcript). Update your code to process all parts in each event to avoid missing content.
Client content: send_client_content is only supported for seeding initial context history (requires setting initial_history_in_client_content in history_config). Use send_realtime_input to send text updates during the conversation. See Incremental content updates.
Turn coverage: Defaults to TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO instead of TURN_INCLUDES_ONLY_ACTIVITY. The model's turn now includes detected audio activity and all video frames. If your application currently sends a constant stream of video frames, you may want to update your application to only send video frames when there is audio activity to avoid incurring additional costs.
Async function calling: Not yet supported. Function calling is synchronous only. The model will not start responding until you've sent the tool response. See Async function calling.
Proactive audio and affective dialogue: These features are not yet supported in Gemini 3.1 Flash Live. Remove any configuration for these features from your code. See Proactive audio and Affective dialogue.
For a detailed feature comparison, see the Model comparison table in the capabilities guide.