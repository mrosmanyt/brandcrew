/**
 * Wake word "Hey Cinem" — Porcupine offline (Electron) + Web Speech fallback + deep sleep.
 */
import { useSettingsStore } from "@/store/useSettingsStore";
import { cinemDesktopBridge, isCinemElectron } from "@/lib/desktop-shell";
import { speakQueued } from "@/lib/announcer";

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const WAKE_PHRASE = "hey cinem";
const LS_WAKE = "cinem-ai-assistant-wake-enabled";
const LS_ENGINE = "cinem-ai-assistant-wake-engine";

export type WakeEngine = "porcupine" | "web-speech" | "off";

let listening = false;
let deepSleep = false;
let recognition: SpeechRecognition | null = null;
let onTriggerRef: (() => void) | null = null;
let nativeUnsub: (() => void) | null = null;

/** Optional TTS ack when wake word fires (voice chain; silent if no TTS provider). */
function wakeWordTtsAck() {
  void speakQueued("Yes?").catch(() => undefined);
}

function fireWakeTrigger(onTrigger: () => void) {
  wakeWordTtsAck();
  onTrigger();
}

export function wakeWordSupported() {
  if (isCinemElectron()) return true;
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function wakeWordEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_WAKE) === "1";
}

export function wakeWordEngine(): WakeEngine {
  if (typeof window === "undefined") return "off";
  const stored = localStorage.getItem(LS_ENGINE);
  if (stored === "porcupine" || stored === "web-speech") return stored;
  return isCinemElectron() ? "porcupine" : "web-speech";
}

export function setWakeWordEnabled(on: boolean) {
  localStorage.setItem(LS_WAKE, on ? "1" : "0");
  if (!on) stopWakeWord();
}

export function setWakeDeepSleep(on: boolean) {
  deepSleep = on;
  const bridge = cinemDesktopBridge();
  if (bridge?.wakeWord?.setDeepSleep) {
    void bridge.wakeWord.setDeepSleep(on);
  }
  if (on) stopWebSpeech();
  else if (wakeWordEnabled() && onTriggerRef) void resumeWakeWord(onTriggerRef);
}

async function fetchNativeStatus() {
  const bridge = cinemDesktopBridge();
  if (!bridge?.wakeWord?.status) return null;
  try {
    return await bridge.wakeWord.status();
  } catch {
    return null;
  }
}

function startWebSpeech(onTrigger: () => void) {
  if (deepSleep || listening || !wakeWordSupported()) return;
  const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as
    | SpeechRecognitionCtor
    | undefined;
  if (!SR) return;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang =
    useSettingsStore.getState().preferredLanguage === "auto"
      ? "en-US"
      : useSettingsStore.getState().preferredLanguage;
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript.toLowerCase();
      if (text.includes(WAKE_PHRASE)) {
        fireWakeTrigger(onTrigger);
        break;
      }
    }
  };
  recognition.onend = () => {
    listening = false;
    if (wakeWordEnabled() && !deepSleep) {
      setTimeout(() => startWebSpeech(onTrigger), 800);
    }
  };
  recognition.onerror = () => {
    listening = false;
  };
  try {
    recognition.start();
    listening = true;
    localStorage.setItem(LS_ENGINE, "web-speech");
  } catch {
    listening = false;
  }
}

function stopWebSpeech() {
  listening = false;
  try {
    recognition?.stop();
  } catch {
    /* ignore */
  }
  recognition = null;
}

function attachNativeListener(onTrigger: () => void) {
  nativeUnsub?.();
  const bridge = cinemDesktopBridge();
  if (!bridge?.wakeWord?.onDetected) return false;
  nativeUnsub = bridge.wakeWord.onDetected(() => {
    if (!deepSleep) fireWakeTrigger(onTrigger);
  });
  return true;
}

async function startNative(onTrigger: () => void) {
  const bridge = cinemDesktopBridge();
  if (!bridge?.wakeWord?.start) return false;
  attachNativeListener(onTrigger);
  const status = await bridge.wakeWord.start();
  if (status?.engine === "porcupine") {
    localStorage.setItem(LS_ENGINE, "porcupine");
    return true;
  }
  return false;
}

/** Start wake listening — Porcupine in Electron when configured, else Web Speech. */
export async function startWakeWord(onTrigger: () => void) {
  if (!wakeWordEnabled() || deepSleep) return;
  onTriggerRef = onTrigger;
  stopWakeWord(false);

  if (isCinemElectron()) {
    const native = await startNative(onTrigger);
    if (native) return;
  }
  startWebSpeech(onTrigger);
}

export function stopWakeWord(clearTrigger = true) {
  if (clearTrigger) onTriggerRef = null;
  stopWebSpeech();
  nativeUnsub?.();
  nativeUnsub = null;
  const bridge = cinemDesktopBridge();
  if (bridge?.wakeWord?.stop) void bridge.wakeWord.stop();
}

export async function resumeWakeWord(onTrigger: () => void) {
  if (wakeWordEnabled()) await startWakeWord(onTrigger);
}

export async function wakeWordStatusLine() {
  if (isCinemElectron()) {
    const status = await fetchNativeStatus();
    if (status?.nativeAvailable) {
      return "Offline Porcupine — listening for “Hey Cinem”. Mic button (PTT) always works.";
    }
    if (status?.reason) return `${status.reason} Web Speech fallback is active when online.`;
  }
  return WAKE_WORD_DOCS;
}

export const WAKE_WORD_DOCS =
  "Wake word uses offline Porcupine in Electron when PICOVOICE_ACCESS_KEY and hey-cinem.ppn are set. Otherwise Web Speech runs when online. Deep sleep pauses listening when the window is hidden. Use the mic button (PTT) anytime.";

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    setWakeDeepSleep(document.hidden);
  });
}
