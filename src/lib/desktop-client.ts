"use client";

/** Preload bridge exposed by electron/preload.cjs */
export type BrandcrewDesktopBridge = {
  desktop?: boolean;
  shell?: string;
  retryDesk?: () => void;
  openDeskInBrowser?: () => void;
  openAssistant?: () => void;
  startCinemSignIn?: () => Promise<unknown>;
  onSession?: (handler: (payload: unknown) => void) => () => void;
  pickProjectFolder?: () => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>;
  getBuildPermission?: () => Promise<{ granted: boolean; folder?: string | null }>;
  requestBuildPermission?: (folder: string) => Promise<{ granted: boolean; folder?: string }>;
  runLocalBuild?: (input: {
    kind: "website" | "app" | "deck";
    prompt: string;
    folder: string;
  }) => Promise<{
    ok: boolean;
    folder?: string;
    files?: string[];
    summary?: string;
    error?: string;
  }>;
};

declare global {
  interface Window {
    brandcrewDesktop?: BrandcrewDesktopBridge;
  }
}

export function isDesktopClient(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.brandcrewDesktop?.desktop);
}

export function desktopDownloadHref(): string {
  return "/download";
}
