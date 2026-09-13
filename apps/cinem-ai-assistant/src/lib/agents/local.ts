/**
 * MAX — Local Agent (Phase 4 implementation). 100% offline file operations.
 *
 * Flows (all preview-first, all undoable):
 *  • "organize my downloads"  → scan → PREVIEW window → confirm → execute → undo available
 *  • "find files over 500MB"  → recursive search → results window
 *  • "clean temp files"       → size report → confirm → clear %TEMP% (the ONLY deletion MAX ever does)
 *  • "undo that"              → reverses the last organize completely
 *
 * Safety contract: user files are MOVED, never deleted. Every organize
 * returns an undo log (also persisted, so undo survives a restart).
 */
import type { AgentImpl } from "@/lib/agents/types";
import { useTaskStore } from "@/store/useTaskStore";
import { useAppStore } from "@/store/useAppStore";
import { speakQueued } from "@/lib/announcer";
import { addMemory } from "@/lib/longMemory";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const UNDO_KEY = "cinem-ai-assistant-max-undo";

interface FsFile { name: string; ext: string; size_mb: number; modified_ms: number; path: string }
interface MoveOp { from: string; to: string }
interface MoveResult { moved: number; errors: string[]; undo: MoveOp[] }
interface TempReport { files: number; size_mb: number; freed_mb: number }

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!IS_TAURI) throw new Error("MAX file operations require the desktop build.");
  const { invoke: inv } = await import("@tauri-apps/api/core");
  return inv<T>(cmd, args);
}

/* ── Categories ───────────────────────────────────────────────────── */

const CATEGORIES: Record<string, string[]> = {
  Images: ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "bmp", "ico"],
  Documents: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "odt"],
  Videos: ["mp4", "mkv", "mov", "avi", "webm", "m4v"],
  Audio: ["mp3", "wav", "m4a", "flac", "ogg", "aac"],
  Archives: ["zip", "rar", "7z", "tar", "gz", "iso"],
  Installers: ["exe", "msi", "apk"],
};

function categoryOf(ext: string): string {
  for (const [cat, exts] of Object.entries(CATEGORIES)) if (exts.includes(ext)) return cat;
  return "Other";
}

/* ── Pending confirmation state (preview-first contract) ──────────── */

type Pending =
  | { kind: "organize"; taskId: string; plan: MoveOp[] }
  | { kind: "temp"; taskId: string };

let pending: Pending | null = null;
export const maxHasPending = () => pending !== null;

function saveUndo(undo: MoveOp[]): void {
  localStorage.setItem(UNDO_KEY, JSON.stringify(undo));
}
function loadUndo(): MoveOp[] {
  try {
    return JSON.parse(localStorage.getItem(UNDO_KEY) ?? "[]") as MoveOp[];
  } catch {
    return [];
  }
}

/** Speaks + posts a reply when an action was triggered by a window button. */
function announce(text: string): void {
  useAppStore.getState().addMessage({ role: "assistant", text });
  void speakQueued(text);
}

/* ── Organize Downloads ───────────────────────────────────────────── */

export async function maxOrganizeDownloads(): Promise<string> {
  const { openTask, patchTask, appendTaskStep } = useTaskStore.getState();
  const files = await invoke<FsFile[]>("fs_scan_downloads");
  const loose = files.filter((f) => categoryOf(f.ext) !== "" /* all */);

  if (!loose.length) {
    return "Your Downloads folder has no loose files, Sir — already immaculate.";
  }

  // Build the move plan: Downloads/<Category>/<name>
  const base = files[0].path.slice(0, files[0].path.length - files[0].name.length);
  const plan: MoveOp[] = loose.map((f) => ({
    from: f.path,
    to: `${base}${categoryOf(f.ext)}\\${f.name}`,
  }));

  const byCat = new Map<string, { n: number; mb: number }>();
  for (const f of loose) {
    const c = categoryOf(f.ext);
    const cur = byCat.get(c) ?? { n: 0, mb: 0 };
    cur.n++;
    cur.mb += f.size_mb;
    byCat.set(c, cur);
  }

  const id = openTask({
    kind: "files",
    title: "Organize Downloads — Preview",
    subtitle: `${loose.length} files → ${byCat.size} folders`,
    agent: "MAX · LOCAL AGENT",
    status: "working",
    files: [...byCat.entries()].map(([tag, v]) => ({
      name: `${v.n} file(s) → ${tag}/`,
      sizeMb: v.mb,
      tag,
    })),
    actions: [
      { id: "confirm", label: "EXECUTE", variant: "primary" },
      { id: "cancel", label: "CANCEL", variant: "ghost" },
    ],
    onAction: (a) => {
      if (a === "confirm") void maxConfirm().then((r) => r && announce(r));
      if (a === "cancel") {
        pending = null;
        patchTask(id, { status: "done", subtitle: "cancelled", actions: [] });
        announce("Stood down, Sir — nothing was moved.");
      }
    },
  });
  appendTaskStep(id, `Scanned Downloads: ${files.length} files, ${loose.length} to organize`);
  appendTaskStep(id, "⚠ PREVIEW ONLY — nothing moves until you hit EXECUTE (or say \"yes\")");

  pending = { kind: "organize", taskId: id, plan };
  return `Preview ready, Sir — ${loose.length} files will be sorted into ${byCat.size} folders (${[...byCat.keys()].join(", ")}). Say "yes" or hit EXECUTE in the task window. Everything is move-only and fully undoable.`;
}

