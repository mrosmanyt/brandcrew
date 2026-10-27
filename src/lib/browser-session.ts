import type { Page } from "playwright-core";
import { assertPublicHttpUrl } from "@/lib/fetch-url";
import {
  BROWSE_TIMEOUT_MS,
  excerptFromText,
  PLAYWRIGHT_LAUNCH_ARGS,
  PLAYWRIGHT_USER_AGENT,
  playwrightDesktopRequiredReason,
  playwrightEnabled,
  resolveChromePath,
  snapshotPlaywrightPage,
  type BrowsePage,
} from "@/lib/browse";

const SESSION_IDLE_MS = 10 * 60 * 1000;
const SCREENSHOT_MAX_B64 = 180_000;

type LiveSession = {
  jobId: string;
  browser: { close: () => Promise<void> };
  page: Page;
  lastUsed: number;
};

const sessions = new Map<string, LiveSession>();

export type BrowserActionResult = {
  ok: boolean;
  page?: BrowsePage;
  excerpt?: string;
  screenshot?: string;
  extracted?: string;
  error?: string;
  mode: "playwright" | "desktop_required" | "no_session";
};

function touch(session: LiveSession) {
  session.lastUsed = Date.now();
}

function sweepIdle() {
  const now = Date.now();
  for (const [jobId, session] of sessions) {
    if (now - session.lastUsed > SESSION_IDLE_MS) {
      void closeBrowserSession(jobId);
    }
  }
}

export function hasBrowserSession(jobId: string) {
  return sessions.has(jobId);
}

export async function closeBrowserSession(jobId: string) {
  const session = sessions.get(jobId);
  if (!session) return;
  sessions.delete(jobId);
  try {
    await session.browser.close();
  } catch {
    // already closed
  }
}

async function ensureSession(jobId: string): Promise<LiveSession | { error: string }> {
  sweepIdle();
  const existing = sessions.get(jobId);
  if (existing) {
    touch(existing);
    return existing;
  }
  if (!playwrightEnabled()) {
    return { error: playwrightDesktopRequiredReason("browser session") };
  }
  const executablePath = resolveChromePath();
  if (!executablePath) {
    return { error: playwrightDesktopRequiredReason("browser session") };
  }
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: PLAYWRIGHT_LAUNCH_ARGS,
    });
    const page = await browser.newPage({
      userAgent: PLAYWRIGHT_USER_AGENT,
    });
    page.setDefaultTimeout(BROWSE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(BROWSE_TIMEOUT_MS);
    const session: LiveSession = { jobId, browser, page, lastUsed: Date.now() };
    sessions.set(jobId, session);
    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not launch Chrome.";
    return { error: `${playwrightDesktopRequiredReason("browser session")} (${message})` };
  }
}

export async function sessionNavigate(
  jobId: string,
  rawUrl: string,
): Promise<BrowserActionResult> {
  const url = assertPublicHttpUrl(rawUrl).toString();
  const session = await ensureSession(jobId);
  if ("error" in session) {
    return { ok: false, error: session.error, mode: "desktop_required" };
  }
  try {
    const response = await session.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: BROWSE_TIMEOUT_MS,
    });
    touch(session);
    const page = await snapshotPlaywrightPage(session.page);
    const ok = response ? response.ok() : page.ok;
    return {
      ok,
      page: {
        ...page,
        ok,
        error: ok ? undefined : `HTTP ${response?.status() ?? "unknown"}`,
      },
      excerpt: page.excerpt,
      mode: "playwright",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Navigate failed.";
    return { ok: false, error: message, mode: "playwright" };
  }
}

function resolveSelector(args: Record<string, unknown>): string {
  const selector = String(args.selector || args.label || "").trim();
  if (selector) return selector;
  const text = String(args.text || "").trim();
  if (text) return `text=${text}`;
  return "";
}

