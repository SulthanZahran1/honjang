"""WebSocket handler — full pipeline orchestration for Honjang.

Orchestrates: audio reception → Silero VAD → Deepgram STT → language routing
→ OpenRouter LLM streaming → Korean clause chunking → ElevenLabs TTS streaming
→ audio output to client. Handles barge-in, session persistence, and settings.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any

import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from app.config import Settings
from app.llm.chunker import split_korean_clauses
from app.llm.openrouter import OpenRouterLLM
from app.llm.prompt import PromptConfig, build_system_prompt
from app.routing.language import LanguageRouter
from app.session.store import SessionStore
from app.stt.deepgram import DeepgramSTT
from app.tts.elevenlabs import ElevenLabsTTS
from app.vad.heuristic import VADHeuristic
from app.vad.silero import SileroVAD
from app.websocket.protocol import (
    AudioChunk,
    AudioOutput,
    DirectionChange,
    Error,
    ModeChange,
    SessionEnd,
    SessionStart,
    SettingsUpdate,
    TranscriptUpdate,
    TranslationResult,
    parse_client_message,
)

logger = logging.getLogger(__name__)


class WebSocketHandler:
    """Orchestrates the full translation pipeline for one WS connection."""

    def __init__(
        self,
        settings: Settings,
        session_store: SessionStore,
    ):
        self.settings = settings
        self.session_store = session_store

    async def handle(self, ws: WebSocket) -> None:
        """Handle a single WebSocket connection lifecycle.

        Steps:
        1. Accept connection, create session
        2. Initialize VAD, heuristic, STT, LLM, TTS clients
        3. Receive audio chunks → VAD + Deepgram in parallel
        4. On endpoint → transcript → route → LLM stream → chunk → TTS stream → audio back
        5. Barge-in: stop TTS on new speech
        6. Store turns in SQLite
        7. End session on disconnect
        """
        await ws.accept()

        # Create session
        session_id = await self.session_store.create_session(
            llm_model=self.settings.default_llm_model
        )
        await ws.send_text(
            SessionStart(session_id=session_id).model_dump_json()
        )

        # Mutable session state
        state = SessionState(
            session_id=session_id,
            settings=self.settings,
            session_store=self.session_store,
            ws=ws,
        )

        # Set up Deepgram callbacks
        stt = state.stt
        stt.on_transcript = state.handle_transcript
        stt.on_utterance_end = state.handle_utterance_end
        stt.on_error = state.handle_stt_error

        # Connect Deepgram
        try:
            await stt.connect()
        except Exception as exc:
            logger.error("Deepgram connection failed: %s", exc)
            await ws.send_text(
                Error(message=f"STT connection failed: {exc}", code="stt_connect").model_dump_json()
            )
            await self.session_store.end_session(session_id)
            await ws.close()
            return

        # Main receive loop
        try:
            while True:
                raw = await ws.receive_text()
                data = json.loads(raw)
                msg = parse_client_message(data)

                if isinstance(msg, AudioChunk):
                    asyncio.create_task(state.process_audio(msg))
                elif isinstance(msg, SettingsUpdate):
                    state.apply_settings(msg)
                elif isinstance(msg, ModeChange):
                    state.mode = msg.mode
                elif isinstance(msg, DirectionChange):
                    state.manual_direction = msg.direction
                elif isinstance(msg, SessionEnd):
                    break
        except WebSocketDisconnect:
            logger.info("Client disconnected (session %d)", session_id)
        except Exception as exc:
            logger.error("WS handler error: %s", exc)
        finally:
            await stt.disconnect()
            await self.session_store.end_session(session_id)
            await ws.send_text(
                SessionEnd(session_id=session_id).model_dump_json()
            )


class SessionState:
    """Per-session mutable state for the pipeline."""

    def __init__(
        self,
        session_id: int,
        settings: Settings,
        session_store: SessionStore,
        ws: WebSocket,
    ):
        self.session_id = session_id
        self.settings = settings
        self.session_store = session_store
        self.ws = ws

        # Pipeline components
        self.vad = SileroVAD(
            min_silence_ms=settings.vad_min_silence_ms,
            threshold=settings.vad_activation_threshold,
        )
        self.heuristic = VADHeuristic(pause_threshold=settings.vad_pause_threshold)
        self.stt = DeepgramSTT(
            api_key=settings.deepgram_api_key,
            endpointing=settings.vad_endpointing_ms,
            utterance_end_ms=settings.vad_utterance_end_ms,
        )
        self.llm = OpenRouterLLM(api_key=settings.openrouter_api_key)
        self.tts = ElevenLabsTTS(
            api_key=settings.elevenlabs_api_key,
            default_voice_id=settings.elevenlabs_voice_id,
        )

        # Routing
        self.language_router = LanguageRouter()
        self.manual_direction: str | None = None  # None = auto-detect
        self.mode: str = "raw_voice_agent"  # or "pipeline"

        # Prompt config (mutable via settings)
        self.prompt_config = PromptConfig()

        # TTS barge-in control
        self._tts_task: asyncio.Task | None = None
        self._is_speaking_tts = False

        # Audio cursor for VAD timestamps
        self._audio_cursor = 0.0

    async def process_audio(self, msg: AudioChunk) -> None:
        """Process an incoming audio chunk: send to STT and run VAD."""
        audio_bytes = base64.b64decode(msg.audio)
        # Send to Deepgram
        await self.stt.send_audio(audio_bytes)

        # Run VAD (CPU, fast)
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        self._audio_cursor += len(audio_array) / 16000.0

        # Check for barge-in during TTS
        if self._is_speaking_tts:
            events = self.vad.process(audio_array)
            if any(e["type"] == "speech_start" for e in events):
                await self._barge_in()

        # Feed VAD events to heuristic
        events = self.vad.process(audio_array) if not self._is_speaking_tts else []
        for event in events:
            self.heuristic.audio_cursor = self._audio_cursor
            self.heuristic.process({
                "event_type": "vad_event",
                "data": event,
            })

        # Check if endpoint reached
        if self.heuristic.vad_endpoint_needed() or self.heuristic.utterance_endpoint_needed():
            await self._trigger_translation()

    async def handle_transcript(self, result: dict) -> None:
        """Handle Deepgram transcript events (interim/final/speech_final)."""
        self.heuristic.audio_cursor = self._audio_cursor
        self.heuristic.process({
            "event_type": "transcript",
            "data": result,
        })

        # Send interim transcript to client
        text = result.get("channel", {}).get("alternatives", [{}])[0].get("transcript", "")
        is_final = result.get("is_final", False)
        if text:
            detected_lang = result.get("channel", {}).get("detected_language")
            await self.ws.send_text(
                TranscriptUpdate(
                    text=text,
                    is_final=is_final,
                    detected_language=detected_lang,
                ).model_dump_json()
            )

        # Check endpoint after transcript
        if self.heuristic.vad_endpoint_needed() or self.heuristic.utterance_endpoint_needed():
            await self._trigger_translation()

    async def handle_utterance_end(self, result: dict) -> None:
        """Handle Deepgram UtteranceEnd events."""
        self.heuristic.audio_cursor = self._audio_cursor
        self.heuristic.process({
            "event_type": "utterance_end",
            "data": result,
        })

        if self.heuristic.vad_endpoint_needed() or self.heuristic.utterance_endpoint_needed():
            await self._trigger_translation()

    async def handle_stt_error(self, error: Exception) -> None:
        """Handle STT errors."""
        await self.ws.send_text(
            Error(message=f"STT error: {error}", code="stt_error").model_dump_json()
        )

    async def _trigger_translation(self) -> None:
        """Trigger a full translation cycle for the completed utterance."""
        utterance = self.heuristic.endpoint_current_utterance()
        if not utterance or not utterance["text"].strip():
            return

        transcript = utterance["text"]

        # Determine direction
        if self.manual_direction and self.manual_direction != "auto":
            direction = self.manual_direction
        else:
            detected_lang = self._last_detected_language()
            direction = self.language_router.route(detected_lang, transcript)

        # Build system prompt
        system_prompt = build_system_prompt(self.prompt_config, direction=direction)

        # Build conversation history from previous turns
        history = await self._get_conversation_history()

        # Stream LLM translation
        translated_text = ""
        try:
            async for token in self.llm.stream_translate(
                system_prompt=system_prompt,
                conversation_history=history,
                user_text=transcript,
                model=self.settings.default_llm_model,
            ):
                translated_text += token
        except Exception as exc:
            logger.error("LLM streaming error: %s", exc)
            await self.ws.send_text(
                Error(message=f"LLM error: {exc}", code="llm_error").model_dump_json()
            )
            return

        translated_text = translated_text.strip()

        # Send translation result to client
        await self.ws.send_text(
            TranslationResult(
                original_text=transcript,
                translated_text=translated_text,
                direction=direction,
                detected_language=self._last_detected_language(),
            ).model_dump_json()
        )

        # Stream TTS for the translation
        if direction == "en_to_ko":
            # Chunk Korean output for streaming TTS
            chunks = split_korean_clauses(translated_text)
        else:
            # English output — chunk on sentence boundaries
            chunks = [s.strip() + "." for s in translated_text.split(".") if s.strip()]

        if not chunks:
            chunks = [translated_text]

        # Stream TTS chunks
        self._is_speaking_tts = True
        self._tts_task = asyncio.create_task(self._stream_tts(chunks))

        # Store turn in SQLite
        await self.session_store.add_turn(
            session_id=self.session_id,
            direction=direction,
            original_text=transcript,
            translated_text=translated_text,
            detected_language=self._last_detected_language(),
        )

    async def _stream_tts(self, chunks: list[str]) -> None:
        """Stream TTS audio chunks to the client."""
        chunk_index = 0
        try:
            for text_chunk in chunks:
                if not self._is_speaking_tts:
                    break  # barge-in interrupted

                try:
                    async for audio_chunk in self.tts.synthesize(
                        text=text_chunk,
                        model_id=self.settings.default_tts_model,
                    ):
                        if not self._is_speaking_tts:
                            break
                        audio_b64 = base64.b64encode(audio_chunk).decode("ascii")
                        await self.ws.send_text(
                            AudioOutput(
                                audio=audio_b64,
                                chunk_index=chunk_index,
                                is_final=False,
                            ).model_dump_json()
                        )
                except Exception as exc:
                    logger.error("TTS error for chunk %d: %s", chunk_index, exc)
                    break
                chunk_index += 1

            # Send final marker
            await self.ws.send_text(
                AudioOutput(audio="", chunk_index=chunk_index, is_final=True).model_dump_json()
            )
        except Exception as exc:
            logger.error("TTS streaming error: %s", exc)
        finally:
            self._is_speaking_tts = False

    async def _barge_in(self) -> None:
        """Handle barge-in: stop TTS, reset state, start new cycle."""
        logger.info("Barge-in detected — stopping TTS")
        self._is_speaking_tts = False
        if self._tts_task and not self._tts_task.done():
            self._tts_task.cancel()
            try:
                await self._tts_task
            except asyncio.CancelledError:
                pass
        self._tts_task = None

    def _last_detected_language(self) -> str:
        """Get the last detected language from the heuristic."""
        # The heuristic stores transcript data; we extract detected language
        # from the last processed transcript event's data
        return "en"  # simplified; in production, extract from Deepgram response

    async def _get_conversation_history(self) -> list[dict[str, str]]:
        """Get conversation history for LLM context."""
        turns = await self.session_store.get_session_turns(self.session_id)
        history: list[dict[str, str]] = []
        for turn in turns[-10:]:  # last 10 turns for context
            if turn["direction"] == "en_to_ko":
                history.append({"role": "user", "content": turn["original_text"]})
                history.append({"role": "assistant", "content": turn["translated_text"]})
            else:
                history.append({"role": "assistant", "content": turn["original_text"]})
                history.append({"role": "user", "content": turn["translated_text"]})
        return history

    def apply_settings(self, msg: SettingsUpdate) -> None:
        """Apply runtime settings updates."""
        if msg.llm_model:
            self.settings.default_llm_model = msg.llm_model
        if msg.tts_model:
            self.settings.default_tts_model = msg.tts_model
        if msg.voice_id:
            self.settings.elevenlabs_voice_id = msg.voice_id
            self.tts.default_voice_id = msg.voice_id
        if msg.vad_min_silence_ms is not None:
            self.vad.min_silence_ms = msg.vad_min_silence_ms
        if msg.vad_pause_threshold is not None:
            self.heuristic.pause_threshold = msg.vad_pause_threshold
        if msg.vad_utterance_end_ms is not None:
            self.stt.utterance_end_ms = msg.vad_utterance_end_ms
        if msg.vad_endpointing_ms is not None:
            self.stt.endpointing = msg.vad_endpointing_ms
        if msg.vad_activation_threshold is not None:
            self.vad.threshold = msg.vad_activation_threshold
        if msg.politeness_level:
            self.prompt_config.politeness_level = msg.politeness_level
        if msg.user_role:
            self.prompt_config.user_role = msg.user_role
        if msg.senior_role:
            self.prompt_config.senior_role = msg.senior_role
        if msg.context is not None:
            self.prompt_config.context = msg.context
        if msg.topic:
            self.prompt_config.topic = msg.topic