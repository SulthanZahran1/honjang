# ADR-0003: OpenRouter as LLM Provider

**Date:** 2026-07-05  
**Status:** Accepted

## Context

The LLM is the core of Korean honorific translation. Different models excel at different aspects: Claude Sonnet 4.6 is best at honorific register, Gemini 3.1 Flash Lite won the Korean multi-turn context translation benchmark (April 2026), GPT-5 mini is a cheap middle ground. The user needs to switch models based on the conversation (e.g., Claude for nuanced honorific conversations, Flash Lite for fast casual exchanges).

## Decision

Use **OpenRouter** as the single LLM API gateway. The user selects any model at runtime via the app settings.

## Rationale

### Multi-Model Need

No single LLM wins on all axes:

| Model | Honorifics | Multi-turn KO | Latency | Cost/M |
|-------|-----------|--------------|---------|--------|
| Claude Sonnet 4.6 | Best | Very good | ~1000ms | $3/$15 |
| Gemini 3.1 Flash Lite | Good | Best (#1 benchmark) | ~200ms | $0.25/$1.50 |
| GPT-5 mini | Moderate | Good | ~650ms | $0.25/$2.00 |

Pipeline mode benefits from Claude's honorific accuracy (latency irrelevant). Raw voice agent mode benefits from Flash Lite's 200ms TTFT and multi-turn context. The user needs both.

### Single API Key

OpenRouter provides one API key, one SDK, one billing surface for all models. No multi-vendor SDK juggling, no separate auth for Google/Anthropic/OpenAI.

### Cost Irrelevance of Model Choice

At our token volume (~400 input + ~200 output tokens/min), the LLM cost difference between cheapest (Flash Lite, $0.0004/min) and most expensive (Claude Sonnet, $0.0042/min) is **$0.0038/min — ~62 IDR/min**. TTS ($0.06/min) dominates 86% of the budget. Model choice is a quality/latency decision, not a cost decision.

### Configurability

The model ID is a string passed to OpenRouter (e.g., `google/gemini-3.1-flash-lite`, `anthropic/claude-sonnet-4.6`). Switching models is a UI dropdown change — no code changes, no redeployment.

## Consequences

- LLM provider is fully user-configurable at runtime
- Single dependency: OpenRouter API (if OpenRouter is down, all LLM models are down)
- System prompt is model-agnostic — works across all models
- Future models are automatically available when added to OpenRouter