export async function sessionClick(
  jobId: string,
  args: Record<string, unknown>,
): Promise<BrowserActionResult> {
  const session = sessions.get(jobId);
  if (!session) {
    if (!playwrightEnabled()) {
      return {
        ok: false,
        error: playwrightDesktopRequiredReason("browser_click"),
        mode: "desktop_required",
      };
    }
    return {
      ok: false,
      error: "No live browser tab. Run browser_navigate first on desktop/local Playwright.",
      mode: "no_session",
    };
  }
  const selector = resolveSelector(args);
  if (!selector) {
    return { ok: false, error: "browser_click needs a CSS selector or link text.", mode: "playwright" };
  }
  try {
    await session.page.click(selector, { timeout: 8_000 });
    await session.page.waitForLoadState("domcontentloaded").catch(() => undefined);
    touch(session);
    const page = await snapshotPlaywrightPage(session.page);
    return { ok: true, page, excerpt: page.excerpt, mode: "playwright" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Click failed.";
    return { ok: false, error: message, mode: "playwright" };
  }
}

export async function sessionType(
  jobId: string,
  args: Record<string, unknown>,
): Promise<BrowserActionResult> {
  const session = sessions.get(jobId);
  if (!session) {
    if (!playwrightEnabled()) {
      return {
        ok: false,
        error: playwrightDesktopRequiredReason("browser_type"),
        mode: "desktop_required",
      };
    }
    return {
      ok: false,
      error: "No live browser tab. Run browser_navigate first on desktop/local Playwright.",
      mode: "no_session",
    };
  }
  const selector = String(args.selector || "").trim();
  const value = String(args.text ?? args.value ?? "");
  if (!selector) {
    return { ok: false, error: "browser_type needs a CSS selector.", mode: "playwright" };
  }
  try {
    await session.page.fill(selector, value, { timeout: 8_000 });
    touch(session);
    const page = await snapshotPlaywrightPage(session.page);
    return { ok: true, page, excerpt: excerptFromText(value || page.excerpt), mode: "playwright" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Type failed.";
    return { ok: false, error: message, mode: "playwright" };
  }
}

export async function sessionExtract(
  jobId: string,
  args: Record<string, unknown>,
): Promise<BrowserActionResult> {
  const session = sessions.get(jobId);
  if (!session) {
    if (!playwrightEnabled()) {
      return {
        ok: false,
        error: playwrightDesktopRequiredReason("browser_extract"),
        mode: "desktop_required",
      };
    }
    return {
      ok: false,
      error: "No live browser tab. Run browser_navigate first on desktop/local Playwright.",
      mode: "no_session",
    };
  }
  const selector = String(args.selector || "body").trim() || "body";
  try {
    const extracted = (await session.page.locator(selector).innerText({ timeout: 6_000 })).trim();
    touch(session);
    const page = await snapshotPlaywrightPage(session.page);
    return {
      ok: true,
      page,
      extracted: extracted.slice(0, 12_000),
      excerpt: excerptFromText(extracted),
      mode: "playwright",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extract failed.";
    return { ok: false, error: message, mode: "playwright" };
  }
}

export async function sessionScreenshot(jobId: string): Promise<BrowserActionResult> {
  const session = sessions.get(jobId);
  if (!session) {
    if (!playwrightEnabled()) {
      return {
        ok: false,
        error: playwrightDesktopRequiredReason("browser_screenshot"),
        mode: "desktop_required",
      };
    }
    return {
      ok: false,
      error: "No live browser tab. Run browser_navigate first on desktop/local Playwright.",
      mode: "no_session",
    };
  }
  try {
    const buffer = await session.page.screenshot({
      type: "jpeg",
      quality: 40,
      fullPage: false,
    });
    touch(session);
    const b64 = buffer.toString("base64");
    const page = await snapshotPlaywrightPage(session.page);
    if (b64.length > SCREENSHOT_MAX_B64) {
      return {
        ok: true,
        page,
        excerpt: page.excerpt,
        error: "Screenshot captured but too large to persist on the job.",
        mode: "playwright",
      };
    }
    return {
      ok: true,
      page,
      screenshot: `data:image/jpeg;base64,${b64}`,
      excerpt: page.excerpt,
      mode: "playwright",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Screenshot failed.";
    return { ok: false, error: message, mode: "playwright" };
  }
}

export async function sessionSnapshot(jobId: string): Promise<BrowserActionResult> {
  const session = sessions.get(jobId);
  if (!session) {
    return { ok: false, error: "No live browser tab.", mode: "no_session" };
  }
  try {
    const page = await snapshotPlaywrightPage(session.page);
    touch(session);
    return { ok: true, page, excerpt: page.excerpt, mode: "playwright" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snapshot failed.";
    return { ok: false, error: message, mode: "playwright" };
  }
}
