/**
 * Upload progress store — drives the multi-platform upload panel.
 */
import { create } from "zustand";
import {
  generateSeo, uploadVideo, sidecarUp, PLATFORMS,
  type Platform, type PlatformSeo,
} from "@/lib/uploader";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ensureSidecar, PW_HEALTH } from "@/lib/sidecars";
import { sidecarFailureReason } from "@/lib/sandbox";

export type PlatformPhase = "queued" | "seo" | "uploading" | "done" | "error";

interface Row {
  platform: Platform;
  label: string;
  phase: PlatformPhase;
  message: string;
  seo?: PlatformSeo;
}

interface UploadState {
  open: boolean;
  mode: "confirm" | "running" | "done";
  file: string;
  pending: { file: string; platforms: Platform[]; topic: string } | null;
  rows: Row[];
  close: () => void;
  /** Shows the confirmation panel with the resolved video + platforms. */
  prepare: (file: string, platforms: Platform[], topic: string) => void;
  /** User confirmed → start SEO + upload. */
  confirm: () => Promise<string>;
  /** Generates SEO + uploads to each platform. Returns a summary reply. */
  run: (file: string, platforms: Platform[], topic: string) => Promise<string>;
}

const labelOf = (p: Platform) => PLATFORMS.find((x) => x.id === p)?.label ?? p;
const fileName = (p: string) => p.split(/[\\/]/).pop() || p;

export const useUploadStore = create<UploadState>((set, get) => ({
  open: false,
  mode: "confirm",
  file: "",
  pending: null,
  rows: [],

  close: () => set({ open: false, pending: null }),

  prepare: (file, platforms, topic) => {
    set({
      open: true, mode: "confirm", file, pending: { file, platforms, topic },
      rows: platforms.map((p) => ({ platform: p, label: labelOf(p), phase: "queued", message: "Ready" })),
    });
  },

  confirm: async () => {
    const p = get().pending;
    if (!p) return "Koi pending upload nahi hai.";
    set({ mode: "running" });
    return get().run(p.file, p.platforms, p.topic);
  },

  run: async (file, platforms, topic) => {
    set({
      open: true, mode: "running", file,
      rows: platforms.map((p) => ({ platform: p, label: labelOf(p), phase: "queued", message: "Queued" })),
    });

    if (!(await sidecarUp())) {
      set((s) => ({ rows: s.rows.map((r) => ({ ...r, phase: "seo", message: "Engine start kar raha hoon…" })) }));
      const up = await ensureSidecar(PW_HEALTH);
      if (!up) {
        const why = await sidecarFailureReason("playwright");
        set((s) => ({ rows: s.rows.map((r) => ({ ...r, phase: "error", message: "Playwright engine offline" })) }));
        return why;
      }
    }

    const patch = (p: Platform, u: Partial<Row>) =>
      set((s) => ({ rows: s.rows.map((r) => (r.platform === p ? { ...r, ...u } : r)) }));

    // 1) SEO for all selected platforms (one LLM call).
    platforms.forEach((p) => patch(p, { phase: "seo", message: "Writing SEO…" }));
    let seo: Record<string, PlatformSeo> = {};
    try {
      seo = await generateSeo(platforms, topic, useSettingsStore.getState());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      platforms.forEach((p) => patch(p, { phase: "error", message: `SEO failed: ${msg}` }));
      return `SEO generate nahi hua: ${msg}. (Claude/Gemini key set hai?)`;
    }

    // 2) Upload sequentially (each platform opens its own browser tab).
    const done: string[] = [];
    const failed: string[] = [];
    for (const p of platforms) {
      patch(p, { phase: "uploading", message: "Uploading…", seo: seo[p] });
      const res = await uploadVideo(p, file, seo[p]);
      if (res.ok) { patch(p, { phase: "done", message: res.message || "Uploaded" }); done.push(labelOf(p)); }
      else { patch(p, { phase: "error", message: res.error || res.stage || "Failed" }); failed.push(labelOf(p)); }
    }

    set({ mode: "done" });
    const parts = [];
    if (done.length) parts.push(`✅ ${done.join(", ")} uploaded`);
    if (failed.length) parts.push(`⚠️ ${failed.join(", ")} need attention (browser mein dekh lein)`);
    return parts.join(" · ") || "Upload complete.";
  },
}));

export { fileName };
