/**
 * Grok video-generation progress store (Phase 2).
 */
import { create } from "zustand";
import { generateAllScenes, type SceneResult } from "@/lib/grokGen";
import { useScriptStore } from "@/store/useScriptStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ensureSidecar, PW_HEALTH } from "@/lib/sidecars";
import { sidecarFailureReason } from "@/lib/sandbox";

type RowPhase = "queued" | "generating" | "done" | "error";
interface Row { index: number; phase: RowPhase; message: string }

interface GrokState {
  open: boolean;
  rows: Row[];
  folder: string; // where scenes are saved
  close: () => void;
  /** Generates clips for the ACTIVE script's scenes. Returns a reply. */
  run: () => Promise<string>;
}

export const useGrokStore = create<GrokState>((set) => ({
  open: false,
  rows: [],
  folder: "",

  close: () => set({ open: false }),

  run: async () => {
    const script = useScriptStore.getState().script;
    const clips = useSettingsStore.getState().clipsFolder;
    if (!script) return "Pehle ek script banayein (\"X pe video script bana do\").";
    if (!clips) return "Settings → API → NOVA mein clips folder set karein.";

    const folder = `${clips.replace(/[\\/]+$/, "")}\\CINEM-AI-ASSISTANT_Scenes`;
    set({
      open: true, folder,
      rows: script.scenes.map((_, i) => ({ index: i, phase: "queued", message: "Queued" })),
    });

    if (!(await ensureSidecar(PW_HEALTH))) {
      const why = await sidecarFailureReason("playwright");
      set((s) => ({ rows: s.rows.map((r) => ({ ...r, phase: "error", message: "Browser engine offline" })) }));
      return why;
    }

    const patch = (i: number, u: Partial<Row>) =>
      set((s) => ({ rows: s.rows.map((r) => (r.index === i ? { ...r, ...u } : r)) }));

    const results = await generateAllScenes(
      script.scenes, clips, script.title,
      (i, res: SceneResult | "start") => {
        if (res === "start") patch(i, { phase: "generating", message: "Grok mein generate ho raha hai…" });
        else if (res.ok) patch(i, { phase: "done", message: "Downloaded" });
        else patch(i, { phase: "error", message: res.error || res.stage || "Failed" });
      },
    );

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    if (fail === 0) return `Sab ${ok} scenes ban gaye → ${folder}\\${script.title.slice(0, 30)}. Ab Phase 3 (stitch + edit).`;
    return `${ok} scenes ban gaye, ${fail} reh gaye (browser mein dekhein — captcha/limit ya selector). Jo reh gaye unhe manually generate karke folder mein daal dein.`;
  },
}));
