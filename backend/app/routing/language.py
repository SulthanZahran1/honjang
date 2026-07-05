"""Language routing: decide translation direction from detected language + transcript."""

from __future__ import annotations

import re

KOREAN_PATTERN = re.compile(r"[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]")


class LanguageRouter:
    """Routes utterances to a translation direction.

    Rules (evaluated in order):
      1. Code-switch: if *any* Korean character appears in the transcript,
         always return ``ko_to_en`` — regardless of detected language.
      2. If ``detected_language`` is ``"ko"`` → ``ko_to_en``.
      3. If ``detected_language`` is ``"en"`` → ``en_to_ko``.
      4. Sticky fallback: for unknown languages, use ``last_direction`` if set;
         otherwise default to ``en_to_ko``.
    """

    def __init__(self, last_direction: str | None = None) -> None:
        self.last_direction = last_direction

    def route(self, detected_language: str, transcript: str) -> str:
        # 1. Code-switch — Korean characters in transcript always win.
        if KOREAN_PATTERN.search(transcript):
            direction = "ko_to_en"
            self.last_direction = direction
            return direction

        # 2–3. Known-language mapping.
        if detected_language == "ko":
            direction = "ko_to_en"
            self.last_direction = direction
            return direction
        if detected_language == "en":
            direction = "en_to_ko"
            self.last_direction = direction
            return direction

        # 4. Sticky fallback for unknown languages.
        direction = self.last_direction or "en_to_ko"
        return direction


def determine_direction(
    detected_language: str,
    transcript: str,
    *,
    last_direction: str | None = None,
) -> str:
    """Convenience wrapper around :class:`LanguageRouter`.

    >>> determine_direction("en", "Hello")
    'en_to_ko'
    >>> determine_direction("en", "API를 호출해야 해요")
    'ko_to_en'
    """
    return LanguageRouter(last_direction=last_direction).route(
        detected_language, transcript
    )