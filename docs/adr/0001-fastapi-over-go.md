# ADR-0001: FastAPI over Go for WebSocket Backend

**Date:** 2026-07-05  
**Status:** Accepted

## Context

The backend serves as a real-time relay between the mobile app (Expo) and three external APIs (Deepgram STT, OpenRouter LLM, ElevenLabs TTS). Audio is streamed over WebSocket in 80ms chunks. The primary concern was whether Python's FastAPI would introduce unacceptable WebSocket latency compared to Go.

## Decision

Use **FastAPI** (Python) as the backend framework, not Go.

## Rationale

### Latency Analysis

Benchmarks (July 2026) show FastAPI WebSocket per-message latency at **6-11ms p95** for low concurrency (1-50 connections). Go (gorilla/websocket) measures 8-19ms in the same range. The difference is noise.

Go's structural advantage (goroutines vs. asyncio event loop) only manifests at **500+ concurrent connections**, where Python's single-threaded event loop becomes a bottleneck. Our use case has **1 concurrent user**.

### Latency Budget

The total pipeline latency is 725-1250ms, dominated by API calls:

| Component | Latency | Share |
|-----------|---------|-------|
| FastAPI WebSocket relay | 6-11ms | <1% |
| Deepgram STT | 200-300ms | ~25% |
| LLM TTFT | 200-1000ms | ~40% |
| ElevenLabs TTS | 75-150ms | ~10% |

Rewriting the relay in Go would save ~0ms measurable.

### Ecosystem Advantage

Python has native SDKs for all three providers:
- **Silero VAD** — Python library, runs on CPU, <10ms latency
- **Deepgram** — official Python SDK with streaming WebSocket support
- **ElevenLabs** — official Python SDK with streaming TTS

In Go, all three would require community ports or hand-written HTTP clients, increasing development time and maintenance burden.

### Scale Path

If concurrent users ever exceed ~500, the WebSocket relay alone can be rewritten in Go as a separate service. The Python API clients (Deepgram, OpenRouter, ElevenLabs) remain unchanged. This is a non-issue for a personal translator app.

## Consequences

- Single language (Python) across the entire backend
- Native SDK support for all providers
- 6-11ms WebSocket overhead is negligible
- Scale ceiling at ~500 concurrent users (acceptable)