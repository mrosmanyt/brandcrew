/**
 * Thumbnail generation store — drives the thumbnail grid panel.
 */
import { create } from "zustand";
import { generateThumbnails, type Thumbnail } from "@/lib/thumbnails";
import { useSettingsStore } from "@/store/useSettingsStore";

type Phase = "idle" | "working" | "done" | "error";

interface ThumbState {
  open: boolean;
  phase: Phase;
  stage: string;
  items: Thumbnail[];
  selected: string | null; // chosen thumbnail path (for upload attach)
  error: string;

  close: () => void;
  select: (path: string) => void;
  /** Generates 6 styled thumbnails for a video. Returns a reply string. */
  generate: (video: string) => Promise<string>;
}

export const useThumbStore = create<ThumbState>((set) => ({
  open: false,
  phase: "idle",
  stage: "",
  items: [],
  selected: null,
  error: "",

  close: () => set({ open: false }),
  select: (path) => set({ selected: path }),

  generate: async (video) => {
    set({ open: true, phase: "working", stage: "Starting…", items: [], selected: null, error: "" });
    try {
      const items = await generateThumbnails(video, useSettingsStore.getState(), (stage) => set({ stage }));
      set({ phase: "done", items, stage: "Ready — pick one" });
      return `${items.length} thumbnails ban gaye — grid mein se ek choose karein.`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ phase: "error", error: msg });
      return `Thumbnails generate nahi hue: ${msg}`;
    }
  },
}));
