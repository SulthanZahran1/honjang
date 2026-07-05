# Honjang Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a two-way English↔Korean honorific voice translator app with pipeline and raw voice agent modes.

**Architecture:** Expo mobile app (thin client, audio capture/playback) ↔ WebSocket ↔ FastAPI VPS backend (relay + Silero VAD + Deepgram STT + OpenRouter LLM + ElevenLabs TTS + SQLite session history).

**Tech Stack:** Expo (React Native), FastAPI (Python), Silero VAD, Deepgram Nova-3, OpenRouter, ElevenLabs Flash v2.5, SQLite

---

## Problem Statement
## Solution
## User Stories
## Implementation Decisions
## Testing Decisions
## Out of Scope
## Further Notes

> See `docs/PRD.md` for full product requirements.
> See `docs/CONTEXT.md` for domain glossary.
> See `docs/adr/` for architecture decision records.

---

## Project Structure

```
honjang/
├── docs/
│   ├── PRD.md
│   ├── CONTEXT.md
│   ├── adr/
│   │   ├── 0001-fastapi-over-go.md
│   │   ├── 0002-hybrid-vad-architecture.md
│   │   ├── 0003-openrouter-as-llm-provider.md
│   │   └── 0004-hybrid-llm-tts-streaming.md
│   └── plans/
│       └── 2026-07-05-initial-implementation.md
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, WebSocket endpoint
│   │   ├── config.py            # Settings (env vars, defaults)
│   │   ├── websocket/
│   │   │   ├── __init__.py
│   │   │   ├── handler.py       # WS connection handler, orchestrates pipeline
│   │   │   └── protocol.py      # WS message types (client↔server)
│   │   ├── vad/
│   │   │   ├── __init__.py
│   │   │   ├── silero.py        # Silero VAD wrapper
│   │   │   └── heuristic.py     # VADHeuristic (from deepgram-eos-heuristics)
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   └── deepgram.py      # Deepgram Nova-3 streaming client
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── openrouter.py    # OpenRouter streaming client
│   │   │   ├── prompt.py        # System prompt assembly
│   │   │   └── chunker.py       # Korean clause boundary splitter
│   │   ├── tts/
│   │   │   ├── __init__.py
│   │   │   └── elevenlabs.py    # ElevenLabs streaming TTS client
│   │   ├── routing/
│   │   │   ├── __init__.py
│   │   │   └── language.py      # Language detection → direction routing
│   │   ├── session/
│   │   │   ├── __init__.py
│   │   │   ├── models.py        # SQLAlchemy models (Session, Turn)
│   │   │   └── store.py         # SQLite session/turn persistence
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── test_heuristic.py
│   │       ├── test_language.py
│   │       ├── test_chunker.py
│   │       ├── test_prompt.py
│   │       └── test_store.py
├── mobile/
│   ├── app.json
│   ├── package.json
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ConversationScreen.tsx
│   │   │   ├── SettingsScreen.tsx
│   │   │   └── HistoryScreen.tsx
│   │   ├── components/
│   │   │   ├── ModeToggle.tsx
│   │   │   ├── DirectionButtons.tsx
│   │   │   ├── TranscriptView.tsx
│   │   │   └── VADSettingsPanel.tsx
│   │   ├── services/
│   │   │   ├── WebSocketService.ts
│   │   │   ├── AudioService.ts
│   │   │   └── SettingsService.ts
│   │   ├── hooks/
│   │   │   └── useTranslator.ts
│   │   └── types/
│   │       └── protocol.ts
│   └── assets/
└── README.md
```

---

## Slice 1: Backend Scaffold + Config (AFK)

### Task 1: Initialize Python project with dependencies

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "honjang-backend"
version = "0.1.0"
description = "English↔Korean honorific voice translator backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "websockets>=12.0",
    "deepgram-sdk>=3.0.0",
    "httpx>=0.27.0",
    "silero-vad>=0.1.0",
    "sqlalchemy>=2.0.0",
    "aiosqlite>=0.20.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0.0", "pytest-asyncio>=0.23.0", "pytest-httpx>=0.30.0"]
