# ADR-0004: Hybrid LLM→TTS Streaming with One-Chunk Buffer

**Date:** 2026-07-05  
**Status:** Accepted

## Context

The latency from "user finishes speaking" to "translated audio starts playing" is the most perceptible quality metric. If the LLM generates the full Korean text before sending to TTS, the user waits 1.5s+ in silence. For a real-time translator, this feels broken.

## Decision

Implement **hybrid streaming with one-chunk buffer**: split LLM output at Korean clause boundaries, send each chunk to ElevenLabs TTS incrementally, buffer one chunk ahead to prevent audio gaps.

## Rationale

### Latency Comparison

| Approach | Time to first audio | Feel |
|----------|-------------------|------|
| Wait for full LLM response | ~1.6s | Broken — silence gap |
| Stream chunks immediately | ~300ms | Live — natural |
| Hybrid one-chunk buffer | ~300ms first + no gaps | Best — live + seamless |

### Korean Clause Splitting

Korean has natural clause boundaries ideal for chunking:
- Commas: `,`
- Sentence endings: -습니다, -요, -다, -네, -ㅂ니다
- Conjunctions: 그리고, 그래서, 하지만, 그런데

Splitting on these produces natural-sounding TTS chunks of 5-15 characters each.

### ElevenLabs Streaming Support

ElevenLabs Flash v2.5 supports streaming output — audio playback begins before full TTS generation completes. Combined with LLM token streaming, the pipeline is fully streaming end-to-end.

### Why One-Chunk Buffer (Not Zero)?

Pure streaming (send chunk → play chunk → wait for next) can produce gaps between chunks if TTS generation for chunk N+1 takes longer than playback of chunk N. Buffering one chunk ahead ensures chunk N+1 is ready when chunk N finishes playing.

## Consequences

- Multiple ElevenLabs API calls per turn (one per chunk) — still within budget at $0.06/min
- Korean clause splitter needed (regex-based, simple)
- Audio playback queue on the phone must handle chunk concatenation seamlessly
- LLM prompt should instruct the model to output natural Korean with standard punctuation for reliable splitting