/**
 * Sweet Hinglish "boss" persona — optional casual TTS styling.
 * Text transforms only; no secrets. Wired through speakQueued → voice.speak.
 */
import type { Settings } from "@/store/useSettingsStore";

const WAKE_ACKS = [
  "Haan boss, boliye.",
  "Ji boss, sun raha hoon.",
  "Yes boss, I'm listening.",
  "Bolo boss, main hoon.",
];

const BOSS_OPENERS = ["Boss, ", "Dekho boss — ", "Theek hai boss, "];

/** Short wake-word acknowledgment (spoken before PTT capture). */
export function wakeAckLine(hinglishBossPersona: boolean): string {
  if (!hinglishBossPersona) return "Yes?";
  return WAKE_ACKS[Math.floor(Math.random() * WAKE_ACKS.length)];
}

/** Light Hinglish seasoning on assistant replies when persona is on. */
export function applyHinglishBossPersona(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length < 12) return trimmed;
  if (/boss/i.test(trimmed)) return trimmed;
  const opener = BOSS_OPENERS[Math.floor(Math.random() * BOSS_OPENERS.length)];
  if (trimmed.endsWith("?")) {
    return `${opener}${trimmed}`;
  }
  if (Math.random() < 0.35) {
    return `${trimmed} Theek hai na boss?`;
  }
  return `${opener}${trimmed}`;
}

/** Apply persona before TTS when the setting is enabled. */
export function applySpeakPersona(text: string, settings: Pick<Settings, "hinglishBossPersona">): string {
  if (!settings.hinglishBossPersona) return text;
  return applyHinglishBossPersona(text);
}
