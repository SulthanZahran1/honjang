/**
 * User-facing app settings, persisted via AsyncStorage.
 * These map to the backend SettingsUpdate message.
 */

import type { TranslatorMode, TranslationDirection } from "../types/protocol";

export type PolitenessLevel = "auto" | "합쇼체" | "해요체";
export type LLMRole = "translator" | "interpreter";
export type TTSModel = "eleven_flash_v2_5" | "eleven_v3";

export interface VADSettings {
  /** min silence in ms (200-800) */
  vad_min_silence_ms: number;
  /** pause threshold in seconds (0.5-2.0) */
  vad_pause_threshold: number;
  /** utterance end timeout in ms (500-3000) */
  vad_utterance_end_ms: number;
  /** activation threshold (0.3-0.9) */
  vad_activation_threshold: number;
}

export interface AppSettings {
  /** WebSocket URL of the VPS backend, e.g. ws://localhost:8000/ws */
  vpsUrl: string;

  // LLM
  llmModel: string;
  llmRole: LLMRole;

  // TTS
  ttsModel: TTSModel;
  elevenlabsVoiceId: string;

  // Relationship
  userRole: string;
  seniorRole: string;
  politenessLevel: PolitenessLevel;
  context: string;
  topic: string;

  // VAD
  vad: VADSettings;

  // Mode + direction (session-level, persisted for UX continuity)
  mode: TranslatorMode;
  direction: TranslationDirection;
}

export const DEFAULT_SETTINGS: AppSettings = {
  vpsUrl: "ws://localhost:8000/ws",

  llmModel: "google/gemini-3.1-flash-lite",
  llmRole: "translator",

  ttsModel: "eleven_flash_v2_5",
  elevenlabsVoiceId: "",

  userRole: "a junior employee",
  seniorRole: "a senior colleague in Korea",
  politenessLevel: "auto",
  context: "",
  topic: "technical stuff",

  vad: {
    vad_min_silence_ms: 450,
    vad_pause_threshold: 1.2,
    vad_utterance_end_ms: 1200,
    vad_activation_threshold: 0.6,
  },

  mode: "pipeline",
  direction: "auto",
};

export const LLM_MODEL_SUGGESTIONS: { label: string; value: string }[] = [
  { label: "Gemini 3.1 Flash Lite", value: "google/gemini-3.1-flash-lite" },
  { label: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6" },
  { label: "GPT-5 mini", value: "openai/gpt-5-mini" },
];