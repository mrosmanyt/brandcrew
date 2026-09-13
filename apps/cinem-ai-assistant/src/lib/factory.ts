/**
 * Cinem AI Assistant Video Factory (Phase 4) — one-command autonomous chain.
 *
 *   topic → script → Grok scenes → assemble → thumbnail → SEO + upload
 *
 * Drives the existing stores in sequence (so every step still shows its own
 * progress panel) and threads the resulting artifacts forward. One call does
 * the whole job; the daily scheduler (autopilot.ts) calls this once per day.
 */
import { useScriptStore } from "@/store/useScriptStore";
import { useGrokStore } from "@/store/useGrokStore";
import { useNovaStore } from "@/store/useNovaStore";
import { useThumbStore } from "@/store/useThumbStore";
import { useUploadStore } from "@/store/useUploadStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { safeFolderName } from "@/lib/grokGen";
import type { EditStyle } from "@/lib/nova";
import type { Platform } from "@/lib/uploader";

export type FactoryStage =
  | "script" | "scenes" | "assemble" | "thumbnail" | "upload" | "done" | "error";

export interface FactoryProgress {
  stage: FactoryStage;
  message: string;
  /** Final stitched video path (available from the assemble step onward). */
  video?: string;
}

export interface FactoryOptions {
  topic: string;
  platforms?: Platform[];   // default ["youtube"]
  style?: EditStyle;        // default "high"
  autoUpload?: boolean;     // default true
}

export interface FactoryResult {
  ok: boolean;
  topic: string;
  title?: string;
  video?: string;
  thumbnail?: string;
  uploadSummary?: string;
  failedStage?: FactoryStage;
  error?: string;
}

type OnStage = (p: FactoryProgress) => void;

/** Runs the full faceless-video chain for one topic. Never throws — returns a result. */
export async function runFactory(
  opts: FactoryOptions,
  onStage: OnStage = () => {},
): Promise<FactoryResult> {
  const topic = opts.topic.trim();
  const platforms = opts.platforms?.length ? opts.platforms : (["youtube"] as Platform[]);
  const style: EditStyle = opts.style ?? "high";
  const autoUpload = opts.autoUpload ?? true;

  const result: FactoryResult = { ok: false, topic };

  // Pre-flight: we need a clips folder for everything downstream.
  const clips = useSettingsStore.getState().clipsFolder;
  if (!topic) return { ...result, failedStage: "script", error: "Topic empty hai." };
  if (!clips) return { ...result, failedStage: "scenes", error: "Settings → NOVA mein clips folder set karein." };

  /* 1 ── Script ─────────────────────────────────────────────── */
  onStage({ stage: "script", message: `Script likh raha hoon: "${topic}"` });
  await useScriptStore.getState().generate(topic);
  const script = useScriptStore.getState().script;
  if (!script || useScriptStore.getState().phase === "error") {
    return { ...result, failedStage: "script", error: useScriptStore.getState().error || "Script fail." };
  }
  result.title = script.title;

  /* 2 ── Grok scenes ───────────────────────────────────────── */
  onStage({ stage: "scenes", message: `${script.scenes.length} scenes generate ho rahe hain (Super Grok)…` });
  await useGrokStore.getState().run();
  const rows = useGrokStore.getState().rows;
  const doneScenes = rows.filter((r) => r.phase === "done").length;
  if (doneScenes === 0) {
    return {
      ...result,
      failedStage: "scenes",
      error: "Koi scene generate nahi hua (Grok login / captcha / limit check karein).",
    };
  }

  /* 3 ── Assemble ──────────────────────────────────────────── */
  const root = clips.replace(/[\\/]+$/, "");
  const scenesFolder = `${root}\\CINEM-AI-ASSISTANT_Scenes\\${safeFolderName(script.title)}`;
  const editedDir = `${root}\\CINEM-AI-ASSISTANT_Edited`;
  onStage({ stage: "assemble", message: `${doneScenes} scenes ko stitch + grade kar raha hoon…` });
  await useNovaStore.getState().assemble(scenesFolder, editedDir, style);
  const nova = useNovaStore.getState();
  if (nova.phase === "error" || !nova.output) {
    return { ...result, failedStage: "assemble", error: nova.error || "Assemble fail." };
  }
  const video = nova.output;
  result.video = video;

  /* 4 ── Thumbnail (auto-pick first) ───────────────────────── */
  onStage({ stage: "thumbnail", message: "Thumbnail bana raha hoon…", video });
  try {
    await useThumbStore.getState().generate(video);
    const items = useThumbStore.getState().items;
    if (items.length) {
      useThumbStore.getState().select(items[0].path);
      result.thumbnail = items[0].path;
    }
  } catch {
    /* thumbnail is non-fatal — continue to upload */
  }

  /* 5 ── Upload (SEO + multi-platform) ─────────────────────── */
  if (autoUpload) {
    onStage({ stage: "upload", message: `Upload ho raha hai: ${platforms.join(", ")}…`, video });
    const summary = await useUploadStore.getState().run(video, platforms, topic);
    result.uploadSummary = summary;
  }

  onStage({ stage: "done", message: `Video ready: "${script.title}"`, video });
  result.ok = true;
  return result;
}
