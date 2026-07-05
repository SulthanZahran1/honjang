"""Tests for app.llm.prompt."""

from app.llm.prompt import PromptConfig, build_system_prompt


def test_default_prompt_has_junior_senior():
    prompt = build_system_prompt(PromptConfig())
    lowered = prompt.lower()
    assert "junior" in lowered
    assert "senior" in lowered
    # politeness: either the word 'auto' or 'appropriate' should appear
    assert "auto" in lowered or "appropriate" in lowered


def test_prompt_includes_context():
    cfg = PromptConfig(
        context="My team lead at LG Sinarmas asked me to report on progress.",
        topic="discussing a semiconductor CIM project deadline",
    )
    prompt = build_system_prompt(cfg)
    assert "LG Sinarmas" in prompt
    assert "semiconductor CIM" in prompt


def test_prompt_specifies_direction_en_to_ko():
    prompt = build_system_prompt(PromptConfig(), direction="en_to_ko")
    assert "English → Korean" in prompt or "EN→KO" in prompt


def test_prompt_specifies_direction_ko_to_en():
    prompt = build_system_prompt(PromptConfig(), direction="ko_to_en")
    assert "Korean → English" in prompt or "KO→EN" in prompt


def test_prompt_uses_senior_role_not_typo():
    """Ensure the senior_role value appears literally in the prompt."""
    cfg = PromptConfig(senior_role="a senior colleague in Korea")
    prompt = build_system_prompt(cfg)
    assert "a senior colleague in Korea" in prompt