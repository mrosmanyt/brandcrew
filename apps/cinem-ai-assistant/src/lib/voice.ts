/**
 * Cinem AI Assistant voice engine (Phase 2).
 *  - Listening : mic capture (MediaRecorder) + live level metering
 *  - STT       : Faster-Whisper via the Rust `transcribe_audio` command
 *  - Speaking  : ElevenLabs (primary, via tauri-plugin-http) → Piper (fallback)
 * The waveform bar reads `voice.getLevel()` each frame for real amplitude.
 */
import type { Settings } from "@/store/useSettingsStore";
import { reportUsage } from "@/lib/usage";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Per-utterance voice override (each sub-agent has its own identity). */
export interface SpeakOptions {
  /** ElevenLabs voice id override. */
  voiceId?: string;
  /** Piper voice model path override. */
  piperVoice?: string;
  /** BCP-47 language tag (e.g. "hi-IN", "ur-PK") — ElevenLabs multilingual
   *  auto-detects from the text; this hints Web Speech / future engines. */
  lang?: string;
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

class VoiceEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuf = new Uint8Array(1024);

  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private player: HTMLAudioElement | null = null;
  private webSpeech: { stop: () => void } | null = null;
  private webSpeechText = "";

  /* ── Level metering (0..1) for the waveform canvas ── */
  getLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.levelBuf);
    let sum = 0;
    for (let i = 0; i < this.levelBuf.length; i++) {
      const v = (this.levelBuf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.levelBuf.length) * 4);
  }

  private ensureCtx(): AudioContext {
    this.ctx ??= new AudioContext();
    return this.ctx;
  }

  private attachAnalyser(node: AudioNode) {
    const ctx = this.ensureCtx();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    node.connect(this.analyser);
  }

  /* ── Listening ────────────────────────────────────── */
  async startListening(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = this.ensureCtx();
    await ctx.resume();
    this.attachAnalyser(ctx.createMediaStreamSource(this.stream));

    this.chunks = [];
    // Cross-platform mime: Chromium/WebView2 records webm; macOS WKWebView
    // (Safari engine) records mp4. Whisper/ffmpeg sniffs content, so any works.
    const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find(
      (m) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(m),
    );
    this.recorder = mime
      ? new MediaRecorder(this.stream, { mimeType: mime })
      : new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(250);
    if (!IS_TAURI) this.startWebSpeechLive();
  }

  /** Stops recording and returns the transcribed text. */
  async stopListening(whisperModel: string): Promise<string> {
    const recorder = this.recorder;
    if (!recorder) return "";

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.analyser = null;
    this.webSpeech?.stop();
    this.webSpeech = null;
    const liveText = this.webSpeechText.trim();
    this.webSpeechText = "";

    if (blob.size < 1000 && !liveText) return ""; // nothing captured

    if (!IS_TAURI) {
      if (liveText) return liveText;
      throw new Error("Voice typing needs Chromium speech recognition, or the Tauri Whisper build.");
    }
    const { invoke } = await import("@tauri-apps/api/core");
    const audioB64 = await blobToBase64(blob);
    return await invoke<string>("transcribe_audio", {
      audioB64,
      model: whisperModel,
    });
  }

  /* ── Speaking ─────────────────────────────────────── */
  /**
   * Speaks `text`. `opts` lets callers override the voice per utterance —
   * this is how each sub-agent gets its own recognizable voice identity.
   * Fallback chain: ElevenLabs → Piper → Web Speech API (browser built-in).
   */
  async speak(text: string, s: Settings, opts?: SpeakOptions): Promise<void> {
    if (!text.trim()) return;
    let audioBlob: Blob;

    try {
      if (s.ttsEngine === "elevenlabs" && s.elevenKey) {
        try {
          audioBlob = await this.elevenLabsTts(text, s, opts);
        } catch (e) {
          console.warn("ElevenLabs failed, falling back to Piper:", e);
          audioBlob = await this.piperTts(text, s, opts);
        }
      } else {
        audioBlob = await this.piperTts(text, s, opts);
      }
    } catch (e) {
      // Last resort — Web Speech API, so Cinem AI Assistant is never mute (e.g. plain
      // browser dev with no ElevenLabs key and no desktop Piper).
      console.warn("All TTS engines failed, using Web Speech API:", e);
      await this.webSpeechTts(text, opts?.lang);
      return;
    }

    await this.play(audioBlob);
  }

  private async elevenLabsTts(text: string, s: Settings, opts?: SpeakOptions): Promise<Blob> {
    // tauri-plugin-http bypasses CORS inside the desktop app; in plain
    // browser dev we fall back to window.fetch (may be blocked by CORS).
    const doFetch = IS_TAURI
      ? (await import("@tauri-apps/plugin-http")).fetch
      : window.fetch.bind(window);

    const res = await doFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${opts?.voiceId || s.elevenVoiceId}`,
      {
        method: "POST",
        headers: { "xi-api-key": s.elevenKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.8 },
        }),
      },
    );
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    // Usage metering: ElevenLabs bills per character of input text.
    reportUsage("tts", text.length);
    return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
  }

  private async piperTts(text: string, s: Settings, opts?: SpeakOptions): Promise<Blob> {
    if (!IS_TAURI) throw new Error("Piper requires the desktop build.");
    const { invoke } = await import("@tauri-apps/api/core");
    const wavB64 = await invoke<string>("piper_speak", {
      text,
      voiceModel: opts?.piperVoice || s.piperVoicePath,
    });
    return b64ToBlob(wavB64, "audio/wav");
  }

  /** Chromium / Electron live STT — Whisper stays Tauri-only for now. */
  private startWebSpeechLive() {
    const host = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
        onerror: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
        onerror: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript || "";
      if (text.trim()) this.webSpeechText = text.trim();
    };
    rec.onerror = () => undefined;
    try {
      rec.start();
      this.webSpeech = rec;
    } catch {
      this.webSpeech = null;
    }
  }

  /** Browser-native TTS — zero-dependency last resort. */
  private webSpeechTts(text: string, lang?: string): Promise<void> {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (lang) {
        u.lang = lang;
        const match = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.split("-")[0]));
        if (match) u.voice = match;
      }
      u.rate = 1.02;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  private async play(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.player = audio;

    // Meter the playback so the waveform reacts while Cinem AI Assistant speaks
    const ctx = this.ensureCtx();
    await ctx.resume();
    const src = ctx.createMediaElementSource(audio);
    this.attachAnalyser(src);
    this.analyser!.connect(ctx.destination);

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
      audio.play().catch(reject);
    });

    this.analyser = null;
    this.player = null;
    URL.revokeObjectURL(url);
  }

  stopSpeaking() {
    this.player?.pause();
    this.player = null;
    this.analyser = null;
  }
}

/** Singleton voice engine. */
export const voice = new VoiceEngine();
