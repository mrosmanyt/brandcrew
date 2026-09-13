/**
 * Playwright browser automation — frontend client.
 *
 * Playwright is a Node library and CANNOT run inside the WebView. It runs in a
 * small local sidecar (see /playwright-server) that exposes an HTTP API on
 * 127.0.0.1:7878. This module talks to that server and, if it isn't running,
 * falls back to opening the system browser — so browser commands are ALWAYS
 * reliable, with or without Playwright.
 */
import { openExternal, resolveBrowserTarget } from "@/lib/quickActions";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const PW_BASE = "http://127.0.0.1:7878";

async function pwFetch(path: string, body?: unknown, timeoutMs = 6000): Promise<Response> {
  const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await doFetch(`${PW_BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Is the Playwright sidecar reachable? (short timeout, never throws). */
export async function isPlaywrightUp(): Promise<boolean> {
  try {
    const r = await pwFetch("/health", undefined, 1500);
    return r.ok;
  } catch {
    return false;
  }
}

export interface BrowserAction {
  label: string;
  reply: string;
  run: () => Promise<void>;
}

/** Matches a browser command and returns an action backed by Playwright,
 *  with an automatic system-browser fallback. */
export function matchBrowserCommand(text: string): BrowserAction | null {
  const target = resolveBrowserTarget(text);
  if (!target) return null;

  return {
    label: target.label,
    reply: target.reply,
    run: async () => {
      // 1) Try Playwright sidecar (visible, persistent Chromium).
      if (await isPlaywrightUp()) {
        try {
          const res = await pwFetch("/open", { url: target.url });
          if (res.ok) return;
          console.warn("[Cinem AI Assistant] Playwright /open non-OK:", res.status);
        } catch (e) {
          console.warn("[Cinem AI Assistant] Playwright open failed, falling back:", e);
        }
      }
      // 2) Fallback — open in the system default browser. Always works.
      await openExternal(target.url);
    },
  };
}

/** Direct YouTube play via Playwright (opens results + clicks first video).
 *  Falls back to opening the YouTube search page. */
export async function playOnYouTube(query: string): Promise<boolean> {
  if (await isPlaywrightUp()) {
    try {
      const res = await pwFetch("/youtube", { query, play: true }, 15000);
      if (res.ok) return true;
    } catch (e) {
      console.warn("[Cinem AI Assistant] Playwright youtube failed:", e);
    }
  }
  await openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
  return false;
}
