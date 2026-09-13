/**
 * Super Grok video generation (Phase 2) — frontend client.
 * Talks to the Playwright sidecar (7878) which drives grok.com in the user's
 * real Chrome to generate + download a clip per scene visual prompt.
 */
import type { Scene } from "@/lib/scriptStudio";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const BASE = "http://127.0.0.1:7878";

async function pwFetch(path: string, body?: unknown, timeoutMs = 250000): Promise<Response> {
  const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await doFetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** Opens Grok in the user's real Chrome so they log in once. */
export async function connectGrok(): Promise<void> {
  const { ensureSidecar, PW_HEALTH } = await import("@/lib/sidecars");
  await ensureSidecar(PW_HEALTH);
  await pwFetch("/grok/connect", {}, 20000);
}

export interface SceneResult { ok: boolean; path?: string; stage?: string; error?: string }

export async function generateScene(prompt: string, outPath: string): Promise<SceneResult> {
  try {
    const r = await pwFetch("/grok/generate", { prompt, outPath });
    return (await r.json()) as SceneResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sanitizes a title into a safe folder name. */
export function safeFolderName(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 50) || "project";
}

/** Builds the per-scene output path under <clipsFolder>\CINEM-AI-ASSISTANT_Scenes\<title>. */
export function sceneOutPath(clipsFolder: string, title: string, index: number): string {
  const root = clipsFolder.replace(/[\\/]+$/, "");
  return `${root}\\CINEM-AI-ASSISTANT_Scenes\\${safeFolderName(title)}\\scene_${String(index + 1).padStart(2, "0")}.mp4`;
}

export interface GenItem { index: number; prompt: string; result?: SceneResult }

/** Generates every scene clip sequentially, reporting progress per scene. */
export async function generateAllScenes(
  scenes: Scene[], clipsFolder: string, title: string,
  onProgress: (index: number, result: SceneResult | "start") => void,
): Promise<SceneResult[]> {
  const results: SceneResult[] = [];
  for (let i = 0; i < scenes.length; i++) {
    onProgress(i, "start");
    const out = sceneOutPath(clipsFolder, title, i);
    const res = await generateScene(scenes[i].visual, out);
    results.push(res);
    onProgress(i, res);
  }
  return results;
}
