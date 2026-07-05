# Honjang

English ↔ Korean honorific voice translator. Real-time, two-way, hold-the-phone speaker mode.

## Architecture

```
Expo App (phone) ←WebSocket→ FastAPI (VPS)
                              ├── Silero VAD (local)
                              ├── Deepgram Nova-3 (STT API)
                              ├── OpenRouter (LLM API, any model)
                              ├── ElevenLabs Flash v2.5 (TTS API)
                              └── SQLite (session history)
```

## Modes

- **Pipeline** — tap to speak, tap to translate (walkie-talkie)
- **Raw Voice Agent** — always-on, auto-detects speech and translates

## Features

- Two-way EN↔KO translation with auto language detection
- Korean honorific awareness (junior→senior social context)
- Full barge-in (interrupt TTS by speaking)
- Configurable LLM (via OpenRouter), TTS (ElevenLabs), and VAD parameters
- Session history (text-only, stored on VPS)
- Hybrid LLM→TTS streaming for ~300ms first-audio latency

## Setup

See `docs/plans/2026-07-05-initial-implementation.md` for the full implementation plan.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env  # fill in API keys
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Documentation

- [PRD](docs/PRD.md) — product requirements
- [Context & Glossary](docs/CONTEXT.md) — domain terms
- [ADRs](docs/adr/) — architecture decisions
- [Implementation Plan](docs/plans/2026-07-05-initial-implementation.md) — 22 tasks, 9 slices

## Budget

All pipeline combos stay under 2,000 IDR/min (~$0.12/min). TTS (ElevenLabs) dominates at ~86% of cost.

## License

Personal use.