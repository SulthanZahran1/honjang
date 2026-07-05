import os

from app.config import Settings


def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("DEEPGRAM_API_KEY", "test_dg")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test_or")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test_el")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "voice123")
    s = Settings()
    assert s.deepgram_api_key == "test_dg"
    assert s.openrouter_api_key == "test_or"
    assert s.elevenlabs_api_key == "test_el"
    assert s.elevenlabs_voice_id == "voice123"
    assert s.default_llm_model == "google/gemini-3.1-flash-lite"
    assert s.default_tts_model == "eleven_flash_v2_5"
    assert s.vad_min_silence_ms == 450
    assert s.vad_pause_threshold == 1.2
    assert s.vad_utterance_end_ms == 1200
    assert s.vad_endpointing_ms == 450
    assert s.vad_activation_threshold == 0.6


def test_settings_defaults():
    # Clear env vars to test defaults
    s = Settings(
        deepgram_api_key="",
        openrouter_api_key="",
        elevenlabs_api_key="",
        elevenlabs_voice_id="",
    )
    assert s.vps_host == "0.0.0.0"
    assert s.vps_port == 8000
    assert s.sqlite_path == "honjang.db"
    assert s.default_llm_model == "google/gemini-3.1-flash-lite"