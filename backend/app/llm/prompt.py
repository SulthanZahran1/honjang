"""LLM prompt builder for Honjang translation assistant."""

from dataclasses import dataclass


@dataclass
class PromptConfig:
    """Configuration for the LLM system prompt.

    Attributes:
        user_role: Role of the user (junior employee).
        senior_role: Role of the senior colleague in Korea.
        politeness_level: Politeness register — 'auto', '합쇼체', or '해요체'.
        context: Optional context paragraph injected into the prompt.
        topic: Topic of the conversation.
    """

    user_role: str = "a junior employee"
    senior_role: str = "a senior colleague in Korea"
    politeness_level: str = "auto"  # auto, 합쇼체, 해요체
    context: str = ""
    topic: str = "technical stuff"


# ---------------------------------------------------------------------------
# Politeness instruction table
# ---------------------------------------------------------------------------

_POLITENESS_INSTRUCTIONS: dict[str, str] = {
    "auto": (
        "Choose the appropriate Korean politeness level automatically "
        "(합쇼체 for formal situations, 해요체 for everyday politeness)."
    ),
    "합쇼체": (
        "Use 합쇼체 (formal polite style, e.g. -습니다) consistently."
    ),
    "해요체": (
        "Use 해요체 (informal polite style, e.g. -요) consistently."
    ),
}


def _politeness_instruction(level: str) -> str:
    """Return the politeness instruction text for the given level."""
    return _POLITENESS_INSTRUCTIONS.get(
        level,
        _POLITENESS_INSTRUCTIONS["auto"],
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_system_prompt(config: PromptConfig, direction: str = "en_to_ko") -> str:
    """Build the LLM system prompt.

    Args:
        config: PromptConfig instance.
        direction: Translation direction — 'en_to_ko' or 'ko_to_en'.

    Returns:
        The assembled system prompt string.
    """
    direction_normalized = direction.strip().lower()
    if direction_normalized in ("en_to_ko", "english_to_korean", "en→ko", "en->ko"):
        direction_text = (
            "Translate the user's English speech INTO Korean. (English → Korean, EN→KO)"
        )
    elif direction_normalized in ("ko_to_en", "korean_to_english", "ko→en", "ko->en"):
        direction_text = (
            "Translate the Korean speech INTO English. (Korean → English, KO→EN)"
        )
    else:
        # Fallback: treat as en→ko
        direction_text = (
            "Translate the user's English speech INTO Korean. (English → Korean, EN→KO)"
        )

    politeness_text = _politeness_instruction(config.politeness_level)

    lines: list[str] = [
        f"You are a real-time translation assistant for a {config.user_role} "
        f"speaking to {config.senior_role}.",
        "",
        f"Topic of conversation: {config.topic}",
        "",
        direction_text,
        "",
        f"Politeness: {politeness_text}",
        "",
        (
            "Output ONLY the translation — no preamble, no explanation, "
            "no notes. If the input is a fragment, translate the fragment. "
            "Preserve the speaker's intent and tone."
        ),
    ]

    # Optional context block
    if config.context.strip():
        lines.extend([
            "",
            "Context for this conversation:",
            config.context.strip(),
        ])

    return "\n".join(lines)