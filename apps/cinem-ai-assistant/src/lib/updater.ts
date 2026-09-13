/**
 * Cinem AI Assistant In-App Updates — powered by the official Tauri updater.
 *
 * Flow:
 *   1. On boot (and on demand from Settings → General → Updates) Cinem AI Assistant
 *      checks the release manifest (latest.json) on the Cinem AI Assistant website.
 *   2. If a newer signed build exists: with Auto-Update ON it downloads &
 *      installs silently and asks for a restart; with Auto-Update OFF the
 *      user clicks "Download & Install" themselves.
 *   3. Every artifact is cryptographically signed — only updates signed
 *      with YOUR private key are ever accepted (no tampering possible).
 *
 * Publishing a new version (developer):
 *   - bump `version` in src-tauri/tauri.conf.json
 *   - set TAURI_SIGNING_PRIVATE_KEY (from `npx tauri signer generate`)
 *   - `npm run tauri build` → installer + .sig updater artifacts
 *   - upload artifacts + updated latest.json to the website /updates/
 */
import { create } from "zustand";
import { notify } from "@/store/useToastStore";
import { useSettingsStore } from "@/store/useSettingsStore";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type UpdateStatus =
  | "idle"        // not checked yet
  | "checking"
  | "none"        // up to date
  | "available"   // newer version found
  | "downloading"
  | "ready"       // installed — restart to apply
  | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  version: string;   // available version
  notes: string;     // release notes from latest.json
  progress: number;  // 0..1 while downloading
  error: string;
}

export const useUpdateStore = create<UpdateState>(() => ({
  status: "idle",
  currentVersion: "",
  version: "",
  notes: "",
  progress: 0,
  error: "",
}));

const set = useUpdateStore.setState;

/** The pending update object between check() and downloadAndInstall(). */
let pending: { version: string; body?: string; downloadAndInstall: (cb?: (e: DlEvent) => void) => Promise<void> } | null = null;

interface DlEvent {
  event: "Started" | "Progress" | "Finished";
  data: { contentLength?: number; chunkLength?: number };
}

/**
 * Checks for a new version.
 * @param opts.auto   true → respect the Auto-Update setting (download silently)
 * @param opts.silent true → no error toasts (used for the boot check)
 */
export async function checkForUpdate(opts?: { auto?: boolean; silent?: boolean }): Promise<void> {
  if (!IS_TAURI) {
    set({ status: "error", error: "Updates work in the installed desktop app only." });
    return;
  }
  const st = useUpdateStore.getState().status;
  if (st === "checking" || st === "downloading") return;

  set({ status: "checking", error: "" });
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    set({ currentVersion: await getVersion() });

    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check({ timeout: 30_000 });

    if (!update) {
      set({ status: "none" });
      return;
    }

    pending = update as unknown as typeof pending;
    set({ status: "available", version: update.version, notes: update.body ?? "" });
    notify("info", `Cinem AI Assistant v${update.version} is available — see Settings → General.`);

    if (opts?.auto && useSettingsStore.getState().autoUpdate) {
      await downloadAndInstall();
    }
  } catch (e) {
    pending = null;
    if (opts?.silent) {
      set({ status: "idle" }); // boot check failed quietly (offline etc.)
    } else {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Downloads + installs the pending update; restart applies it. */
export async function downloadAndInstall(): Promise<void> {
  if (!pending) return;
  set({ status: "downloading", progress: 0 });

  let total = 0;
  let got = 0;
  try {
    await pending.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0;
      else if (ev.event === "Progress") {
        got += ev.data.chunkLength ?? 0;
        if (total > 0) set({ progress: Math.min(1, got / total) });
      } else if (ev.event === "Finished") set({ progress: 1 });
    });
    set({ status: "ready", progress: 1 });
    notify("success", "Update installed — restart Cinem AI Assistant to finish.");
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

/** Restarts the app to boot into the freshly installed version. */
export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
