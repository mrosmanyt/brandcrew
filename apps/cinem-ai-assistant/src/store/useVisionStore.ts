/**
 * Vision store — camera / screen-share capture + Gemini Vision analysis.
 * The live preview lives in VisionPanel; capture works off the raw stream so
 * the orchestrator can analyze frames even before the panel paints.
 */
import { create } from "zustand";
import {
  getCameraStream, getScreenStream, captureFromStream, buildVisionPrompt,
} from "@/lib/vision";
import { chatVision } from "@/lib/llm";
import { useSettingsStore } from "@/store/useSettingsStore";

export type VisionMode = "off" | "camera" | "screen";

interface VisionState {
  mode: VisionMode;
  stream: MediaStream | null;
  analyzing: boolean;
  result: string;
  error: string;

  enableCamera: () => Promise<void>;
  enableScreen: () => Promise<void>;
  disable: () => void;
  /** Captures the current frame and analyzes it. Returns the description. */
  analyze: (userText: string) => Promise<string>;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export const useVisionStore = create<VisionState>((set, get) => ({
  mode: "off",
  stream: null,
  analyzing: false,
  result: "",
  error: "",

  enableCamera: async () => {
    stopStream(get().stream);
    set({ error: "", result: "" });
    try {
      const stream = await getCameraStream();
      set({ mode: "camera", stream });
    } catch (e) {
      set({ mode: "off", stream: null, error: humanError(e, "camera") });
      throw e;
    }
  },

  enableScreen: async () => {
    stopStream(get().stream);
    set({ error: "", result: "" });
    try {
      const stream = await getScreenStream();
      // If the user stops sharing via the browser/OS control, reset.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => get().disable());
      set({ mode: "screen", stream });
    } catch (e) {
      set({ mode: "off", stream: null, error: humanError(e, "screen") });
      throw e;
    }
  },

  disable: () => {
    stopStream(get().stream);
    set({ mode: "off", stream: null, analyzing: false });
  },

  analyze: async (userText) => {
    let { stream, mode } = get();
    if (!stream) {
      await get().enableCamera(); // default to camera if nothing is active
      stream = get().stream;
      mode = get().mode;
    }
    if (!stream) throw new Error("No camera or screen is active.");

    set({ analyzing: true, error: "", result: "" });
    try {
      const frame = await captureFromStream(stream);
      const prompt = buildVisionPrompt(userText, mode === "screen" ? "screen" : "camera");
      const text = (await chatVision(prompt, frame, useSettingsStore.getState())).trim();
      set({ analyzing: false, result: text });
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ analyzing: false, error: msg });
      throw new Error(msg);
    }
  },
}));

function humanError(e: unknown, what: "camera" | "screen"): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/denied|notallowed/i.test(msg)) {
    return `${what === "camera" ? "Camera" : "Screen"} permission was denied. Allow access and try again.`;
  }
  if (/notfound|devicesnotfound/i.test(msg)) return "No camera device was found.";
  return `Couldn't start ${what}: ${msg}`;
}
