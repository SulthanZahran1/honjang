# Honjang — Context & Glossary

> This document is a glossary of domain terms used in the Honjang project. It is devoid of implementation details. Terms are captured here as they are resolved during grilling sessions.

---

## Conversation Roles

### Junior
The primary user of the app. Speaks English. Communicates with a senior colleague in Korea. The app translates their English speech into Korean with appropriate honorifics.

### Senior
The Korean-speaking colleague. Speaks Korean. The app translates their Korean speech into English for the junior.

### Turn
A single speech segment from one party, bounded by silence (VAD endpoint) or manual tap (pipeline mode). A turn triggers one translation cycle.

### Utterance
The transcribed text of a turn, before translation. May consist of multiple Deepgram `is_final` segments concatenated until `speech_final` or VAD endpoint.

---

## Translation Concepts

### Direction
The translation path for a given turn. Either EN→KO (junior speaking) or KO→EN (senior speaking).

### Auto-Detect
Language detection mode where Deepgram Nova-3 multilingual identifies the spoken language and routes the translation direction automatically.

### Manual Buttons
Direction mode where the user taps EN→KO or KO→EN before speaking. No language detection reliance.

### Sticky Fallback
When auto-detect confidence is low, the app uses the last successfully detected direction rather than guessing.

### Code-Switch Rule
If any Korean is detected in a mixed-language utterance, the direction is always KO→EN. Rationale: the junior (English speaker) never speaks Korean, so Korean presence indicates the senior is talking.

---

## Operating Modes

### Pipeline Mode
Tap-to-translate mode. The user manually controls when recording starts/stops and optionally the direction. Walkie-talkie style.

### Raw Voice Agent Mode
Always-on mode. Silero VAD detects speech automatically, Deepgram transcribes, the LLM translates, and TTS plays — without any user interaction. Live interpreter feel.

---

## LLM Roles

### Pure Translator
The LLM translates input text to the target language with appropriate honorifics. No conversational additions, no pleasantries, no asking for repetition.

### Conversational Interpreter
The LLM may add conversational elements — asking for repetition, handling pleasantries, smoothing cultural gaps — in addition to translating.

---

## Honorific System (존댓말)

### 합쇼체 (Hapsyo-che)
Formal deferential register. Sentence endings: -습니다/ㅂ니다. Most formal level, used in business settings and when speaking to seniors.

### 해요체 (Haeyo-che)
Polite register. Sentence endings: -아요/어요. Standard polite workplace speech. Less stiff than 합쇼체.

### 해체 (Hae-che)
Plain/informal register. Sentence endings: -아/어. Used between close friends or to subordinates. Not appropriate for senior communication.

### Auto Politeness
The LLM selects the politeness level based on the injected social context (relationship, topic, conversation tone). Default mode.

---

## VAD & Turn Detection

### VAD (Voice Activity Detection)
Frame-level detection of speech vs. silence in the audio stream. In Honjang, Silero VAD runs on the VPS as the primary speech/no-speech gate.

### Endpointing
Detection of a sufficiently long pause indicating the speaker has finished. Two sources: Silero VAD silence threshold and Deepgram's `speech_final` signal.

### Utterance End
A safety-net timeout event from Deepgram (`UtteranceEnd`). Fires after configurable silence duration (default 1000ms) regardless of other signals.

### Barge-in
When a user starts speaking while TTS audio is playing. The app immediately stops TTS playback and starts capturing the new speech. Always enabled.

### AEC (Acoustic Echo Cancellation)
OS-level audio processing that prevents the TTS output (phone speaker) from being detected as incoming speech by the microphone. Required for barge-in to work.

---

## Streaming

### Hybrid One-Chunk Buffer
LLM output is split at Korean clause boundaries and sent to TTS incrementally. The first chunk's TTS plays while the LLM generates the second chunk. One chunk is always buffered ahead to prevent audio gaps.

### Korean Clause Boundary
Natural split points in Korean text: commas (,), sentence-ending markers (-습니다, -요, -다, -네), and conjunctions (그리고, 그래서, 하지만). Used for LLM→TTS chunking.

---

## Session

### Session
A single conversation period from connection to disconnection. Contains full conversation history (all turns, directions, translations). No cap on turn count.

### Session History
Text-only record of a past session, stored in VPS SQLite. Includes timestamps, direction, original text, translated text, and LLM model used. No audio.

---

## Providers

### OpenRouter
Single API gateway to multiple LLM providers. The user selects any model (e.g., google/gemini-3.1-flash-lite, anthropic/claude-sonnet-4.6, openai/gpt-5-mini) at runtime.

### Deepgram
Speech-to-Text provider. Nova-3 multilingual model for streaming transcription with Korean support and language detection.

### ElevenLabs
Text-to-Speech provider. Flash v2.5 (default, 75ms latency, 32 languages incl. Korean) and v3 (optional, 70+ languages, more expressive).