/* ── Confirm (organize or temp-clean) ─────────────────────────────── */

export async function maxConfirm(): Promise<string | null> {
  if (!pending) return null;
  const { patchTask, appendTaskStep } = useTaskStore.getState();
  const p = pending;
  pending = null;

  if (p.kind === "temp") {
    appendTaskStep(p.taskId, "Clearing %TEMP%…");
    const rep = await invoke<TempReport>("fs_cleanup_temp", { execute: true });
    patchTask(p.taskId, {
      status: "done",
      subtitle: "temp cleared",
      progress: 100,
      actions: [],
      result: `Freed ${rep.freed_mb} MB. Files held by running apps were skipped (normal).`,
    });
    appendTaskStep(p.taskId, `✓ Freed ${rep.freed_mb} MB`);
    return `Temp files cleared, Sir — ${rep.freed_mb} MB reclaimed.`;
  }

  /* organize — chunked so the progress bar moves */
  patchTask(p.taskId, { title: "Organize Downloads — Executing", actions: [], progress: 0 });
  const undoAll: MoveOp[] = [];
  let moved = 0;
  const errors: string[] = [];
  const CHUNK = 15;
  for (let i = 0; i < p.plan.length; i += CHUNK) {
    const res = await invoke<MoveResult>("fs_organize", { ops: p.plan.slice(i, i + CHUNK) });
    moved += res.moved;
    errors.push(...res.errors);
    undoAll.push(...res.undo);
    patchTask(p.taskId, { progress: Math.min(100, Math.round(((i + CHUNK) / p.plan.length) * 100)) });
  }
  saveUndo(undoAll);

  const folders = new Set(p.plan.map((op) => op.to.split("\\").slice(-2)[0])).size;
  patchTask(p.taskId, {
    status: errors.length ? "error" : "done",
    progress: 100,
    subtitle: `${moved} files organized`,
    actions: [{ id: "undo", label: "UNDO", variant: "danger" }],
    onAction: (a) => {
      if (a === "undo") void maxUndo().then((r) => announce(r));
    },
    result: errors.length ? `${errors.length} file(s) could not be moved (in use).` : undefined,
  });
  appendTaskStep(p.taskId, `✓ Moved ${moved} files into ${folders} folders`);

  // Memory-aware: MAX remembers the user's preferred structure.
  void addMemory(
    `User organizes the Downloads folder into category folders (${Object.keys(CATEGORIES).join(", ")}, Other) via MAX.`,
  ).catch(() => undefined);

  return `Done, Sir — moved ${moved} files into ${folders} folders${errors.length ? ` (${errors.length} skipped, in use)` : ""}. Say "undo" any time to reverse it.`;
}

export function maxCancel(): string | null {
  if (!pending) return null;
  const { patchTask } = useTaskStore.getState();
  patchTask(pending.taskId, { status: "done", subtitle: "cancelled", actions: [] });
  pending = null;
  return "Stood down, Sir — nothing was changed.";
}

/* ── Undo ─────────────────────────────────────────────────────────── */

export async function maxUndo(): Promise<string> {
  const undo = loadUndo();
  if (!undo.length) return "There's nothing to undo, Sir — no recent file operation on record.";
  const { openTask, patchTask, appendTaskStep } = useTaskStore.getState();
  const id = openTask({
    kind: "files",
    title: "Undo — Restoring Files",
    subtitle: `${undo.length} files`,
    agent: "MAX · LOCAL AGENT",
    progress: 0,
  });
  const res = await invoke<MoveResult>("fs_undo", { ops: undo });
  saveUndo([]);
  patchTask(id, { status: "done", progress: 100, subtitle: "restored" });
  appendTaskStep(id, `✓ Restored ${res.moved} files to their original locations`);
  return `Reversed, Sir — ${res.moved} files are back exactly where they were.`;
}

