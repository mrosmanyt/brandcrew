/**
 * Live voice transcript helpers — pairs heard speech with assistant replies.
 */
import { useAppStore } from "@/store/useAppStore";

export interface LiveTranscriptEntry {
  id: string;
  heard: string;
  reply?: string;
  time: string;
  interim?: boolean;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const uid = () => crypto.randomUUID();

/** Append or update the live transcript sidebar (IRIS pack). */
export function pushLiveTranscriptHeard(heard: string, interim = false): string {
  const app = useAppStore.getState();
  const id = uid();
  app.pushLiveTranscript({
    id,
    heard,
    time: now(),
    interim,
  });
  return id;
}

export function patchLiveTranscriptReply(id: string, reply: string): void {
  useAppStore.getState().patchLiveTranscript(id, { reply, interim: false });
}

export function setLiveInterim(heard: string): void {
  useAppStore.getState().setLiveInterim(heard);
}

export function clearLiveInterim(): void {
  useAppStore.getState().setLiveInterim("");
}
