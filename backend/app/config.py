from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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


settings = Settings()