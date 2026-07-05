/**
 * WebSocketService — manages the WS connection to the Honjang backend.
 *
 * Features:
 * - connect / disconnect
 * - send protocol messages (audio chunks, settings, mode/direction changes)
 * - typed event emitter for server messages
 * - exponential-backoff reconnection
 *
 * Uses the React Native built-in WebSocket (no extra dep needed).
 */

import type {
  AudioChunk,
  ClientMessage,
  DirectionChange,
  ErrorMsg,
  AudioOutput,
  ModeChange,
  ServerMessage,
  SessionEndClient,
  SettingsUpdate,
  TranscriptUpdate,
  TranslationResult,
} from "../types/protocol";

type Listener<T = unknown> = (payload: T) => void;

export type WsEventName =
  | "transcript"
  | "translation"
  | "audio_output"
  | "session_start"
  | "session_end"
  | "error"
  | "open"
  | "disconnect";

export type WsStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 15_000;
const RECONNECT_MAX_ATTEMPTS = 10;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = "";
  private listeners: Map<WsEventName, Set<Listener>> = new Map();
  private status: WsStatus = "idle";
  private reconnectAttempts = 0;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Event subscription ----

  on<T = unknown>(event: WsEventName, cb: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as Listener);
    return () => {
      this.listeners.get(event)?.delete(cb as Listener);
    };
  }

  private emit(event: WsEventName, payload?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.warn(`[WebSocketService] listener error for ${event}:`, e);
      }
    });
  }

  getStatus(): WsStatus {
    return this.status;
  }

  // ---- Connection ----

  /**
   * Connect to the backend WebSocket. Resolves once open; rejects on first
   * failure (subsequent reconnection is handled automatically).
   */
  connect(url: string): Promise<void> {
    this.url = url;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    return this._doConnect();
  }

  private _doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.status = this.reconnectAttempts > 0 ? "reconnecting" : "connecting";
      let opened = false;

      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        this.status = "error";
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        opened = true;
        this.status = "connected";
        this.reconnectAttempts = 0;
        this.emit("open");
        resolve();
      };

      this.ws.onmessage = (ev: WebSocketMessageEvent) => {
        this._handleMessage(ev.data);
      };

      this.ws.onerror = () => {
        if (!opened) {
          this.status = "error";
          reject(new Error(`WebSocket connection failed: ${this.url}`));
        }
        // onclose will handle reconnection
      };

      this.ws.onclose = () => {
        this.status = "disconnected";
        this.emit("disconnect");
        if (this.shouldReconnect) {
          this._scheduleReconnect();
        }
      };
    });
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      console.warn("[WebSocketService] max reconnect attempts reached");
      this.status = "disconnected";
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY_MS,
    );
    this.status = "reconnecting";
    this.reconnectTimer = setTimeout(() => {
      this._doConnect().catch(() => {
        // _doConnect already sets status; onclose will retry again
      });
    }, delay);
  }

  /**
   * Disconnect and stop reconnecting.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
    this.status = "disconnected";
  }

  // ---- Sending ----

  private _send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocketService] send called while not connected");
      return;
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (e) {
      console.warn("[WebSocketService] send failed:", e);
    }
  }

  sendAudioChunk(base64Audio: string, sampleRate = 16000): void {
    const msg: AudioChunk = { type: "audio_chunk", audio: base64Audio, sample_rate: sampleRate };
    this._send(msg);
  }

  sendSettings(settings: SettingsUpdate): void {
    this._send({ ...settings, type: "settings_update" });
  }

  sendModeChange(mode: ModeChange["mode"]): void {
    const msg: ModeChange = { type: "mode_change", mode };
    this._send(msg);
  }

  sendDirectionChange(direction: DirectionChange["direction"]): void {
    const msg: DirectionChange = { type: "direction_change", direction };
    this._send(msg);
  }

  sendStartRecording(): void {
    // Backend treats first audio_chunk as recording start; some flows may
    // want an explicit signal. We send a no-op settings sync in the future;
    // for now, nothing to send — recording is implicit via audio chunks.
  }

  sendStopRecording(): void {
    const msg: SessionEndClient = { type: "session_end" };
    this._send(msg);
  }

  // ---- Receiving ----

  private _handleMessage(data: string | ArrayBuffer | Blob): void {
    let text: string;
    if (typeof data === "string") {
      text = data;
    } else if (data instanceof ArrayBuffer) {
      text = new TextDecoder().decode(data);
    } else {
      // Blob — unlikely in RN but handle gracefully
      console.warn("[WebSocketService] received Blob message, ignoring");
      return;
    }

    let parsed: ServerMessage;
    try {
      parsed = JSON.parse(text) as ServerMessage;
    } catch (e) {
      console.warn("[WebSocketService] failed to parse message:", e);
      return;
    }

    switch (parsed.type) {
      case "transcript_update": {
        this.emit("transcript", parsed as TranscriptUpdate);
        break;
      }
      case "translation_result": {
        this.emit("translation", parsed as TranslationResult);
        break;
      }
      case "audio_output": {
        this.emit("audio_output", parsed as AudioOutput);
        break;
      }
      case "session_start": {
        this.emit("session_start", parsed);
        break;
      }
      case "session_end": {
        this.emit("session_end", parsed);
        break;
      }
      case "error": {
        const err = parsed as ErrorMsg;
        this.emit("error", err);
        break;
      }
      default: {
        console.warn("[WebSocketService] unknown message type:", (parsed as { type?: string }).type);
      }
    }
  }
}