/**
 * WebSocket protocol message types — mirrors backend Pydantic models.
 * @see /home/dev/honjang/backend/app/websocket/protocol.py
 */

// ---- Discriminator union helpers ----

export type ClientMessageType =
  | "audio_chunk"
  | "settings_update"
  | "mode_change"
  | "direction_change"
  | "session_end";

export type ServerMessageType =
  | "transcript_update"
  | "translation_result"
  | "audio_output"
  | "session_start"
  | "session_end"
  | "error";

// ---- Client → Server messages ----

export interface AudioChunk {
  type: "audio_chunk";
  audio: string; // base64-encoded PCM bytes (16kHz linear16 mono)
  sample_rate: number;
}

export interface SettingsUpdate {
  type: "settings_update";
  llm_model?: string | null;
  tts_model?: string | null;
  voice_id?: string | null;
  vad_min_silence_ms?: number | null;
  vad_pause_threshold?: number | null;
  vad_utterance_end_ms?: number | null;
  vad_endpointing_ms?: number | null;
  vad_activation_threshold?: number | null;
  politeness_level?: string | null;
  user_role?: string | null;
  senior_role?: string | null;
  context?: string | null;
  topic?: string | null;
}

export type TranslatorMode = "pipeline" | "raw_voice_agent";

export interface ModeChange {
  type: "mode_change";
  mode: TranslatorMode;
}

export type TranslationDirection = "auto" | "en_to_ko" | "ko_to_en";

export interface DirectionChange {
  type: "direction_change";
  direction: TranslationDirection;
}

export interface SessionEndClient {
  type: "session_end";
}

// ---- Server → Client messages ----

export interface TranscriptUpdate {
  type: "transcript_update";
  text: string;
  is_final: boolean;
  detected_language?: string | null;
}

export interface TranslationResult {
  type: "translation_result";
  original_text: string;
  translated_text: string;
  direction: TranslationDirection;
  detected_language?: string | null;
}

export interface AudioOutput {
  type: "audio_output";
  audio: string; // base64-encoded audio bytes
  chunk_index: number;
  is_final: boolean;
}

export interface SessionStart {
  type: "session_start";
  session_id: number;
}

export interface SessionEndServer {
  type: "session_end";
  session_id: number;
}

export interface ErrorMsg {
  type: "error";
  message: string;
  code?: string | null;
}

// ---- Union types ----

export type ClientMessage =
  | AudioChunk
  | SettingsUpdate
  | ModeChange
  | DirectionChange
  | SessionEndClient;

export type ServerMessage =
  | TranscriptUpdate
  | TranslationResult
  | AudioOutput
  | SessionStart
  | SessionEndServer
  | ErrorMsg;

// ---- Convenience aliases ----
export { ErrorMsg as Error };