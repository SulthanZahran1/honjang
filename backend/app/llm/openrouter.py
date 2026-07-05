"""OpenRouter streaming LLM client.

Uses httpx async streaming POST to OpenRouter's chat completions API.
Streams tokens via SSE (Server-Sent Events) format.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterLLM:
    """Async streaming LLM client for OpenRouter chat completions.

    Streams tokens from the model via SSE. Supports any OpenRouter-compatible
    model (e.g., google/gemini-3.1-flash-lite, anthropic/claude-sonnet-4.6).
    """

    def __init__(
        self,
        api_key: str,
        *,
        referer: str = "https://honjang.app",
        title: str = "Honjang Translator",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.referer = referer
        self.title = title
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": self.referer,
            "X-Title": self.title,
            "Content-Type": "application/json",
        }

    def _build_payload(
        self,
        system_prompt: str,
        conversation_history: list[dict[str, str]],
        user_text: str,
        model: str,
    ) -> dict[str, Any]:
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_text})
        return {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": 0.3,
        }

    async def stream_translate(
        self,
        system_prompt: str,
        conversation_history: list[dict[str, str]],
        user_text: str,
        model: str,
    ) -> AsyncGenerator[str, None]:
        """Stream translation tokens from OpenRouter.

        Args:
            system_prompt: The system prompt with translation instructions.
            conversation_history: List of {"role", "content"} dicts for context.
            user_text: The input text to translate.
            model: OpenRouter model ID (e.g., "google/gemini-3.1-flash-lite").

        Yields:
            Individual token strings as they arrive from the LLM.
        """
        payload = self._build_payload(
            system_prompt, conversation_history, user_text, model
        )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                OPENROUTER_URL,
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue