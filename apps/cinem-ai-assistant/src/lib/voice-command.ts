import { voice } from "@/lib/voice";
import { speakQueued } from "@/lib/announcer";
import { processCommand } from "@/lib/orchestrator";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";

/** Shared mic toggle for Chat composer + the bottom voice bar. */
export async function toggleVoiceCommand(): Promise<void> {
  const status = useAppStore.getState().voiceStatus;
  const setStatus = useAppStore.getState().setVoiceStatus;
  const settings = useSettingsStore.getState();

  if (status === "idle") {
    try {
      await voice.startListening();
      setStatus("listening");
    } catch (e) {
      notify(
        "error",
        `Microphone unavailable: ${e instanceof Error ? e.message : e}. Allow mic access for CINEM Pro, then try again.`,
      );
    }
    return;
  }

  if (status === "listening") {
    setStatus("transcribing");
    try {
      const text = await voice.stopListening(settings.whisperModel, settings);
      if (!text) {
        notify("info", "No speech detected.");
        setStatus("idle");
        return;
      }
      const reply = await processCommand(text);
      setStatus("speaking");
      await speakQueued(reply);
    } catch (e) {
      notify("error", `Voice error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setStatus("idle");
    }
    return;
  }

  if (status === "speaking") {
    voice.stopSpeaking();
    setStatus("idle");
  }
}
