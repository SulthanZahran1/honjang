"""ElevenLabs streaming TTS client.

Uses httpx async streaming POST to ElevenLabs text-to-speech API.
Supports Flash v2.5 (default, low latency) and v3 (more expressive) models.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech"


class ElevenLabsTTS:
    """Async streaming TTS client for ElevenLabs.

    Streams audio chunks from the model. Supports eleven_flash_v2_5 (default,
    75ms latency, 32 languages) and eleven_v3 (70+ languages, more expressive).
    """

    def __init__(
        self,
        api_key: str,
        *,
        default_voice_id: str = "",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.default_voice_id = default_voice_id
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

    def _build_url(self, voice_id: str) -> str:
        return f"{ELEVENLABS_BASE}/{voice_id}/stream"

    def _build_payload(
        self,
        text: str,
        model_id: str,
        voice_settings: dict | None = None,
    ) -> dict:
        payload: dict = {
            "text": text,
            "model_id": model_id,
        }
        if voice_settings:
            payload["voice_settings"] = voice_settings
        else:
            payload["voice_settings"] = {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            }
        return payload

    async def synthesize(
        self,
        text: str,
        model_id: str = "eleven_flash_v2_5",
        voice_id: str | None = None,
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio chunks from ElevenLabs TTS.

        Args:
            text: The text to synthesize.
            model_id: ElevenLabs model ID (eleven_flash_v2_5 or eleven_v3).
            voice_id: Voice ID to use. Falls back to default_voice_id.

        Yields:
            Audio chunk bytes (MP3 format) as they arrive.
        """
        vid = voice_id or self.default_voice_id
        if not vid:
            raise ValueError("voice_id must be provided or set as default_voice_id")

        url = self._build_url(vid)
        payload = self._build_payload(text, model_id)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                url,
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    if chunk:
                        yield chunk