```

**Step 2: Create .env.example**

```env
DEEPGRAM_API_KEY=your_deepgram_key
OPENROUTER_API_KEY=your_openrouter_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
DEFAULT_LLM_MODEL=google/gemini-3.1-flash-lite
DEFAULT_TTS_MODEL=eleven_flash_v2_5
VPS_HOST=0.0.0.0
VPS_PORT=8000
SQLITE_PATH=honjang.db
```

**Step 3: Create app/__init__.py**

```python
# empty
```

**Step 4: Setup venv and install**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "chore: initialize backend project with dependencies"
```

---

### Task 2: Config module with Pydantic Settings

**Files:**
- Create: `backend/app/config.py`
- Test: `backend/app/tests/test_config.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_config.py
import os
from app.config import Settings

def test_settings_loads_from_env():
    os.environ["DEEPGRAM_API_KEY"] = "test_dg"
    os.environ["OPENROUTER_API_KEY"] = "test_or"
    os.environ["ELEVENLABS_API_KEY"] = "test_el"
    os.environ["ELEVENLABS_VOICE_ID"] = "voice123"
    s = Settings()
    assert s.deepgram_api_key == "test_dg"
    assert s.openrouter_api_key == "test_or"
    assert s.elevenlabs_api_key == "test_el"
    assert s.elevenlabs_voice_id == "voice123"
    assert s.default_llm_model == "google/gemini-3.1-flash-lite"
    assert s.vad_min_silence_ms == 450
    assert s.vad_pause_threshold == 1.2
    assert s.vad_utterance_end_ms == 1200
```

**Step 2: Run test to verify failure**

```bash
pytest app/tests/test_config.py -v
```
Expected: FAIL — module not found

**Step 3: Write implementation**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    deepgram_api_key: str = ""
    openrouter_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    default_llm_model: str = "google/gemini-3.1-flash-lite"
    default_tts_model: str = "eleven_flash_v2_5"
    vps_host: str = "0.0.0.0"
    vps_port: int = 8000
    sqlite_path: str = "honjang.db"

    # VAD defaults (Korean-tuned, user-configurable)
    vad_min_silence_ms: int = 450
    vad_pause_threshold: float = 1.2
    vad_utterance_end_ms: int = 1200
    vad_endpointing_ms: int = 450
    vad_activation_threshold: float = 0.6

    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 4: Run test to verify pass**

```bash
pytest app/tests/test_config.py -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add app/config.py app/tests/test_config.py
git commit -m "feat: add config module with Korean-tuned VAD defaults"
```

---

## Slice 2: VAD Heuristic + Silero Wrapper (AFK)

### Task 3: Silero VAD wrapper

**Files:**
- Create: `backend/app/vad/__init__.py`
- Create: `backend/app/vad/silero.py`
- Test: `backend/app/tests/test_vad_silero.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_vad_silero.py
import numpy as np
from app.vad.silero import SileroVAD

def test_vad_detects_silence():
    vad = SileroVAD(min_silence_ms=450, threshold=0.6)
    # 1 second of silence (zeros)
    audio = np.zeros(16000, dtype=np.float32)
    events = vad.process(audio)
    assert events == []  # no speech events for pure silence

def test_vad_detects_speech_start():
    vad = SileroVAD(min_silence_ms=450, threshold=0.6)
    # 1 second of noise (simulated speech)
    audio = np.random.randn(16000).astype(np.float32) * 0.3
    events = vad.process(audio)
    assert any(e["type"] == "speech_start" for e in events)
```

**Step 2: Run test to verify failure**

```bash
pytest app/tests/test_vad_silero.py -v
```

**Step 3: Write implementation**

