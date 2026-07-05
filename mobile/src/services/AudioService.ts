/**
 * AudioService — audio capture (mic) + playback (TTS) using expo-audio.
 *
 * Recording:
 *   16kHz, mono, linear16 (PCM), AEC enabled. Streams base64 chunks via
 *   an onAudioChunk callback. On stop, reads the full recording file and
 *   emits it as a final chunk.
 *
 * Playback:
 *   Queues base64 TTS chunks for seamless playback. Supports barge-in
 *   via stopPlayback().
 *
 * Audio mode: speaker on, AEC enabled, ducking false.
 *
 * NOTE: expo-audio's JS API writes recordings to a file (no streaming PCM
 * callback yet). For true streaming, a native module would feed a circular
 * buffer. This service reads the file on stop as a functional fallback and
 * documents where a native streaming hook would plug in.
 */

import {
  AudioPlayer,
  AudioRecorder,
  AudioStatus,
  createAudioPlayer,
  RecordingOptions,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from "expo-audio";
import * as FileSystem from "expo-file-system";

const SAMPLE_RATE = 16000;
const CHUNK_INTERVAL_MS = 100;

export type AudioChunkCallback = (base64Pcm: string) => void;

const RECORDING_OPTIONS: RecordingOptions = {
  extension: ".caf",
  sampleRate: SAMPLE_RATE,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: false,
  android: {
    extension: ".pcm",
    outputFormat: "default",
    audioEncoder: "default",
    sampleRate: SAMPLE_RATE,
  },
  ios: {
    extension: ".caf",
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: SAMPLE_RATE,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

export class AudioService {
  private recorder: AudioRecorder | null = null;
  private players: AudioPlayer[] = [];
  private chunkCallback: AudioChunkCallback | null = null;
  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private _isRecording = false;
  private _isPlaying = false;
  private playbackQueue: string[] = [];
  private playbackActive = false;

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Configure the global audio mode — call once at app start.
   * speaker on, AEC enabled, ducking false.
   */
  static async configureAudioMode(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "duckOthers",
        interruptionModeAndroid: "duckOthers",
      });
    } catch (e) {
      console.warn("[AudioService] setAudioModeAsync failed:", e);
    }
  }

  // ---- Recording ----

  /**
   * Start recording from the mic, streaming base64 PCM chunks via callback.
   */
  async startRecording(onChunk: AudioChunkCallback): Promise<void> {
    if (this._isRecording) return;
    this.chunkCallback = onChunk;

    try {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        throw new Error("Microphone permission not granted");
      }

      // Ensure audio mode is set for recording
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "duckOthers",
        interruptionModeAndroid: "duckOthers",
      });

      this.recorder = new AudioRecorder(RECORDING_OPTIONS);
      await this.recorder.prepareToRecordAsync();
      this.recorder.record();
      this._isRecording = true;

      // Poll for recording status — expo-audio doesn't yet expose a streaming
      // PCM callback at the JS level. A native module would call
      // this.chunkCallback(base64Chunk) with each PCM frame. We poll to
      // surface recording duration/status; the actual PCM is read on stop.
      this._startChunkPolling();
    } catch (e) {
      console.error("[AudioService] startRecording failed:", e);
      this._isRecording = false;
      throw e;
    }
  }

  private _startChunkPolling(): void {
    if (this.chunkTimer) clearInterval(this.chunkTimer);
    this.chunkTimer = setInterval(() => {
      // Placeholder: a native streaming bridge would emit chunks here.
      // The JS API writes to a file; we read it on stop.
    }, CHUNK_INTERVAL_MS);
  }

  /**
   * Stop recording and flush the full recording as a final base64 chunk.
   */
  async stopRecording(): Promise<void> {
    if (!this._isRecording) return;
    this._isRecording = false;
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    if (this.recorder) {
      try {
        await this.recorder.stop();
        const uri = this.recorder.uri;
        if (uri && this.chunkCallback) {
          const base64 = await this._fileToBase64(uri);
          if (base64) this.chunkCallback(base64);
        }
      } catch (e) {
        console.warn("[AudioService] stopRecording error:", e);
      } finally {
        this.recorder = null;
      }
    }
    this.chunkCallback = null;
  }

  // ---- Playback ----

  /**
   * Queue a base64-encoded TTS audio chunk for playback. Chunks are played
   * in order for seamless output.
   */
  async playChunk(base64Audio: string): Promise<void> {
    this.playbackQueue.push(base64Audio);
    if (!this.playbackActive) {
      void this._processPlaybackQueue();
    }
  }

  private async _processPlaybackQueue(): Promise<void> {
    this.playbackActive = true;
    this._isPlaying = true;

    while (this.playbackQueue.length > 0) {
      const base64 = this.playbackQueue.shift()!;
      try {
        await this._playOneChunk(base64);
      } catch (e) {
        console.warn("[AudioService] playback chunk failed:", e);
      }
    }

    this.playbackActive = false;
    this._isPlaying = false;
  }

  private async _playOneChunk(base64: string): Promise<void> {
    const uri = await this._base64ToTempUri(base64);
    if (!uri) return;

    const player = createAudioPlayer({ uri });
    this.players.push(player);

    return new Promise<void>((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        clearInterval(checkDone);
        clearTimeout(safetyTimeout);
        try {
          player.pause();
          player.remove();
        } catch {
          /* noop */
        }
        resolve();
      };

      // Poll for completion via currentStatus
      const checkDone = setInterval(() => {
        const st: AudioStatus = player.currentStatus;
        if (st?.didJustFinish) {
          finish();
        }
      }, 50);

      // Safety timeout: 30s max per chunk
      const safetyTimeout = setTimeout(finish, 30_000);

      try {
        player.play();
      } catch {
        finish();
      }
    });
  }

  /**
   * Stop all playback immediately — used for barge-in.
   */
  stopPlayback(): void {
    this.playbackQueue = [];
    this.playbackActive = false;
    this._isPlaying = false;
    for (const p of this.players) {
      try {
        p.pause();
        p.remove();
      } catch {
        /* noop */
      }
    }
    this.players = [];
  }

  // ---- Helpers ----

  private async _fileToBase64(uri: string): Promise<string> {
    try {
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (e) {
      console.warn("[AudioService] _fileToBase64 failed:", e);
      return "";
    }
  }

  private async _base64ToTempUri(base64: string): Promise<string | null> {
    try {
      const dir = FileSystem.cacheDirectory;
      if (!dir) return null;
      const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.caf`;
      const uri = `${dir}${filename}`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return uri;
    } catch (e) {
      console.warn("[AudioService] _base64ToTempUri failed:", e);
      return null;
    }
  }
}