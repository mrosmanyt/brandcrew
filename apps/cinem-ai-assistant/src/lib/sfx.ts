/**
 * Cinem AI Assistant sound design layer — fully synthesized WebAudio SFX (no assets).
 * Subtle, fast, and gated by the "UI Sounds" setting. Half of the JARVIS
 * illusion is audio: ticks, chirps and stings under every key interaction.
 */
import { useSettingsStore } from "@/store/useSettingsStore";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function enabled(): boolean {
  return useSettingsStore.getState().uiSounds;
}

/** One enveloped oscillator note. */
function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; sweepTo?: number; delay?: number } = {},
) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(opts.vol ?? 0.05, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** Tiny UI tick (boot registrations, palette navigation). */
  tick() {
    if (!enabled()) return;
    tone(2200, 0.045, { type: "square", vol: 0.025 });
  },
  /** Window / palette opens — soft downward whoosh. */
  open() {
    if (!enabled()) return;
    tone(880, 0.18, { sweepTo: 330, vol: 0.04 });
  },
  /** Task complete — two-note confirmation chirp. */
  done() {
    if (!enabled()) return;
    tone(660, 0.09, { vol: 0.05 });
    tone(990, 0.14, { vol: 0.05, delay: 0.09 });
  },
  /** Error buzz. */
  error() {
    if (!enabled()) return;
    tone(150, 0.22, { type: "sawtooth", vol: 0.04 });
  },
  /** Agent activation sting — quick rising fifth. */
  activate() {
    if (!enabled()) return;
    tone(523, 0.07, { vol: 0.045 });
    tone(784, 0.16, { vol: 0.045, delay: 0.07 });
  },
};
