/**
 * Script Studio store — drives the script panel and holds the active script
 * (handed to Phase 2 / Grok video generation).
 */
import { create } from "zustand";
import { generateScript, type VideoScript } from "@/lib/scriptStudio";
import { useSettingsStore } from "@/store/useSettingsStore";

type Phase = "idle" | "working" | "done" | "error";

interface ScriptState {
  open: boolean;
  phase: Phase;
  stage: string;
  script: VideoScript | null;
  error: string;
  close: () => void;
  /** Generates a script for a topic. Returns a short reply for chat. */
  generate: (topic: string) => Promise<string>;
}

export const useScriptStore = create<ScriptState>((set) => ({
  open: false,
  phase: "idle",
  stage: "",
  script: null,
  error: "",

  close: () => set({ open: false }),

  generate: async (topic) => {
    if (!topic.trim()) {
      return "Kis topic pe video script chahiye? Topic batayein (e.g. \"AI tools for students\").";
    }
    set({ open: true, phase: "working", stage: "Starting…", script: null, error: "" });
    try {
      const script = await generateScript(topic, useSettingsStore.getState(), (stage) => set({ stage }));
      set({ phase: "done", script, stage: "Ready" });
      return `Script ready: "${script.title}" — ${script.scenes.length} scenes. Panel mein dekh lein.`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ phase: "error", error: msg });
      return `Script generate nahi hua: ${msg} (Claude/Gemini key set hai?)`;
    }
  },
}));
