"""WebSocket protocol message types for Honjang client↔server communication.

All messages are JSON-serialized Pydantic models. The `type` field
discriminates message types on both ends.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    # Client → Server
    AUDIO_CHUNK = "audio_chunk"
    SETTINGS_UPDATE = "settings_update"
    MODE_CHANGE = "mode_change"
    DIRECTION_CHANGE = "direction_change"
    SESSION_START = "session_start"
    SESSION_END = "session_end"

    # Server → Client
    TRANSCRIPT_UPDATE = "transcript_update"
    TRANSLATION_RESULT = "translation_result"
    AUDIO_OUTPUT = "audio_output"
    ERROR = "error"


class AudioChunk(BaseModel):
    """Client → Server: Base64-encoded audio chunk (16kHz linear16 mono)."""
    type: str = Field(default=MessageType.AUDIO_CHUNK.value)
    audio: str  # base64-encoded PCM bytes
    sample_rate: int = 16000


class TranscriptUpdate(BaseModel):
    """Server → Client: Live transcript (interim or final)."""
    type: str = Field(default=MessageType.TRANSCRIPT_UPDATE.value)
    text: str
    is_final: bool = False
    detected_language: str | None = None


class TranslationResult(BaseModel):
    """Server → Client: Completed translation for a turn."""
    type: str = Field(default=MessageType.TRANSLATION_RESULT.value)
    original_text: str
    translated_text: str
    direction: str  # en_to_ko or ko_to_en
    detected_language: str | None = None


class AudioOutput(BaseModel):
    """Server → Client: Base64-encoded TTS audio chunk."""
    type: str = Field(default=MessageType.AUDIO_OUTPUT.value)
    audio: str  # base64-encoded audio bytes
    chunk_index: int = 0
    is_final: bool = False


class SettingsUpdate(BaseModel):
    """Client → Server: Update session settings (LLM model, TTS, VAD params)."""
    type: str = Field(default=MessageType.SETTINGS_UPDATE.value)
    llm_model: str | None = None
    tts_model: str | None = None
    voice_id: str | None = None
    vad_min_silence_ms: int | None = None
    vad_pause_threshold: float | None = None
    vad_utterance_end_ms: int | None = None
    vad_endpointing_ms: int | None = None
    vad_activation_threshold: float | None = None
    politeness_level: str | None = None
    user_role: str | None = None
    senior_role: str | None = None
    context: str | None = None
    topic: str | None = None


class ModeChange(BaseModel):
    """Client → Server: Change operating mode (pipeline / raw_voice_agent)."""
    type: str = Field(default=MessageType.MODE_CHANGE.value)
    mode: str  # "pipeline" or "raw_voice_agent"


class DirectionChange(BaseModel):
    """Client → Server: Change/manual-override translation direction."""
    type: str = Field(default=MessageType.DIRECTION_CHANGE.value)
    direction: str  # "en_to_ko", "ko_to_en", or "auto"


class SessionStart(BaseModel):
    """Server → Client: Session started confirmation."""
    type: str = Field(default=MessageType.SESSION_START.value)
    session_id: int


class SessionEnd(BaseModel):
    """Server → Client: Session ended confirmation."""
    type: str = Field(default=MessageType.SESSION_END.value)
    session_id: int


class Error(BaseModel):
    """Server → Client: Error message."""
    type: str = Field(default=MessageType.ERROR.value)
    message: str
    code: str | None = None


# Type union for parsing incoming client messages
CLIENT_MESSAGE_TYPES = (
    AudioChunk,
    SettingsUpdate,
    ModeChange,
    DirectionChange,
    SessionEnd,
)

# Type union for server messages
SERVER_MESSAGE_TYPES = (
    TranscriptUpdate,
    TranslationResult,
    AudioOutput,
    SessionStart,
    SessionEnd,
    Error,
)


def parse_client_message(data: dict) -> BaseModel | None:
    """Parse a client message dict into the appropriate Pydantic model.

    Returns None if the type is unknown.
    """
    msg_type = data.get("type")
    for model_cls in CLIENT_MESSAGE_TYPES:
        if msg_type == model_cls.model_fields["type"].default:
            return model_cls(**data)
    return None