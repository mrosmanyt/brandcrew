/**
 * NOVA — video-editing agent client + natural-language style matching.
 * Talks to the local ffmpeg media sidecar (media-server, port 7880).
 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const BASE = "http://127.0.0.1:7880";

export type EditStyle = "high" | "medium" | "normal";

export const STYLE_LABEL: Record<EditStyle, string> = {
  high: "High-End Cinematic",
  medium: "Medium (YouTube)",
  normal: "Quick Reel",
};

async function mfetch(path: string, body?: unknown, timeoutMs = 8000): Promise<Response> {
  const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await doFetch(`${BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export async function isNovaUp(): Promise<boolean> {
  try { return (await mfetch("/health", undefined, 1500)).ok; } catch { return false; }
}

/** mfetch is re-exported for sibling modules (thumbnails) on the same port. */
export { mfetch as novaFetch };

export interface VideoFile { name: string; path: string; mtime: number }

/** Lists video files in a folder (newest first). */
export async function listVideos(folder: string): Promise<VideoFile[]> {
  const r = await mfetch("/list", { folder }, 8000);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "list failed");
  return d.videos as VideoFile[];
}

/**
 * Resolves the latest EDITED video — newest file in <clipsFolder>\CINEM-AI-ASSISTANT_Edited,
 * falling back to the newest file directly in the clips folder.
 */
export async function latestEditedVideo(clipsFolder: string): Promise<string | null> {
  const root = clipsFolder.replace(/[\\/]+$/, "");
  for (const folder of [`${root}\\CINEM-AI-ASSISTANT_Edited`, root]) {
    try {
      const vids = await listVideos(folder);
      if (vids.length) return vids[0].path;
    } catch {
      /* folder may not exist yet — try the next */
    }
  }
  return null;
}

/** Finds a specific filename inside the clips/edited folders (best-effort). */
export async function findVideoByName(clipsFolder: string, name: string): Promise<string | null> {
  const root = clipsFolder.replace(/[\\/]+$/, "");
  const needle = name.toLowerCase().replace(/\.[a-z0-9]+$/, "");
  for (const folder of [`${root}\\CINEM-AI-ASSISTANT_Edited`, root]) {
    try {
      const vids = await listVideos(folder);
      const hit = vids.find((v) => v.name.toLowerCase().includes(needle));
      if (hit) return hit.path;
    } catch { /* next */ }
  }
  return null;
}

export interface EditStartResult { jobId: string; count: number }

/** Stitches the Grok scene clips (in name order) into one graded final video. */
export async function startAssemble(
  scenesFolder: string, outDir: string, style: EditStyle,
): Promise<EditStartResult> {
  const r = await mfetch("/assemble", { folder: scenesFolder, outDir, style }, 12000);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "Assemble could not start.");
  return { jobId: d.jobId, count: d.count };
}

export async function startEdit(
  folder: string, style: EditStyle, count: number,
): Promise<EditStartResult> {
  const res = await mfetch("/edit", { folder, style, count }, 12000);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Edit could not start.");
  return { jobId: data.jobId, count: data.count };
}

export interface JobStatus {
  state: "queued" | "running" | "done" | "error";
  percent: number;
  stage: string;
  output: string;
  error: string;
}

export async function pollJob(id: string): Promise<JobStatus> {
  const res = await mfetch(`/job?id=${id}`, undefined, 6000);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "job not found");
  return data as JobStatus;
}

export async function openCapcut(folder: string, capcutPath?: string): Promise<void> {
  await mfetch("/capcut", { folder, capcutPath }).catch(() => undefined);
}

/* ── Natural-language intent (Urdu + English) ─────────────────────── */

export interface EditIntent { style: EditStyle; count: number }

const NUM_WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, panch: 5, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Detects an editing command + its style + how many clips. Null if not editing. */
export function matchEditIntent(text: string): EditIntent | null {
  const t = text.toLowerCase();

  const videoCtx = /\b(video|videos|clip|clips|reel|reels|short|shorts|footage|montage)\b/.test(t);
  const isEdit =
    /\bcinematic\b/.test(t) ||
    (/\b(edit|editing)\b/.test(t) && (videoCtx || /\bcinematic|high ?end\b/.test(t))) ||
    /\bedit kar\b/.test(t) ||
    (videoCtx && /\b(bana ?do|banao|ready kar)\b/.test(t));
  if (!isEdit) return null;

  let style: EditStyle = "medium";
  if (/\b(high ?end|high-end|cinematic|premium|professional|pro|luxury|movie)\b/.test(t)) style = "high";
  else if (/\b(normal|quick|fast|basic|simple|reel|reels|short|shorts)\b/.test(t)) style = "normal";
  else if (/\b(medium|balanced|youtube|yt)\b/.test(t)) style = "medium";

  // count: digits, or number words, default 10
  let count = 10;
  const digit = t.match(/\b(\d{1,3})\b/);
  if (digit) count = Math.min(50, parseInt(digit[1], 10));
  else {
    for (const [w, n] of Object.entries(NUM_WORDS)) {
      if (new RegExp(`\\b${w}\\b`).test(t)) { count = n; break; }
    }
  }
  return { style, count };
}