/* ── Find files ───────────────────────────────────────────────────── */

export async function maxFind(request: string): Promise<string> {
  const { openTask, patchTask, appendTaskStep } = useTaskStore.getState();

  // parse size ("over 500 MB" / "larger than 2gb"), extension (".pdf"/"pdf files"), scope
  const size = request.match(/(?:over|above|larger than|bigger than|>\s*)(\d+(?:\.\d+)?)\s*(mb|gb)/i);
  const minMb = size ? parseFloat(size[1]) * (size[2].toLowerCase() === "gb" ? 1024 : 1) : 0;
  const extM = request.match(/\.(\w{2,5})\b/) ?? request.match(/\b(pdf|mp4|mp3|zip|docx?|xlsx?|pptx?|jpg|png|exe)\s+files?/i);
  const ext = extM ? extM[1].toLowerCase() : "";
  const home = /\b(pc|computer|everywhere|home|poore)\b/i.test(request);
  const nameM = request.match(/(?:named|called|containing)\s+["']?([\w .-]+?)["']?(?:\s|$)/i);

  const id = openTask({
    kind: "files",
    title: `Find Files${minMb ? ` — over ${minMb >= 1024 ? `${minMb / 1024} GB` : `${minMb} MB`}` : ""}`,
    subtitle: home ? "scanning user profile" : "scanning Downloads",
    agent: "MAX · LOCAL AGENT",
  });

  const files = await invoke<FsFile[]>("fs_find", {
    root: home ? "home" : "",
    nameContains: nameM?.[1]?.trim() ?? "",
    ext,
    minMb,
  });

  patchTask(id, {
    status: "done",
    subtitle: `${files.length} match(es)`,
    files: files.slice(0, 40).map((f) => ({ name: f.name, sizeMb: f.size_mb, tag: f.ext || "file" })),
  });
  appendTaskStep(id, `✓ ${files.length} files found${files.length > 40 ? " (showing top 40 by size)" : ""}`);

  const totalMb = files.reduce((s, f) => s + f.size_mb, 0);
  return files.length
    ? `Found ${files.length} matching files (${(totalMb / 1024).toFixed(1)} GB total), Sir — full list in the task window, largest first.`
    : "No files matched that search, Sir.";
}

/* ── Clean temp ───────────────────────────────────────────────────── */

export async function maxCleanTemp(): Promise<string> {
  const { openTask, appendTaskStep } = useTaskStore.getState();
  const rep = await invoke<TempReport>("fs_cleanup_temp", { execute: false });

  const id = openTask({
    kind: "files",
    title: "Clean Temp Files — Preview",
    subtitle: `${rep.size_mb} MB reclaimable`,
    agent: "MAX · LOCAL AGENT",
    status: "working",
    files: [{ name: `%TEMP% — ${rep.files} files`, sizeMb: rep.size_mb, tag: "TEMP" }],
    actions: [
      { id: "confirm", label: "CLEAR TEMP", variant: "primary" },
      { id: "cancel", label: "CANCEL", variant: "ghost" },
    ],
    onAction: (a) => {
      if (a === "confirm") void maxConfirm().then((r) => r && announce(r));
      if (a === "cancel") announce(maxCancel() ?? "");
    },
  });
  appendTaskStep(id, "⚠ Only the system TEMP folder is cleared — never your files");
  pending = { kind: "temp", taskId: id };
  return `Your temp folder holds ${rep.files} files — about ${rep.size_mb} MB, Sir. Say "yes" or hit CLEAR TEMP to reclaim it.`;
}

/* ── AgentImpl (for LLM-routed generic queries) ───────────────────── */

export const localAgent: AgentImpl = {
  id: "local",
  systemPrompt: "You are MAX, Cinem AI Assistant's Local Agent — steady, reliable, master of the file system.",
  tools: [],
  run: async (ctx) => {
    try {
      ctx.step("Scanning Downloads…");
      const files = await invoke<FsFile[]>("fs_scan_downloads");
      const mb = files.reduce((s, f) => s + f.size_mb, 0);
      return {
        findings:
          `MAX here, Sir. Your Downloads folder holds ${files.length} loose files (${(mb / 1024).toFixed(1)} GB). ` +
          `I can "organize downloads" into category folders, "find files over 500MB", or "clean temp files" — all preview-first and undoable.`,
      };
    } catch (e) {
      return { findings: `MAX is desktop-only, Sir: ${e instanceof Error ? e.message : e}` };
    }
  },
};
