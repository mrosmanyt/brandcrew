import { useEffect, useRef } from "react";
import { Mic, Square, Loader2, AudioLines, Languages } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { voice } from "@/lib/voice";
import { toggleVoiceCommand } from "@/lib/voice-command";
import { glowRGB } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Waveform canvas. Blends a synthetic idle motion with REAL audio levels
 * from the voice engine (mic while listening, playback while speaking).
 */
function Waveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let t = 0;
    let smoothed = 0;

    const draw = () => {
      const status = useAppStore.getState().voiceStatus;
      const live = voice.getLevel(); // 0..1 real amplitude
      const target =
        status === "listening" || status === "speaking"
          ? 0.25 + live * 1.6
          : status === "transcribing"
            ? 0.5
            : 0.3;
      smoothed += (target - smoothed) * 0.12; // ease toward target

      const { width: w, height: h } = canvas.getBoundingClientRect();
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const mid = h / 2;
      const barW = 3;
      const gap = 3;
      const n = Math.floor(w / (barW + gap));
      const glow = glowRGB(); // live theme accent — re-tints on theme switch

      for (let i = 0; i < n; i++) {
        const x = i * (barW + gap);
        const v =
          Math.sin(i * 0.32 + t * 2.1) * 0.5 +
          Math.sin(i * 0.13 - t * 1.4) * 0.3 +
          Math.sin(i * 0.51 + t * 3.2) * 0.2;
        const bh = Math.max(2, Math.abs(v) * mid * 0.9 * Math.min(1.4, smoothed));
        const alpha = 0.35 + Math.abs(v) * 0.65;
        ctx.fillStyle = `rgba(${glow}, ${alpha.toFixed(2)})`;
        ctx.fillRect(x, mid - bh, barW, bh * 2);
      }
      t += 0.016;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}

const STATUS_LABEL = {
  idle: "VOICE STANDBY",
  listening: "LISTENING…",
  transcribing: "TRANSCRIBING…",
  speaking: "Cinem AI Assistant SPEAKING…",
} as const;

/**
 * Bottom bar — fully functional voice command center:
 * mic → record → Faster-Whisper STT → chat → ElevenLabs/Piper TTS reply.
 */
export default function VoiceCommandBar() {
  const status = useAppStore((s) => s.voiceStatus);
  const language = useAppStore((s) => s.language);

  const onMicClick = () => {
    void toggleVoiceCommand();
  };

  const busy = status === "transcribing";

  return (
    <footer className="flex h-20 shrink-0 items-stretch gap-4 px-4 pb-3">
      {/* Mic toggle */}
      <div className="glass flex items-center gap-2 px-4">
        <button
          onClick={onMicClick}
          disabled={busy}
          className={cn(
            "flex size-11 items-center justify-center rounded-full border transition-all",
            status === "listening"
              ? "border-neon bg-neon/20 text-neon shadow-[0_0_18px_rgba(var(--glow),0.5)]"
              : status === "speaking"
                ? "border-amber-300/70 bg-amber-400/10 text-amber-200"
                : "border-neon/30 text-neon-dim hover:border-neon/60 hover:text-neon",
            busy && "opacity-60",
          )}
          aria-label="Toggle voice"
          title={status === "listening" ? "Stop & transcribe" : "Start listening"}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : status === "listening" || status === "speaking" ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-5" />
          )}
        </button>
        <AudioLines className="size-4 text-neon-dim" />
      </div>

      {/* Waveform */}
      <div className="glass min-w-0 flex-1 overflow-hidden px-3 py-2">
        <Waveform />
      </div>

      {/* Language indicator — follows the user's last message automatically */}
      <div
        className="glass flex items-center gap-2 px-4"
        title={`Cinem AI Assistant is replying in ${language.name} (auto-detected)`}
      >
        <Languages
          className={cn(
            "size-4 transition-colors",
            language.code === "en" ? "text-neon-dim" : "text-neon",
          )}
        />
        <motion.span
          key={language.code}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn(
            "whitespace-nowrap font-display text-[0.62rem] font-bold tracking-[0.12em]",
            language.code === "en" ? "text-neon-dim" : "text-neon drop-shadow-[0_0_6px_rgba(var(--glow),0.5)]",
          )}
        >
          {language.nativeName}
        </motion.span>
      </div>

      {/* Status */}
      <div className="glass flex items-center px-5">
        <div
          className={cn(
            "font-display text-[0.6rem] tracking-[0.25em]",
            status === "idle" ? "text-neon-dim" : "text-neon",
          )}
        >
          {STATUS_LABEL[status]}
        </div>
      </div>
    </footer>
  );
}
