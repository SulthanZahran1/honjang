/**
 * useTranslator — the central hook tying together WebSocketService + AudioService.
 *
 * Manages: connection state, recording state, playback state, transcript list,
 * current settings, mode, direction, llm_role.
 *
 * Exposes: connect(), disconnect(), startTalking(), stopTalking(),
 * updateSettings(), transcript, status, detectedLanguage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioService } from "../services/AudioService";
import { WebSocketService, WsStatus } from "../services/WebSocketService";
import { SettingsService } from "../services/SettingsService";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  LLMRole,
} from "../types/settings";
import {
  AudioOutput,
  SettingsUpdate,
  TranscriptUpdate,
  TranslationResult,
  TranslatorMode,
  TranslationDirection,
} from "../types/protocol";

export type ConversationStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "translating"
  | "speaking"
  | "error"
  | "disconnected";

export interface TranscriptEntry {
  id: string;
  originalText: string;
  translatedText: string;
  direction: TranslationDirection;
  detectedLanguage?: string | null;
  timestamp: number;
  isFinal: boolean;
}

export interface UseTranslatorReturn {
  // connection
  wsStatus: WsStatus;
  status: ConversationStatus;
  connect: () => Promise<void>;
  disconnect: () => void;

  // recording
  isRecording: boolean;
  isPlaying: boolean;
  startTalking: () => Promise<void>;
  stopTalking: () => Promise<void>;

  // transcript
  transcript: TranscriptEntry[];
  interimText: string;
  detectedLanguage: string | null;
  clearTranscript: () => void;

  // settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;

  // mode / direction / role
  mode: TranslatorMode;
  setMode: (m: TranslatorMode) => void;
  direction: TranslationDirection;
  setDirection: (d: TranslationDirection) => void;
  llmRole: LLMRole;
  setLlmRole: (r: LLMRole) => void;
}

export function useTranslator(): UseTranslatorReturn {
  const wsRef = useRef<WebSocketService | null>(null);
  const audioRef = useRef<AudioService | null>(null);

  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [mode, setModeState] = useState<TranslatorMode>(DEFAULT_SETTINGS.mode);
  const [direction, setDirectionState] = useState<TranslationDirection>(
    DEFAULT_SETTINGS.direction,
  );
  const [llmRole, setLlmRoleState] = useState<LLMRole>(DEFAULT_SETTINGS.llmRole);

  // ---- Initialize services + load settings ----
  useEffect(() => {
    wsRef.current = new WebSocketService();
    audioRef.current = new AudioService();

    void AudioService.configureAudioMode();
    void SettingsService.load().then((s) => {
      setSettings(s);
      setModeState(s.mode);
      setDirectionState(s.direction);
      setLlmRoleState(s.llmRole);
    });

    const ws = wsRef.current;

    const offTranscript = ws.on<TranscriptUpdate>("transcript", (msg) => {
      setInterimText(msg.text);
      setDetectedLanguage(msg.detected_language ?? null);
      if (msg.is_final) {
        setStatus("translating");
      } else {
        setStatus("listening");
      }
    });

    const offTranslation = ws.on<TranslationResult>("translation", (msg) => {
      setInterimText("");
      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          originalText: msg.original_text,
          translatedText: msg.translated_text,
          direction: msg.direction,
          detectedLanguage: msg.detected_language,
          timestamp: Date.now(),
          isFinal: true,
        },
      ]);
      setDetectedLanguage(msg.detected_language ?? null);
    });

    const offAudio = ws.on<AudioOutput>("audio_output", (msg) => {
      void audioRef.current?.playChunk(msg.audio);
      setStatus("speaking");
      if (msg.is_final) {
        // After TTS finishes, status returns to idle (pipeline) or listening (agent)
        setTimeout(() => {
          setStatus((cur) => (cur === "speaking" ? "idle" : cur));
        }, 200);
      }
    });

    const offError = ws.on("error", (err) => {
      console.warn("[useTranslator] WS error:", err);
      setStatus("error");
    });

    const offOpen = ws.on("open", () => {
      setStatus("connected");
      // Send initial settings + mode + direction
      _syncSettings(settings);
      ws.sendModeChange(mode);
      ws.sendDirectionChange(direction);
    });

    const offDisconnect = ws.on("disconnect", () => {
      setStatus("disconnected");
    });

    return () => {
      offTranscript();
      offTranslation();
      offAudio();
      offError();
      offOpen();
      offDisconnect();
      ws.disconnect();
      void audioRef.current?.stopRecording();
      audioRef.current?.stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Helpers ----

  const _syncSettings = useCallback((s: AppSettings) => {
    const update: SettingsUpdate = {
      type: "settings_update",
      llm_model: s.llmModel,
      tts_model: s.ttsModel,
      voice_id: s.elevenlabsVoiceId || null,
      vad_min_silence_ms: s.vad.vad_min_silence_ms,
      vad_pause_threshold: s.vad.vad_pause_threshold,
      vad_utterance_end_ms: s.vad.vad_utterance_end_ms,
      vad_activation_threshold: s.vad.vad_activation_threshold,
      politeness_level: s.politenessLevel,
      user_role: s.userRole,
      senior_role: s.seniorRole,
      context: s.context || null,
      topic: s.topic,
    };
    wsRef.current?.sendSettings(update);
  }, []);

  // ---- Connection ----

  const connect = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws) return;
    setStatus("connecting");
    try {
      await ws.connect(settings.vpsUrl);
      // status update handled by 'open' listener
    } catch (e) {
      setStatus("error");
      console.warn("[useTranslator] connect failed:", e);
    }
  }, [settings.vpsUrl]);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    setStatus("disconnected");
  }, []);

  // ---- Recording (push-to-talk) ----

  const startTalking = useCallback(async () => {
    const audio = audioRef.current;
    const ws = wsRef.current;
    if (!audio || !ws) return;

    // Barge-in: stop any TTS playback
    audio.stopPlayback();
    setIsPlaying(false);

    try {
      await audio.startRecording((base64) => {
        ws.sendAudioChunk(base64);
      });
      setIsRecording(true);
      setStatus("listening");
    } catch (e) {
      console.warn("[useTranslator] startTalking failed:", e);
      setStatus("error");
    }
  }, []);

  const stopTalking = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.stopRecording();
    } catch (e) {
      console.warn("[useTranslator] stopTalking failed:", e);
    }
    setIsRecording(false);
    setStatus("connected");
  }, []);

  // ---- Settings ----

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await SettingsService.update(patch);
    setSettings(next);
    if (patch.mode) setModeState(patch.mode);
    if (patch.direction) setDirectionState(patch.direction);
    if (patch.llmRole) setLlmRoleState(patch.llmRole);
    _syncSettings(next);
  }, [_syncSettings]);

  // ---- Mode / Direction / Role ----

  const setMode = useCallback((m: TranslatorMode) => {
    setModeState(m);
    wsRef.current?.sendModeChange(m);
    void SettingsService.update({ mode: m });
  }, []);

  const setDirection = useCallback((d: TranslationDirection) => {
    setDirectionState(d);
    wsRef.current?.sendDirectionChange(d);
    void SettingsService.update({ direction: d });
  }, []);

  const setLlmRole = useCallback((r: LLMRole) => {
    setLlmRoleState(r);
    // llm_role isn't a separate WS message; it's part of settings context.
    // We update the user_role/senior_role framing implicitly via settings.
    void SettingsService.update({ llmRole: r });
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setInterimText("");
  }, []);

  return {
    wsStatus,
    status,
    connect,
    disconnect,
    isRecording,
    isPlaying,
    startTalking,
    stopTalking,
    transcript,
    interimText,
    detectedLanguage,
    clearTranscript,
    settings,
    updateSettings,
    mode,
    setMode,
    direction,
    setDirection,
    llmRole,
    setLlmRole,
  };
}