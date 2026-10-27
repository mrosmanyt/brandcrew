/**
 * NOVA editing progress store — drives the floating progress panel.
 */
import { create } from "zustand";
import {
  startEdit, startAssemble, pollJob, isNovaUp, openCapcut, STYLE_LABEL, type EditStyle,
} from "@/lib/nova";
import { ensureSidecar, NOVA_HEALTH } from "@/lib/sidecars";
import { sidecarFailureReason } from "@/lib/sandbox";

type Phase = "idle" | "starting" | "running" | "done" | "error";

interface NovaState {
  open: boolean;
  phase: Phase;
  style: EditStyle | null;
  percent: number;
  stage: string;
  output: string;
  error: string;
  folder: string;

  close: () => void;
  /** Starts an edit job and tracks it to completion. Returns a reply string. */
  edit: (folder: string, style: EditStyle, count: number, capcutPath?: string) => Promise<string>;
  /** Stitches Grok scene clips → one graded final video (Phase 3). */
  assemble: (scenesFolder: string, outDir: string, style: EditStyle) => Promise<string>;
}

let poller: ReturnType<typeof setInterval> | null = null;
const stop = () => { if (poller) { clearInterval(poller); poller = null; } };

export const useNovaStore = create<NovaState>((set) => ({
  open: false,
  phase: "idle",
  style: null,
  percent: 0,
  stage: "",
  output: "",
  error: "",
  folder: "",

  close: () => { stop(); set({ open: false, phase: "idle" }); },

  edit: async (folder, style, count, capcutPath) => {
    stop();
    set({ open: true, phase: "starting", style, percent: 0, stage: "Connecting to NOVA…", output: "", error: "", folder });

    if (!(await isNovaUp())) {
      set({ stage: "NOVA engine start kar raha hoon…" });
      const up = await ensureSidecar(NOVA_HEALTH);
      if (!up) {
        const why = await sidecarFailureReason("media");
        set({ phase: "error", error: why });
        return why;
      }
    }

    let started;
    try {
      started = await startEdit(folder, style, count);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ phase: "error", error: msg });
      return `Edit start nahi hua: ${msg}`;
    }

    set({ phase: "running", stage: `Editing ${started.count} clip(s)…` });

    return await new Promise<string>((resolve) => {
      poller = setInterval(async () => {
        try {
          const j = await pollJob(started.jobId);
          set({ percent: j.percent, stage: j.stage });
          if (j.state === "done") {
            stop();
            set({ phase: "done", percent: 100, output: j.output, stage: "Export complete" });
            if (capcutPath) void openCapcut(folder, capcutPath);
            resolve(`Ho gaya! ${STYLE_LABEL[style]} edit ready hai — ${started.count} clips. Export: ${j.output}`);
          } else if (j.state === "error") {
            stop();
            set({ phase: "error", error: j.error });
            resolve(`Editing fail hui: ${j.error}`);
          }
        } catch {
          /* transient — keep polling */
        }
      }, 1500);
    });
  },

  assemble: async (scenesFolder, outDir, style) => {
    stop();
    set({ open: true, phase: "starting", style, percent: 0, stage: "Connecting to NOVA…", output: "", error: "", folder: outDir });

    if (!(await isNovaUp())) {
      set({ stage: "NOVA engine start kar raha hoon…" });
      if (!(await ensureSidecar(NOVA_HEALTH))) {
        const why = await sidecarFailureReason("media");
        set({ phase: "error", error: why });
        return why;
      }
    }

    let started;
    try {
      started = await startAssemble(scenesFolder, outDir, style);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ phase: "error", error: msg });
      return `Assemble start nahi hua: ${msg}`;
    }

    set({ phase: "running", stage: `Stitching ${started.count} scenes…` });
    return await new Promise<string>((resolve) => {
      poller = setInterval(async () => {
        try {
          const j = await pollJob(started.jobId);
          set({ percent: j.percent, stage: j.stage });
          if (j.state === "done") {
            stop();
            set({ phase: "done", percent: 100, output: j.output, stage: "Final video ready" });
            resolve(`Final video ban gaya (${started.count} scenes joined): ${j.output}. Ab thumbnail/upload kar sakte hain.`);
          } else if (j.state === "error") {
            stop();
            set({ phase: "error", error: j.error });
            resolve(`Assemble fail hui: ${j.error}`);
          }
        } catch { /* keep polling */ }
      }, 1500);
    });
  },
}));
