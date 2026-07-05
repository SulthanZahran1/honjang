# ADR-0002: Hybrid VAD Architecture (Silero + Deepgram)

**Date:** 2026-07-05  
**Status:** Accepted

## Context

The raw voice agent mode requires reliable end-of-speech detection to know when a speaker has finished and translation should trigger. Deepgram's Flux model has built-in turn detection but does not support Korean. Nova-3 multilingual supports Korean but lacks Flux's EndOfTurn events.

## Decision

Implement the **hybrid VAD architecture** from Deepgram's official `deepgram-eos-heuristics` reference: Silero VAD (local) + Deepgram endpointing + Deepgram utterance_end, with a custom heuristic that combines all three signals.

## Rationale

### Why Not Deepgram Alone?

- **Flux multilingual** (with built-in turn detection) does not support Korean — only EN, ES, FR, DE, HI, RU, PT, JA, IT, NL
- **Nova-3 endpointing** alone (default 10ms) is tuned for English and cuts off Korean mid-sentence (honorific phrasing has internal pauses)
- **Nova-3 utterance_end** alone is a timeout safety net — too slow as primary detection

### Why Silero VAD?

- Open-source, ~1MB model, runs on CPU with <10ms latency
- 87.7% true positive rate at 5% false positive rate (vs. WebRTC VAD at 50%)
- Neural model, robust to noise
- Runs locally on VPS — no API dependency

### Deepgram's Own Recommendation

> "For the most reliable and low-latency performance, we recommend using a local VAD (such as Silero VAD) as close as possible to where audio enters the application."
> — Deepgram `deepgram-eos-heuristics` README

### Three-Layer Fallback

1. **Silero VAD** (primary) — frame-level speech detection, fires `speech_end` after configurable silence (450ms for Korean)
2. **Deepgram endpointing** (secondary) — `speech_final: true` after 450ms pause
3. **Deepgram utterance_end** (safety net) — fires after 1200ms timeout

The heuristic endpoints when either Silero says silence + utterance has content, OR the pause threshold between words exceeds 1.2s.

### Korean-Specific Tuning

Korean honorific speech has longer internal pauses than English. Parameters tuned higher than English defaults:

| Parameter | English Default | Korean Tuned |
|-----------|----------------|-------------|
| min_silence_duration | 300ms | 450ms |
| pause_threshold | 1.0s | 1.2s |
| utterance_end_ms | 1000ms | 1200ms |
| endpointing | 300ms | 450ms |

All parameters are user-configurable in the app UI.

## Consequences

- Audio is sent to both Silero (local thread) and Deepgram (WebSocket) in parallel
- A `VADHeuristic` class processes events from all three sources and makes the final endpoint decision
- Slightly more complex than a single-source approach, but follows Deepgram's official reference
- All VAD parameters exposed in UI for user tuning