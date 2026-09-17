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
import { youtubeSearchUrl } from "@/lib/browserIntents";

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
      if (await isPlaywrightUp()) {
        try {
          const res = await pwFetch("/open", { url: target.url });
          if (res.ok) return;
          console.warn("[Cinem AI Assistant] Playwright /open non-OK:", res.status);
        } catch (e) {
          console.warn("[Cinem AI Assistant] Playwright open failed, falling back:", e);
        }
      }
      await openExternal(target.url);
    },
  };
}

export type YoutubePlayResult = {
  ok: boolean;
  played: boolean;
  url: string;
  title?: string;
  autoplayBlocked?: boolean;
  error?: string;
  via: "playwright" | "system-browser";
};

/** Direct YouTube play via Playwright (search → watch URL → play). */
export async function playOnYouTube(query: string): Promise<YoutubePlayResult> {
  const search = youtubeSearchUrl(query);
  if (await isPlaywrightUp()) {
    try {
      const res = await pwFetch("/youtube", { query, play: true }, 25000);
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        played?: boolean;
        url?: string;
        title?: string;
        autoplayBlocked?: boolean;
        error?: string;
      };
      if (res.ok) {
        return {
          ok: true,
          played: Boolean(data.played),
          url: data.url || search,
          title: data.title,
          autoplayBlocked: Boolean(data.autoplayBlocked),
          error: data.error,
          via: "playwright",
        };
      }
    } catch (e) {
      console.warn("[Cinem AI Assistant] Playwright youtube failed:", e);
    }
  }
  await openExternal(search);
  return { ok: true, played: false, url: search, via: "system-browser" };
}

export type ResearchBrowseResult = {
  ok: boolean;
  via: "playwright" | "none";
  url?: string;
  results: { title: string; url: string; snippet?: string }[];
  pages: { url: string; title?: string; text?: string }[];
  error?: string;
};

/** Google search in the live Chromium, then follow top result pages. */
export async function researchInBrowser(query: string): Promise<ResearchBrowseResult> {
  if (!(await isPlaywrightUp())) {
    return { ok: false, via: "none", results: [], pages: [] };
  }
  try {
    const res = await pwFetch("/research", { query, follow: 3 }, 45000);
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string;
      results?: { title: string; url: string; snippet?: string }[];
      pages?: { url: string; title?: string; text?: string }[];
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, via: "playwright", results: [], pages: [], error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      via: "playwright",
      url: data.url,
      results: data.results || [],
      pages: data.pages || [],
    };
  } catch (e) {
    return {
      ok: false,
      via: "playwright",
      results: [],
      pages: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
