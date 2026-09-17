/**
 * Wake word "Hey Cinem" — best-effort local detection stub + PTT fallback.
 */
import { useSettingsStore } from "@/store/useSettingsStore";

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const WAKE_PHRASE = "hey cinem";
const LS_WAKE = "cinem-ai-assistant-wake-enabled";

let listening = false;
let recognition: SpeechRecognition | null = null;

export function wakeWordSupported() {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function wakeWordEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_WAKE) === "1";
}

export function setWakeWordEnabled(on: boolean) {
  localStorage.setItem(LS_WAKE, on ? "1" : "0");
  if (!on) stopWakeWord();
}

/** Start continuous listen for "Hey Cinem" when Web Speech API is available (stub). */
export function startWakeWord(onTrigger: () => void) {
  if (!wakeWordEnabled() || listening || !wakeWordSupported()) return;
  const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
  if (!SR) return;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = useSettingsStore.getState().preferredLanguage === "auto" ? "en-US" : useSettingsStore.getState().preferredLanguage;
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript.toLowerCase();
      if (text.includes(WAKE_PHRASE)) {
        onTrigger();
        break;
      }
    }
  };
  recognition.onend = () => {
    listening = false;
    if (wakeWordEnabled()) {
      setTimeout(() => startWakeWord(onTrigger), 800);
    }
  };
  recognition.onerror = () => {
    listening = false;
  };
  try {
    recognition.start();
    listening = true;
  } catch {
    listening = false;
  }
}

export function stopWakeWord() {
  listening = false;
  try {
    recognition?.stop();
  } catch {
    /* ignore */
  }
  recognition = null;
}

export const WAKE_WORD_DOCS =
  "Wake word uses browser speech recognition when available. For always-on offline wake, native ONNX/Vosk is planned — use the mic button (PTT) today.";
