import { voice } from "@/lib/voice";
import { speakQueued } from "@/lib/announcer";
import { processCommand } from "@/lib/orchestrator";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import { isIrisPackEnabled } from "@/lib/iris/feature";
import {
  clearLiveInterim,
  patchLiveTranscriptReply,
  pushLiveTranscriptHeard,
  setLiveInterim,
} from "@/lib/iris/live-transcript";

/** Shared mic toggle for Chat composer + the bottom voice bar. */
export async function toggleVoiceCommand(): Promise<void> {
  const app = useAppStore.getState();
  const status = app.voiceStatus;
  const setStatus = app.setVoiceStatus;
  const settings = useSettingsStore.getState();

  if (status === "idle") {
    try {
      app.setOrbError(null);
      await voice.startListening();
      setStatus("listening");
      if (isIrisPackEnabled({ devEnabled: settings.irisPackDevEnabled })) {
        setLiveInterim("…");
      }
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
    clearLiveInterim();
    let transcriptId: string | null = null;
    try {
      const text = await voice.stopListening(settings.whisperModel, settings);
      if (!text) {
        notify("info", "No speech detected.");
        setStatus("idle");
        return;
      }
      if (isIrisPackEnabled({ devEnabled: settings.irisPackDevEnabled })) {
        transcriptId = pushLiveTranscriptHeard(text);
      }
      const reply = await processCommand(text);
      if (transcriptId) patchLiveTranscriptReply(transcriptId, reply);
      setStatus("speaking");
      await speakQueued(reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      app.setOrbError(msg);
      notify("error", `Voice error: ${msg}`);
    } finally {
      setStatus("idle");
      clearLiveInterim();
    }
    return;
  }

  if (status === "speaking") {
    voice.stopSpeaking();
    setStatus("idle");
  }
}