```python
# backend/app/vad/silero.py
import numpy as np
from collections import deque

class SileroVAD:
    def __init__(self, min_silence_ms: int = 450, threshold: float = 0.6,
                 sample_rate: int = 16000, chunk_ms: int = 32):
        self.min_silence_ms = min_silence_ms
        self.threshold = threshold
        self.sample_rate = sample_rate
        self.chunk_size = int(sample_rate * chunk_ms / 1000)
        self.is_speaking = False
        self.silence_frames = 0
        self.frames_needed = int(min_silence_ms / chunk_ms)
        # Load model lazily
        self._model = None
        self._iterator = None

    def _load_model(self):
        import torch
        model, utils = torch.hub.load(
            "snakers4/silero-vad", "silero_vad", trust_repo=True
        )
        self._model = model
        get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks = utils
        self._iterator = VADIterator(
            model,
            threshold=self.threshold,
            min_silence_duration_ms=self.min_silence_ms,
            speech_pad_ms=200,
        )

    def process(self, audio: np.ndarray) -> list[dict]:
        if self._model is None:
            self._load_model()
        import torch
        events = []
        # Process in chunks
        for i in range(0, len(audio), self.chunk_size):
            chunk = audio[i:i + self.chunk_size]
            if len(chunk) < self.chunk_size:
                break
            tensor = torch.from_numpy(chunk)
            speech_dict = self._iterator(tensor, return_seconds=True)
            if speech_dict:
                if not self.is_speaking:
                    self.is_speaking = True
                    events.append({"type": "speech_start", "timestamp": speech_dict.get("start", 0)})
                # Reset silence counter
                self.silence_frames = 0
            else:
                if self.is_speaking:
                    self.silence_frames += 1
                    if self.silence_frames >= self.frames_needed:
                        self.is_speaking = False
                        events.append({"type": "speech_end", "timestamp": i / self.sample_rate})
        return events
```

**Step 4: Run test to verify pass**

**Step 5: Commit**

```bash
git add app/vad/ app/tests/test_vad_silero.py
git commit -m "feat: add Silero VAD wrapper with Korean-tuned defaults"
```

---

### Task 4: VAD Heuristic (endpoint decision logic)

**Files:**
- Create: `backend/app/vad/heuristic.py`
- Test: `backend/app/tests/test_heuristic.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_heuristic.py
from app.vad.heuristic import VADHeuristic

def test_no_endpoint_when_speech_detected():
    h = VADHeuristic(pause_threshold=1.2)
    h.audio_cursor = 5.0
    h.process({"event_type": "vad_event", "audio_cursor": 5.0,
               "data": {"type": "speech_start"}})
    assert not h.vad_endpoint_needed()

def test_endpoint_after_speech_end_with_utterance():
    h = VADHeuristic(pause_threshold=1.2)
    h.audio_cursor = 5.0
    # Build up an utterance
    h.process({"event_type": "transcript", "audio_cursor": 4.0,
               "data": {"is_final": True, "speech_final": False,
                        "words": [{"start": 3.5, "end": 4.0, "word": "안녕"}]}})
    h.process({"event_type": "vad_event", "audio_cursor": 5.0,
               "data": {"type": "speech_end"}})
    assert h.vad_endpoint_needed()
    h.endpoint_current_utterance()
    assert len(h.completed_utterances) == 1

def test_no_endpoint_without_utterance():
    h = VADHeuristic(pause_threshold=1.2)
    h.process({"event_type": "vad_event", "audio_cursor": 5.0,
               "data": {"type": "speech_end"}})
    assert not h.vad_endpoint_needed()
```

**Step 2: Run test to verify failure**

