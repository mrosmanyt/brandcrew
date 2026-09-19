import type { AllowlistedApp } from "./types";

/** Windows process / launch targets for allowlisted apps. */
export const ALLOWLIST: Record<
  AllowlistedApp,
  { label: string; processes: string[]; launch?: string }
> = {
  explorer: {
    label: "File Explorer",
    processes: ["explorer"],
    launch: "explorer",
  },
  chrome: {
    label: "Google Chrome",
    processes: ["chrome"],
    launch: "chrome",
  },
  edge: {
    label: "Microsoft Edge",
    processes: ["msedge"],
    launch: "msedge",
  },
  firefox: {
    label: "Firefox",
    processes: ["firefox"],
    launch: "firefox",
  },
  chatgpt: {
    label: "ChatGPT Desktop",
    processes: ["chatgpt", "chatgpt.exe"],
    launch: "chatgpt",
  },
  premiere: {
    label: "Adobe Premiere Pro",
    processes: ["adobe premiere pro", "adobepremierepro"],
    launch: "premiere pro",
  },
  notepad: {
    label: "Notepad",
    processes: ["notepad"],
    launch: "notepad",
  },
};

export const ALLOWLISTED_APP_IDS = Object.keys(ALLOWLIST) as AllowlistedApp[];

/** Returns true when `app` is on the safe allowlist. */
export function isAllowlistedApp(app: string): app is AllowlistedApp {
  return ALLOWLISTED_APP_IDS.includes(app as AllowlistedApp);
}

/** Shell / PowerShell actions always require explicit UI confirmation. */
export function requiresShellConfirm(kind: string): boolean {
  return kind === "shell_powershell";
}

/** Block unknown apps; only allowlisted focus_app targets pass. */
export function validateFocusApp(app: string): { ok: true; app: AllowlistedApp } | { ok: false; error: string } {
  if (!isAllowlistedApp(app)) {
    return {
      ok: false,
      error: `App "${app}" is not allowlisted. Allowed: ${ALLOWLISTED_APP_IDS.join(", ")}`,
    };
  }
  return { ok: true, app };
}
