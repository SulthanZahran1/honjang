"""Deepgram Nova-3 streaming STT client.

Wraps the Deepgram Python SDK for async WebSocket streaming transcription.
Supports Nova-3 multilingual model with Korean support and language detection.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

# Callback type signatures
TranscriptCallback = Callable[[dict], Awaitable[None]]
ErrorCallback = Callable[[Exception], Awaitable[None]]


class DeepgramSTT:
    """Async streaming STT client using Deepgram Nova-3 multilingual.

    Opens a WebSocket to Deepgram, sends linear16 audio chunks, and emits
    transcript events (interim, final, speech_final), utterance_end events,
    and VAD events via callbacks.
    """

    def __init__(
        self,
        api_key: str,
        *,
        language: str = "multi",
        model: str = "nova-3",
        interim_results: bool = True,
        vad_events: bool = True,
        endpointing: int = 450,
        utterance_end_ms: int = 1200,
        smart_format: bool = True,
        encoding: str = "linear16",
        sample_rate: int = 16000,
        channels: int = 1,
    ):
        self.api_key = api_key
        self.language = language
        self.model = model
        self.interim_results = interim_results
        self.vad_events = vad_events
        self.endpointing = endpointing
        self.utterance_end_ms = utterance_end_ms
        self.smart_format = smart_format
        self.encoding = encoding
        self.sample_rate = sample_rate
        self.channels = channels

        # Callbacks
        self.on_transcript: Optional[TranscriptCallback] = None
        self.on_utterance_end: Optional[TranscriptCallback] = None
        self.on_error: Optional[ErrorCallback] = None

        # Internal state
        self._dg_connection: Any = None
        self._is_connected = False

    def _build_options(self) -> dict:
        """Build Deepgram streaming options dict."""
        options: dict[str, Any] = {
            "model": self.model,
            "interim_results": self.interim_results,
            "vad_events": self.vad_events,
            "endpointing": self.endpointing,
            "utterance_end_ms": self.utterance_end_ms,
            "smart_format": self.smart_format,
            "encoding": self.encoding,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
        }
        if self.language != "multi":
            options["language"] = self.language
        return options

    async def connect(self) -> None:
        """Open WebSocket connection to Deepgram streaming endpoint."""
        from deepgram import AsyncDeepgramClient, LiveOptions, LiveTranscriptionEvents

        client = AsyncDeepgramClient(self.api_key)
        self._dg_connection = client.listen.asyncwebsocket.v("1")

        # Register event handlers
        async def on_open(client, open_event, **kwargs):
            logger.info("Deepgram WebSocket connected")
            self._is_connected = True

        async def on_transcript(client, result, **kwargs):
            if self.on_transcript and result:
                await self.on_transcript(result)

        async def on_utterance_end(client, result, **kwargs):
            if self.on_utterance_end and result:
                await self.on_utterance_end(result)

        async def on_error(client, error, **kwargs):
            logger.error("Deepgram error: %s", error)
            if self.on_error:
                await self.on_error(error)

        self._dg_connection.on(LiveTranscriptionEvents.Open, on_open)
        self._dg_connection.on(LiveTranscriptionEvents.Transcript, on_transcript)
        self._dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
        self._dg_connection.on(LiveTranscriptionEvents.Error, on_error)

        options = LiveOptions(**self._build_options())
        await self._dg_connection.start(options)

    async def send_audio(self, chunk: bytes) -> None:
        """Send a linear16 audio chunk to Deepgram.

        Args:
            chunk: Raw 16-bit PCM audio bytes (16kHz mono).
        """
        if self._dg_connection and self._is_connected:
            await self._dg_connection.send(chunk)

    async def disconnect(self) -> None:
        """Close the Deepgram WebSocket connection."""
        if self._dg_connection:
            await self._dg_connection.finish()
            self._is_connected = False
            self._dg_connection = None
            logger.info("Deepgram WebSocket disconnected")

    @property
    def is_connected(self) -> bool:
        return self._is_connected