**Step 3: Write implementation** (adapted from Deepgram's reference)

```python
# backend/app/vad/heuristic.py
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class VADHeuristic:
    pause_threshold: float = 1.2
    vad_speech_detected: bool = False
    vad_speech_end_at: Optional[float] = None
    current_utterance: str = ""
    current_utterance_start: Optional[float] = None
    current_interim_utterance: str = ""
    interim_endpointed: bool = False
    completed_utterances: list = field(default_factory=list)
    last_word_end: Optional[float] = None
    audio_cursor: float = 0.0

    def process(self, event: dict):
        et = event["event_type"]
        if et == "vad_event":
            self._handle_vad_event(event["data"])
        elif et == "transcript":
            self._handle_transcript(event["data"])
        elif et == "utterance_end":
            self._handle_utterance_end(event["data"])

    def _handle_vad_event(self, data: dict):
        if data.get("type") == "speech_start":
            self.vad_speech_detected = True
        elif data.get("type") == "speech_end":
            self.vad_speech_detected = False
            self.vad_speech_end_at = self.audio_cursor

    def _handle_transcript(self, data: dict):
        words = data.get("words", [])
        if words:
            self.last_word_end = words[-1].get("end")
            word_text = " ".join(w.get("word", "") for w in words)
        else:
            word_text = ""

        if data.get("speech_final"):
            self.current_utterance += (" " + word_text if self.current_utterance else word_text)
            self.interim_endpointed = False
        elif data.get("is_final"):
            self.current_utterance += (" " + word_text if self.current_utterance else word_text)
        else:
            self.current_interim_utterance = word_text

    def _handle_utterance_end(self, data: dict):
        if self.current_utterance and not self.interim_endpointed:
            self.endpoint_current_utterance()

    def vad_endpoint_needed(self) -> bool:
        return (not self.vad_speech_detected
                and not self.interim_endpointed
                and bool(self.current_utterance)
                and self.vad_speech_end_at is not None)

    def utterance_endpoint_needed(self) -> bool:
        if self.vad_speech_detected or self.interim_endpointed or not self.current_utterance:
            return False
        if self.last_word_end is None:
            return False
        return (self.audio_cursor - self.last_word_end) > self.pause_threshold

    def endpoint_current_utterance(self):
        if self.current_interim_utterance and not self.interim_endpointed:
            self.current_utterance += (" " + self.current_interim_utterance
                                       if self.current_utterance
                                       else self.current_interim_utterance)
        self.completed_utterances.append({
            "text": self.current_utterance.strip(),
            "start": self.current_utterance_start,
            "end": self.audio_cursor,
        })
        self.current_utterance = ""
        self.current_interim_utterance = ""
        self.interim_endpointed = False
        self.current_utterance_start = None
```

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add app/vad/heuristic.py app/tests/test_heuristic.py
git commit -m "feat: add VAD heuristic with three-signal endpoint detection"
```

---

## Slice 3: Language Routing (AFK)

### Task 5: Language detection → direction routing

**Files:**
- Create: `backend/app/routing/__init__.py`
- Create: `backend/app/routing/language.py`
- Test: `backend/app/tests/test_language.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_language.py
from app.routing.language import determine_direction, LanguageRouter

def test_english_routes_to_en_to_ko():
    router = LanguageRouter()
    direction = router.route("en", "Hello, I need to push the deadline")
    assert direction == "en_to_ko"

def test_korean_routes_to_ko_to_en():
    router = LanguageRouter()
    direction = router.route("ko", "마감일을 미뤄야 합니다")
    assert direction == "ko_to_en"

def test_code_switch_prioritizes_ko_to_en():
    router = LanguageRouter()
    # Mixed sentence with Korean — senior is speaking
    direction = router.route("en", "I need to API를 호출해야 해요")
    # Any Korean detected → KO→EN
    assert direction == "ko_to_en"

def test_unknown_language_uses_sticky():
    router = LanguageRouter(last_direction="en_to_ko")
    direction = router.route("ja", "こんにちは")
    assert direction == "en_to_ko"  # falls back to last

def test_no_korean_in_short_utterance():
    router = LanguageRouter()
    direction = router.route("en", "yes")
    assert direction == "en_to_ko"
```

**Step 2: Run test to verify failure**

**Step 3: Write implementation**

```python
# backend/app/routing/language.py
import re

KOREAN_PATTERN = re.compile(r'[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]')

class LanguageRouter:
    def __init__(self, last_direction: str | None = None):
        self.last_direction = last_direction

    def route(self, detected_language: str, transcript: str) -> str:
        # Code-switch rule: any Korean → KO→EN (senior is speaking)
        if KOREAN_PATTERN.search(transcript):
            return "ko_to_en"

        if detected_language == "ko":
            return "ko_to_en"
        elif detected_language == "en":
            return "en_to_ko"
        else:
            # Sticky fallback
            return self.last_direction or "en_to_ko"

def determine_direction(detected_language: str, transcript: str,
                        last_direction: str | None = None) -> str:
    router = LanguageRouter(last_direction)
    return router.route(detected_language, transcript)
```

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add app/routing/ app/tests/test_language.py
git commit -m "feat: add language routing with code-switch KO→EN priority"
```

---

## Slice 4: LLM Prompt + Korean Clause Chunker (AFK)

### Task 6: System prompt assembly

**Files:**
- Create: `backend/app/llm/__init__.py`
- Create: `backend/app/llm/prompt.py`
- Test: `backend/app/tests/test_prompt.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_prompt.py
from app.llm.prompt import build_system_prompt, PromptConfig

def test_default_prompt_has_junior_senior():
    config = PromptConfig()
    prompt = build_system_prompt(config)
    assert "junior" in prompt.lower()
    assert "senior" in prompt.lower()
    assert "auto" in prompt.lower() or "appropriate" in prompt.lower()

def test_prompt_includes_context():
    config = PromptConfig(
        context="My team lead at LG Sinarmas, we've worked together for 2 years",
        topic="discussing a semiconductor CIM project deadline"
    )
    prompt = build_system_prompt(config)
    assert "LG Sinarmas" in prompt
    assert "semiconductor CIM" in prompt

def test_prompt_specifies_direction_en_to_ko():
    config = PromptConfig()
    prompt = build_system_prompt(config, direction="en_to_ko")
    assert "English to Korean" in prompt or "EN→KO" in prompt

def test_prompt_specifies_direction_ko_to_en():
    config = PromptConfig()
    prompt = build_system_prompt(config, direction="ko_to_en")
    assert "Korean to English" in prompt or "KO→EN" in prompt
```

**Step 2: Run test to verify failure**

**Step 3: Write implementation**

```python
# backend/app/llm/prompt.py
from dataclasses import dataclass

@dataclass
class PromptConfig:
    user_role: str = "a junior employee"
    senior_role: str = "a senior colleague in Korea"
    politeness_level: str = "auto"  # auto, 합쇼체, 해요체
    context: str = ""
    topic: str = "technical stuff"

def build_system_prompt(config: PromptConfig, direction: str = "en_to_ko") -> str:
    politeness_instruction = {
        "auto": "Select the appropriate Korean politeness level (합쇼체 or 해요체) based on the context and tone of the conversation.",
        "합쇼체": "Use 합쇼체 (formal deferential, -습니다/ㅂ니다 endings) for all Korean output.",
        "해요체": "Use 해요체 (polite, -아요/어요 endings) for all Korean output.",
    }.get(config.politeness_level, "Select the appropriate Korean politeness level based on context.")

    direction_instruction = {
        "en_to_ko": "Translate the user's English speech INTO Korean.",
        "ko_to_en": "Translate the Korean speech INTO English.",
    }.get(direction, "Translate the input to the other language.")

    context_block = f"\nContext: {config.context}\n" if config.context else ""

    return f"""You are a real-time voice translator between {config.user_role} and {config senior_role}.
{context_block}
Current topic: {config.topic}

{direction_instruction}

Rules:
- {politeness_instruction}
- Preserve the meaning and tone of the original speech.
- Output ONLY the translation. No explanations, no notes, no preamble.
- If the input is ambiguous, make the most reasonable interpretation based on context.
- For Korean output, use standard punctuation (commas, periods) to mark natural clause boundaries.
- Keep translations concise and natural for spoken conversation."""
```

Note: fix the `config senior_role` typo — should be `config.senior_role`.

**Step 4: Run tests, fix typo**

**Step 5: Commit**

```bash
git add app/llm/prompt.py app/tests/test_prompt.py
git commit -m "feat: add system prompt assembly with honorific context injection"
```

---

### Task 7: Korean clause boundary chunker

**Files:**
- Create: `backend/app/llm/chunker.py`
- Test: `backend/app/tests/test_chunker.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_chunker.py
from app.llm.chunker import split_korean_clauses

def test_split_on_comma():
    chunks = split_korean_clauses("선배님, 마감일을 미뤄야 할 것 같습니다")
    assert len(chunks) == 2
    assert "선배님" in chunks[0]
    assert "마감일을" in chunks[1]

def test_split_on_sentence_ending():
    chunks = split_korean_clauses("죄송합니다. 다음 주까지 하겠습니다.")
    assert len(chunks) == 2

def test_split_on_conjunction():
    chunks = split_korean_clauses("내일 미팅이 있습니다 그리고 자료를 준비해야 합니다")
    assert len(chunks) >= 2

def test_single_chunk_no_split_point():
    chunks = split_korean_clauses("안녕하세요")
    assert len(chunks) == 1
    assert chunks[0] == "안녕하세요"

def test_empty_string():
    chunks = split_korean_clauses("")
    assert chunks == []

def test_preserves_text():
    text = "선배님, 마감일을 미뤄야 할 것 같습니다"
    chunks = split_korean_clauses(text)
    assert "".join(chunks).replace(" ", "") == text.replace(" ", "")
```

**Step 2: Run test to verify failure**

**Step 3: Write implementation**

```python
# backend/app/llm/chunker.py
import re

# Korean sentence endings: -습니다, -ㅂ니다, -요, -다, -네, -ㅂ니다
# Plus commas and conjunctions
SPLIT_PATTERN = re.compile(
    r'([,\.]\s*)'  # commas and periods with trailing space
    r'|(?<=[습니다다네요])\s+'  # space after sentence endings
    r'|(그리고|그래서|하지만|그런데|그러나|또는)\s+'  # conjunctions
)

def split_korean_clauses(text: str) -> list[str]:
    if not text.strip():
        return []

    # Split and rejoin delimiters with preceding chunk
    parts = SPLIT_PATTERN.split(text)

    chunks = []
    current = ""
    for part in parts:
        if part is None:
            continue
        if SPLIT_PATTERN.fullmatch(part or ""):
            current += part
        else:
            if current:
                chunks.append(current)
            current = part

    if current.strip():
        chunks.append(current)

    # Clean up
    return [c.strip() for c in chunks if c.strip()]
```

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add app/llm/chunker.py app/tests/test_chunker.py
git commit -m "feat: add Korean clause boundary splitter for LLM→TTS streaming"
```

---

## Slice 5: Session Storage (AFK)

### Task 8: SQLite session models and store

**Files:**
- Create: `backend/app/session/__init__.py`
- Create: `backend/app/session/models.py`
- Create: `backend/app/session/store.py`
- Test: `backend/app/tests/test_store.py`

**Step 1: Write failing test**

```python
# backend/app/tests/test_store.py
import pytest
import asyncio
from app.session.store import SessionStore

@pytest.fixture
async def store():
    s = SessionStore("sqlite+aiosqlite:///:memory:")
    await s.init()
    return s

@pytest.mark.asyncio
async def test_create_session(store):
    session_id = await store.create_session(llm_model="google/gemini-3.1-flash-lite")
    assert session_id is not None

@pytest.mark.asyncio
async def test_add_turn(store):
    session_id = await store.create_session(llm_model="test-model")
    await store.add_turn(
        session_id=session_id,
        direction="en_to_ko",
        original_text="Hello",
        translated_text="안녕하세요",
        detected_language="en",
    )
    turns = await store.get_session_turns(session_id)
    assert len(turns) == 1
    assert turns[0]["original_text"] == "Hello"
    assert turns[0]["translated_text"] == "안녕하세요"

@pytest.mark.asyncio
async def test_list_sessions(store):
    s1 = await store.create_session(llm_model="model-a")
    s2 = await store.create_session(llm_model="model-b")
    sessions = await store.list_sessions()
    assert len(sessions) == 2

@pytest.mark.asyncio
async def test_end_session(store):
    session_id = await store.create_session(llm_model="test")
    await store.end_session(session_id)
    sessions = await store.list_sessions()
    assert sessions[0]["ended_at"] is not None
```

**Step 2: Run test to verify failure**

**Step 3: Write implementation**

```python
# backend/app/session/models.py
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    llm_model = Column(String, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

class Turn(Base):
    __tablename__ = "turns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    direction = Column(String, nullable=False)  # en_to_ko, ko_to_en
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    detected_language = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
```

```python
# backend/app/session/store.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, update
from app.session.models import Base, Session, Turn

class SessionStore:
    def __init__(self, db_url: str):
        self.engine = create_async_engine(db_url)
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def init(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create_session(self, llm_model: str) -> int:
        async with self.sessionmaker() as session:
            sess = Session(llm_model=llm_model)
            session.add(sess)
            await session.commit()
            return sess.id

    async def add_turn(self, session_id: int, direction: str,
                       original_text: str, translated_text: str,
                       detected_language: str | None = None):
        async with self.sessionmaker() as session:
            turn = Turn(
                session_id=session_id,
                direction=direction,
                original_text=original_text,
                translated_text=translated_text,
                detected_language=detected_language,
            )
            session.add(turn)
            await session.commit()

    async def get_session_turns(self, session_id: int) -> list[dict]:
        async with self.sessionmaker() as session:
            result = await session.execute(
                select(Turn).where(Turn.session_id == session_id).order_by(Turn.id)
            )
            return [{
                "id": t.id,
                "direction": t.direction,
                "original_text": t.original_text,
                "translated_text": t.translated_text,
                "detected_language": t.detected_language,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            } for t in result.scalars()]

    async def list_sessions(self) -> list[dict]:
        async with self.sessionmaker() as session:
            result = await session.execute(
                select(Session).order_by(Session.id.desc())
            )
            return [{
                "id": s.id,
                "llm_model": s.llm_model,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            } for s in result.scalars()]

    async def end_session(self, session_id: int):
        from datetime import datetime
        async with self.sessionmaker() as session:
            await session.execute(
                update(Session).where(Session.id == session_id).values(ended_at=datetime.utcnow())
            )
            await session.commit()
```

**Step 4: Run tests**

**Step 5: Commit**

```bash
git add app/session/ app/tests/test_store.py
git commit -m "feat: add SQLite session store with async SQLAlchemy"
```

---

## Slice 6: External API Clients (AFK)

### Task 9: Deepgram Nova-3 streaming STT client

**Files:**
- Create: `backend/app/stt/__init__.py`
- Create: `backend/app/stt/deepgram.py`

**Implementation:** Wrapper around Deepgram Python SDK for Nova-3 multilingual streaming. Handles WebSocket connection, sends audio chunks, emits transcript events (interim, final, speech_final, utterance_end). Configurable endpointing and utterance_end_ms.

**Commit:**

```bash
git commit -m "feat: add Deepgram Nova-3 streaming STT client"
```

### Task 10: OpenRouter LLM streaming client

**Files:**
- Create: `backend/app/llm/openrouter.py`

**Implementation:** HTTP streaming client (httpx) for OpenRouter chat completions. Streams tokens via SSE. Accepts model ID, system prompt, conversation history. Returns token stream for chunker.

**Commit:**

```bash
git commit -m "feat: add OpenRouter streaming LLM client"
```

### Task 11: ElevenLabs TTS streaming client

**Files:**
- Create: `backend/app/tts/__init__.py`
- Create: `backend/app/tts/elevenlabs.py`

**Implementation:** HTTP streaming client for ElevenLabs TTS. Supports Flash v2.5 and v3 models. Returns audio chunks for playback. Configurable voice ID.

**Commit:**

```bash
git commit -m "feat: add ElevenLabs streaming TTS client"
```

---

## Slice 7: WebSocket Orchestrator (AFK)

### Task 12: WebSocket protocol definition

**Files:**
- Create: `backend/app/websocket/__init__.py`
- Create: `backend/app/websocket/protocol.py`

**Implementation:** Pydantic models for client↔server WS messages: audio_chunk, transcript, translation, audio_output, settings_update, mode_change, direction_change, session_start, session_end, error.

**Commit:**

```bash
git commit -m "feat: add WebSocket protocol message types"
```

### Task 13: WebSocket handler — pipeline orchestration

**Files:**
- Create: `backend/app/websocket/handler.py`

**Implementation:** The core orchestrator. For each WS connection:
1. Create session in SQLite
2. Start Silero VAD thread
3. Open Deepgram streaming connection
4. Receive audio chunks → send to Silero + Deepgram in parallel
5. On VAD endpoint or manual tap → collect transcript → route direction → call OpenRouter LLM (stream) → chunk output → call ElevenLabs TTS (stream) → send audio back to phone
6. Handle barge-in: if VAD detects speech during TTS playback, stop TTS, start new STT cycle
7. Store each turn in SQLite
8. On disconnect → end session

**Commit:**

```bash
git commit -m "feat: add WebSocket handler with full pipeline orchestration"
```

### Task 14: FastAPI app + WebSocket endpoint

**Files:**
- Create: `backend/app/main.py`

**Implementation:** FastAPI app with:
- `GET /health` — health check
- `WS /ws` — WebSocket endpoint for translator session
- `GET /api/sessions` — list past sessions
- `GET /api/sessions/{id}/turns` — get session transcript
- CORS for Expo app

**Commit:**

```bash
git commit -m "feat: add FastAPI app with WebSocket and session API endpoints"
```

---

## Slice 8: Expo Mobile App (AFK)

### Task 15: Expo project scaffold

**Files:**
- Create: `mobile/package.json`, `mobile/app.json`, `mobile/App.tsx`
- Create: `mobile/src/types/protocol.ts`

**Implementation:** Initialize Expo project (TypeScript), install expo-audio, navigation (React Navigation), state management. Define TS types matching backend WS protocol.

**Commit:**

```bash
git commit -m "feat: initialize Expo mobile app with TypeScript"
```

### Task 16: WebSocket + Audio services

**Files:**
- Create: `mobile/src/services/WebSocketService.ts`
- Create: `mobile/src/services/AudioService.ts`

**Implementation:**
- WebSocketService: connect to VPS WS, send/receive protocol messages, reconnect logic
- AudioService: capture mic via expo-audio with AEC, stream 16kHz linear16 chunks to WS, play TTS audio chunks from WS, stop playback on barge-in

**Commit:**

```bash
git commit -m "feat: add WebSocket and Audio services for mobile"
```

### Task 17: Conversation screen

**Files:**
- Create: `mobile/src/screens/ConversationScreen.tsx`
- Create: `mobile/src/components/ModeToggle.tsx`
- Create: `mobile/src/components/DirectionButtons.tsx`
- Create: `mobile/src/components/TranscriptView.tsx`
- Create: `mobile/src/hooks/useTranslator.ts`

**Implementation:** Main screen with:
- Mode toggle (Pipeline / Raw Voice Agent)
- Direction buttons (EN→KO / KO→EN / Auto) — visible in both modes
- LLM role toggle (Pure Translator / Conversational Interpreter)
- Live transcript view (original + translated, scrollable)
- Detected language indicator
- Push-to-talk button (pipeline mode)
- Always-on indicator (raw voice agent mode)

**Commit:**

```bash
git commit -m "feat: add conversation screen with mode/direction controls"
```

### Task 18: Settings screen

**Files:**
- Create: `mobile/src/screens/SettingsScreen.tsx`
- Create: `mobile/src/components/VADSettingsPanel.tsx`
- Create: `mobile/src/services/SettingsService.ts`

**Implementation:** Settings screen with:
- LLM model dropdown (OpenRouter models)
- TTS model toggle (Flash v2.5 / v3)
- ElevenLabs voice ID
- Relationship context fields (user role, senior role, politeness, context text, topic)
- VAD parameters (silence threshold, pause threshold, utterance end timeout, activation threshold) — all sliders
- VPS URL field

**Commit:**

```bash
git commit -m "feat: add settings screen with LLM/TTS/VAD/relationship config"
```

### Task 19: History screen

**Files:**
- Create: `mobile/src/screens/HistoryScreen.tsx`

**Implementation:** List past sessions from VPS API, tap to view full transcript with timestamps and direction indicators.

**Commit:**

```bash
git commit -m "feat: add session history screen"
```

---

## Slice 9: Integration & E2E (HITL)

### Task 20: Backend integration test — full pipeline

**HITL** — requires API keys.

Test the full pipeline: audio in → VAD → STT → routing → LLM → chunker → TTS → audio out. Use a sample audio file with English speech, verify Korean TTS audio is produced.

### Task 21: Manual E2E — real conversation test

**HITL** — requires Korean speaker for verification.

Test with actual English→Korean conversation:
- Verify honorific level is appropriate
- Verify barge-in works (senior speaks while TTS is playing)
- Verify auto-detect routes correctly
- Verify session history is saved
- Measure total latency (target: <1.5s pipeline, <500ms streaming first audio)

### Task 22: README + deployment docs

**Files:**
- Create: `README.md`

**Implementation:** Setup instructions, env vars, deployment to VPS, Expo build instructions.

**Commit:**

```bash
git commit -m "docs: add README with setup and deployment instructions"
```

---

## Execution Notes

- Slices 1-6 are pure backend, no API keys needed (mockable)
- Slice 6 (API clients) can be tested with mocks
- Slice 7 (orchestrator) ties everything together
- Slice 8 (mobile) can be developed in parallel with Slice 7
- Slice 9 requires real API keys and a Korean speaker

**Estimated total: 22 tasks across 9 slices.**