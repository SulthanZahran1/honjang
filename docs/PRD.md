# Honjang — English ↔ Korean Honorific Voice Translator

## Problem Statement

A junior employee needs to communicate with a senior colleague in Korea. The user speaks English; the senior speaks Korean. The language barrier is compounded by Korean's honorific system (존댓말), where using the wrong politeness level is a social faux pas. Existing translation apps (Google Translate, Papago) handle text but lack real-time voice conversation with honorific awareness and context.

## Solution

A mobile app (Expo) paired with a lightweight VPS backend (FastAPI) that acts as a real-time two-way voice translator. The user holds the phone; both parties speak into it. The app supports two modes:

1. **Pipeline Mode** — tap-to-translate (walkie-talkie style)
2. **Raw Voice Agent Mode** — always-on, auto-detecting speech and translating in real-time

The LLM translates with awareness of the social relationship (junior → senior) and automatically selects the appropriate Korean politeness level (합쇼체, 해요체, etc.).

## User Stories

- **US-1:** As a junior employee, I hold my phone between myself and my senior, speak English, and the app speaks Korean in an appropriate honorific level so my senior understands me respectfully.

- **US-2:** As a junior employee, my senior replies in Korean, the app detects their speech, translates to English, and speaks it so I understand their response.

- **US-3:** As a user, I can switch between pipeline mode (tap to speak/translate) and raw voice agent mode (always-on auto-translate) depending on the conversation flow.

- **US-4:** As a user, I can configure the LLM model (via OpenRouter), TTS model (ElevenLabs), and VAD parameters through the app settings to tune latency vs. quality.

- **US-5:** As a user, I can set relationship context (my role, senior's role, politeness level, topic) that gets injected into the LLM system prompt for accurate honorific translation.

- **US-6:** As a user, I can interrupt the TTS playback by speaking (barge-in), and the app stops playback and starts listening immediately.

- **US-7:** As a user, I can review past conversation sessions (text transcripts with timestamps and translation direction) stored on the VPS.

## Implementation Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Expo (mobile) + FastAPI (VPS) | Native mic access, user familiarity with FastAPI |
| Audio transport | WebSocket chunked streaming | Required for real-time raw voice agent mode |
| STT | Deepgram Nova-3 multilingual (API) | Streaming, Korean support, auto language detection |
| LLM | OpenRouter (any model, user-configurable) | Single API key, pluggable, cost-flexible |
| TTS | ElevenLabs Flash v2.5 (default), v3 (optional) | Korean support, 75ms latency, configurable |
| VAD | Silero VAD + Deepgram endpointing + utterance_end | Deepgram's official hybrid reference architecture |
| Barge-in | Full, with AEC, always on | Natural conversation requires interruption support |
| Conversation history | Full, per-session, no cap | Korean is pro-drop; context is critical for accuracy |
| Session storage | VPS SQLite, text-only | Lightweight, user-owned, no audio storage |
| LLM→TTS streaming | Hybrid one-chunk buffer, split on Korean clause boundaries | Minimizes perceived latency to ~300ms |
| Language detection | Constrain to en+ko, sticky fallback, code-switch→KO→EN | Senior never speaks English; simplifies routing |
| System prompt | Junior→Senior, auto politeness, context field, "technical stuff" default | Honorific accuracy requires social context |
| Backend framework | FastAPI (not Go) | 6-11ms WS overhead is <1% of total latency; Python ecosystem for Silero/Deepgram/ElevenLabs SDKs |

## Testing Decisions

- **Unit tests** for VAD heuristic logic, language routing, Korean clause splitting, system prompt assembly
- **Integration tests** for WebSocket relay, Deepgram streaming, OpenRouter LLM, ElevenLabs TTS
- **E2E manual testing** with actual English→Korean conversation (requires Korean speaker for verification)
- **Latency profiling** for each pipeline stage (VAD, STT, LLM, TTS, total)

## Out of Scope

- WebRTC / telephony (explicitly excluded — hold-the-phone speaker mode only)
- Multi-user support (single user, single session)
- Audio recording / playback of sessions (text-only history)
- Self-hosted models (VPS not powerful enough — all inference via API)
- Papago integration (decided against — OpenRouter LLM is sufficient)
- App store distribution (personal use initially)
- Korean→Korean or English→English translation (two-way EN↔KO only)

## Further Notes

### Budget Constraint

Total pipeline cost must stay under **2,000 IDR/min (~$0.123/min)**. All confirmed combos meet this:

| STT | LLM | TTS | Total/min | IDR/min |
|-----|-----|-----|-----------|---------|
| Nova-3 ($0.0092) | Gemini 3.1 Flash Lite ($0.0004) | Flash v2.5 ($0.06) | $0.0696 | ~1,135 |
| Nova-3 ($0.0092) | Claude Sonnet 4.6 ($0.0042) | Flash v2.5 ($0.06) | $0.0734 | ~1,197 |
| Nova-3 ($0.0092) | GPT-5 mini ($0.0005) | Flash v2.5 ($0.06) | $0.0697 | ~1,136 |

TTS dominates cost at ~86% of total. ElevenLabs Multilingual v2 ($0.12/min) breaks the budget.

### Latency Budget

| Component | Target | Source |
|-----------|--------|--------|
| WebSocket relay | 6-11ms | FastAPI + uvloop |
| VAD + endpointing | 200-300ms | Silero + Deepgram |
| STT transcription | 200-300ms | Deepgram Nova-3 streaming |
| LLM TTFT | 200-1000ms | OpenRouter (model-dependent) |
| TTS first audio | 75-150ms | ElevenLabs Flash v2.5 |
| **Total (pipeline mode)** | **725-1250ms** | |
| **Total (with streaming TTS)** | **~300ms to first audio** | Hybrid chunked streaming |

### Korean Honorific Context

Korean has multiple politeness levels. The system prompt must include social relationship context for the LLM to select the correct level:

| Level | Name | Ending | Usage |
|-------|------|--------|-------|
| Formal deferential | 합쇼체 | -습니다/ㅂ니다 | Most formal, to seniors |
| Polite | 해요체 | -아요/어요 | Standard workplace |
| Plain | 해체 | -아/어 | Informal, close friends |
| Familiar | 하게체 | -네 | To subordinates |

Default: **Auto** (LLM decides based on context). Research shows Claude Sonnet 4.6 is best at honorific register; Gemini 3.1 Flash Lite is best at multi-turn Korean context translation.