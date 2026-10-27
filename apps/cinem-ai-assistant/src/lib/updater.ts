/**
 * CINEM Pro in-app updates.
 *
 * Primary path: Electron `electron-updater` via the unified NSIS app
 * (`window.cinemDesktop.updates`). Feed is the public GitHub repo
 * mrosmanyt/cinem-pro-releases (`latest.yml`). No client token.
 *
 * Optional leftover: Tauri updater for the advanced assistant-only installer.
 * The installed CINEM-Pro-Setup.exe does not depend on Tauri.
 */
import { create } from "zustand";
import { notify } from "@/store/useToastStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cinemDesktopBridge, isTauriShell } from "@/lib/desktop-shell";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "none"
  | "available"
  | "downloading"
  | "ready"
  | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  version: string;
  notes: string;
  progress: number;
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

type ElectronUpdatePayload = {
  status?: UpdateStatus;
  currentVersion?: string;
  version?: string;
  notes?: string;
  progress?: number;
  error?: string;
  autoUpdate?: boolean;
};

let pending: {
  version: string;
  body?: string;
  downloadAndInstall: (cb?: (e: DlEvent) => void) => Promise<void>;
} | null = null;

interface DlEvent {
  event: "Started" | "Progress" | "Finished";
  data: { contentLength?: number; chunkLength?: number };
}

let electronSubscribed = false;

function applyPayload(payload: ElectronUpdatePayload | null | undefined) {
  if (!payload) return;
  set({
    status: payload.status || "idle",
    currentVersion: payload.currentVersion || "",
    version: payload.version || "",
    notes: payload.notes || "",
    progress: typeof payload.progress === "number" ? payload.progress : 0,
    error: payload.error || "",
  });
  if (typeof payload.autoUpdate === "boolean") {
    const settings = useSettingsStore.getState();
    if (settings.autoUpdate !== payload.autoUpdate) {
      void settings.update({ autoUpdate: payload.autoUpdate });
    }
  }
}

export function subscribeToUpdates(): () => void {
  const bridge = cinemDesktopBridge();
  if (!bridge?.updates?.onStatus) return () => undefined;
  if (!electronSubscribed) {
    electronSubscribed = true;
    void bridge.updates.getState?.().then(applyPayload);
  }
  return bridge.updates.onStatus((payload) => applyPayload(payload));
}

export async function setAutoUpdateEnabled(enabled: boolean): Promise<void> {
  await useSettingsStore.getState().update({ autoUpdate: enabled });
  const bridge = cinemDesktopBridge();
  if (bridge?.updates?.setAutoUpdate) {
    applyPayload(await bridge.updates.setAutoUpdate(enabled));
  }
}

/**
 * Checks for a new version.
 * @param opts.auto   true → respect the Auto Update setting (download silently)
 * @param opts.silent true → no error toasts (used for the boot check)
 */
export async function checkForUpdate(opts?: { auto?: boolean; silent?: boolean }): Promise<void> {
  const bridge = cinemDesktopBridge();
  if (bridge?.updates?.check) {
    subscribeToUpdates();
    const st = useUpdateStore.getState().status;
    if (st === "checking" || st === "downloading") return;
    applyPayload(await bridge.updates.check({ auto: opts?.auto, silent: opts?.silent }));
    return;
  }

  if (!isTauriShell()) {
    set({ status: "error", error: "Updates work in the installed CINEM Pro app (CINEM-Pro-Setup.exe)." });
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
    notify("info", `CINEM Pro ${update.version} is available — see Settings → Updates.`);

    if (opts?.auto && useSettingsStore.getState().autoUpdate) {
      await downloadAndInstall();
    }
  } catch (e) {
    pending = null;
    if (opts?.silent) {
      set({ status: "idle" });
    } else {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Downloads + installs the pending update; restart applies it. */
export async function downloadAndInstall(): Promise<void> {
  const bridge = cinemDesktopBridge();
  if (bridge?.updates?.download) {
    applyPayload(await bridge.updates.download());
    return;
  }
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
    notify("success", "Update installed — restart CINEM Pro to finish.");
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

/** Restarts the app to boot into the freshly installed version. */
export async function relaunchApp(): Promise<void> {
  const bridge = cinemDesktopBridge();
  if (bridge?.updates?.install) {
    await bridge.updates.install();
    return;
  }
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
