/**
 * Cinem AI Assistant voice engine (Phase 2).
 *  - Listening : mic capture (MediaRecorder) + live level metering
 *  - STT       : Faster-Whisper (Tauri) or Chromium speech recognition (Electron)
 *  - Speaking  : Fish Audio (optional key) → ElevenLabs → Piper (Tauri) →
 *                Windows / Edge Neural Web Speech. Whisper is never used as TTS.
 * The waveform bar reads `voice.getLevel()` each frame for real amplitude.
 */
import type { Settings } from "@/store/useSettingsStore";
import { useAppStore } from "@/store/useAppStore";
import { reportUsage } from "@/lib/usage";
import {
    resolveCharacterForSpeak,
  envFishAudioKey,
  FISH_AUDIO_DEFAULT_MODEL,
  FISH_AUDIO_TTS_URL,
  pickWebSpeechVoice,
  resolveFishApiKey,
  resolveFishVoiceId,
  webSpeechProsody,
  type CharacterVoice,
} from "@/lib/character-voices";

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
  /** BCP-47 language tag (e.g. "hi-IN", "ur-PK") — Fish / ElevenLabs multilingual
   *  auto-detect from the text; this hints Web Speech. */
  lang?: string;
  /** Named character from Settings → Voice. */
  characterId?: string;
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
   * Speaks `text`. `opts` lets callers override the voice per utterance.
   * Chain: Fish Audio (optional key) → ElevenLabs → Piper (Tauri only) →
   * sweet Web Speech. Never leaves the harsh default clip as the only path.
   */
  async speak(text: string, s: Settings, opts?: SpeakOptions): Promise<void> {
    if (!text.trim()) return;
    const character = resolveCharacterForSpeak(opts?.characterId || s.characterVoice, opts?.lang);
    const lang = opts?.lang || character.bcp47;
    const engine = s.ttsEngine || "auto";
    const fishKey = resolveFishApiKey({ fishAudioKey: s.fishAudioKey, envKey: envFishAudioKey() });
    const tryFish = Boolean(fishKey) && (engine === "auto" || engine === "fish");
    const tryEleven = Boolean(s.elevenKey) && (engine === "auto" || engine === "elevenlabs");
    const tryPiper = IS_TAURI && (engine === "piper" || (engine === "auto" && !fishKey && !s.elevenKey));

    if (tryFish) {
      try {
        await this.play(await this.fishAudioTts(text, s, opts, character, fishKey));
        return;
      } catch (e) {
        console.warn("Fish Audio failed, trying next TTS:", e);
      }
    }
    if (tryEleven) {
      try {
        await this.play(await this.elevenLabsTts(text, s, opts));
        return;
      } catch (e) {
        console.warn("ElevenLabs failed, trying next TTS:", e);
      }
    }
    if (tryPiper) {
      try {
        await this.play(await this.piperTts(text, s, opts));
        return;
      } catch (e) {
        console.warn("Piper failed, using Web Speech:", e);
      }
    }
    await this.webSpeechTts(text, lang, character);
  }

  private async fishAudioTts(
    text: string,
    s: Settings,
    opts: SpeakOptions | undefined,
    character: CharacterVoice,
    apiKey: string,
  ): Promise<Blob> {
    const referenceId = resolveFishVoiceId(character, s.fishVoiceIds);
    const res = await fetch(FISH_AUDIO_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: s.fishModel?.trim() || FISH_AUDIO_DEFAULT_MODEL,
      },
      body: JSON.stringify({
        text,
        format: "mp3",
        ...(referenceId ? { reference_id: referenceId } : {}),
        prosody: { speed: 0.96, volume: 0, normalize_loudness: true },
      }),
    });
    if (!res.ok) throw new Error(`Fish Audio ${res.status}: ${await res.text()}`);
    reportUsage("tts", text.length);
    return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
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
    rec.lang = this.webSpeechListenLang();
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

  private webSpeechListenLang(): string {
    return useAppStore.getState().language.bcp47 || "en-US";
  }

  private async loadWebSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!("speechSynthesis" in window)) return [];
    const now = window.speechSynthesis.getVoices();
    if (now.length) return now;
    return await new Promise((resolve) => {
      const done = () => resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
      setTimeout(done, 1200);
    });
  }

  /** Browser-native TTS — Neural/Natural voices, never the harsh default clip. */
  private async webSpeechTts(text: string, lang?: string, character?: CharacterVoice): Promise<void> {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const voices = await this.loadWebSpeechVoices();
    const picked = pickWebSpeechVoice(voices, {
      lang: lang || character?.bcp47 || "en-US",
      gender: character?.gender,
      hints: character?.osHints,
    });
    const u = new SpeechSynthesisUtterance(text);
    u.lang = picked?.lang || lang || character?.bcp47 || "en-US";
    if (picked) u.voice = picked;
    const prosody = webSpeechProsody();
    u.rate = prosody.rate;
    u.pitch = prosody.pitch;
    await new Promise<void>((resolve) => {
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

/** Singleton voice engine. */
export const voice = new VoiceEngine();
