import { existsSync } from "node:fs";
import {
  assertPublicHttpUrl,
  extractHtmlLinks,
  fetchUrlText,
  htmlToText,
} from "@/lib/fetch-url";

export const BROWSE_TIMEOUT_MS = 12_000;
export const MAX_PAGES_PER_JOB = 4;
export const SNAPSHOT_MAX_CHARS = 8_000;
export const EXCERPT_CHARS = 280;
export const CRAWL_MAX_DEPTH = 2;

const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/local/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean) as string[];

export type BrowseEngine = "playwright" | "fetch";

export type BrowsePage = {
  url: string;
  ok: boolean;
  title?: string;
  text: string;
  excerpt: string;
  links: string[];
  engine: BrowseEngine;
  error?: string;
};

export type BrowseCaps = {
  pageCount: number;
  maxPages?: number;
};

export function resolveChromePath(): string | undefined {
  return CHROME_CANDIDATES.find((path) => existsSync(path));
}

/**
 * Playwright is preferred for local `npm run dev` when Chrome is installed.
 * Vercel / serverless: default off (no Chrome). Set PLAYWRIGHT_ENABLED=false
 * explicitly in production. When off or Chrome fails, tools fall back to fetch.
 *
 * DOM-FIRST: snapshotPlaywrightPage uses ARIA snapshot + innerText + HTML text.
 * It does not screenshot for the model. browser_screenshot is a separate human-
 * facing capture and is never the default perception path.
 */
export function playwrightEnabled(): boolean {
  const flag = (process.env.PLAYWRIGHT_ENABLED || "").trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  if (flag === "true" || flag === "1" || flag === "on") return true;
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  return Boolean(resolveChromePath());
}

export function excerptFromText(text: string, max = EXCERPT_CHARS): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trim()}…`;
}

export function formatSnapshot(page?: {
  url: string;
  ok: boolean;
  title?: string;
  text: string;
  engine?: string;
}): string {
  if (!page) return "(no page loaded)";
  const body = [page.title ? `# ${page.title}` : "", page.text].filter(Boolean).join("\n\n");
  return `URL: ${page.url}\nEngine: ${page.engine}${page.ok ? "" : " (partial)"}\n\n${body.slice(0, SNAPSHOT_MAX_CHARS)}`;
}

export type InteractGuard =
  | { ok: true }
  | { ok: false; reason: string };

export function playwrightDesktopRequiredReason(tool: string): string {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return `${tool} needs Playwright. Vercel serverless has no Chrome — run CINEM Pro desktop (npm run desktop:dev) or local npm run dev with PLAYWRIGHT_ENABLED=true. Navigate still works via fetch.`;
  }
  return `${tool} needs Playwright + Chrome on this machine. Set PLAYWRIGHT_ENABLED=true (and PLAYWRIGHT_CHROME_PATH if Chrome is not on a default path). Navigate still works via fetch.`;
}

export function browserInteractGuard(
  tool: "browser_click" | "browser_type",
  args: Record<string, unknown>,
): InteractGuard {
  const blob = `${args.selector ?? ""} ${args.text ?? ""} ${args.value ?? ""} ${args.label ?? ""}`.toLowerCase();
  if (/(password|passwd|passcode|one-time|otp|credential)/.test(blob)) {
    return {
      ok: false,
      reason: "Refused: CINEM Pro never fills password or credential fields.",
    };
  }
  if (/(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|auth|sso)/.test(blob)) {
    return {
      ok: false,
      reason: "Refused: no auto-login. Use a public page, or pause with ask_user.",
    };
  }
  if (/(send|publish|post now|submit message|mail\.send|tweet)/.test(blob)) {
    return {
      ok: false,
      reason: "Refused: no external send. Pause with ask_user instead.",
    };
  }
  return { ok: true };
}

export function assertCanBrowseAnotherPage(caps: BrowseCaps): void {
  const max = caps.maxPages ?? MAX_PAGES_PER_JOB;
  if (caps.pageCount >= max) {
    throw new Error(`Browse cap reached (${max} pages per job).`);
  }
}

export async function browseNavigate(rawUrl: string): Promise<BrowsePage> {
  const url = assertPublicHttpUrl(rawUrl).toString();
  if (playwrightEnabled()) {
    try {
      return await playwrightNavigate(url);
    } catch {
      const fallback = await fetchBrowse(url);
      if (fallback.ok) {
        return { ...fallback, error: fallback.error };
      }
      return {
        ...fallback,
        error: fallback.error || "Playwright failed; fetch fallback also failed.",
      };
    }
  }
  return fetchBrowse(url);
}

/** Parallel public-page research. DOM-first (navigate uses digest, not screenshots). */
export async function browseMany(urls: string[], cap = MAX_PAGES_PER_JOB): Promise<BrowsePage[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
    if (unique.length >= cap) break;
  }
  return Promise.all(unique.map((url) => browseNavigate(url)));
}

export async function crawlLinks(
  start: BrowsePage,
  input: { depth?: number; maxPages: number; alreadyVisited: Set<string> },
): Promise<BrowsePage[]> {
  const depth = Math.min(Math.max(input.depth ?? 1, 1), CRAWL_MAX_DEPTH);
  const extra: BrowsePage[] = [];
  let frontier: { url: string; depth: number }[] = pickCrawlTargets(start).map((url) => ({
    url,
    depth: 1,
  }));

  while (frontier.length && extra.length < input.maxPages) {
    const next = frontier.shift();
    if (!next) break;
    if (input.alreadyVisited.has(next.url)) continue;
    input.alreadyVisited.add(next.url);
    try {
      assertPublicHttpUrl(next.url);
    } catch {
      continue;
    }
    const page = await browseNavigate(next.url);
    extra.push(page);
    if (next.depth < depth) {
      for (const link of pickCrawlTargets(page)) {
        if (!input.alreadyVisited.has(link)) {
          frontier.push({ url: link, depth: next.depth + 1 });
        }
      }
    }
  }
  return extra;
}

function pickCrawlTargets(page: BrowsePage, limit = 4): string[] {
  const origin = safeOrigin(page.url);
  const same = page.links.filter((link) => safeOrigin(link) === origin);
  const rest = page.links.filter((link) => safeOrigin(link) !== origin);
  return [...same, ...rest].slice(0, limit);
}

function safeOrigin(raw: string): string {
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

async function fetchBrowse(url: string): Promise<BrowsePage> {
  const fetched = await fetchUrlText(url);
  return {
    url: fetched.url,
    ok: fetched.ok,
    text: fetched.text,
    excerpt: excerptFromText(fetched.text),
    links: fetched.links,
    engine: "fetch",
    error: fetched.error,
  };
}

export const PLAYWRIGHT_LAUNCH_ARGS = [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
];

export const PLAYWRIGHT_USER_AGENT =
  "CINEM-Pro-Research/0.2 (+https://github.com/mrosmanyt/brandcrew)";

export async function snapshotPlaywrightPage(page: {
  url: () => string;
  title: () => Promise<string>;
  content: () => Promise<string>;
  locator: (selector: string) => {
    ariaSnapshot: (opts: { timeout: number }) => Promise<string>;
    innerText: (opts: { timeout: number }) => Promise<string>;
  };
}): Promise<BrowsePage> {
  const finalUrl = page.url();
  assertPublicHttpUrl(finalUrl);
  const title = await page.title().catch(() => "");
  let aria = "";
  try {
    aria = await page.locator("body").ariaSnapshot({ timeout: 4_000 });
  } catch {
    aria = "";
  }
  const bodyText = await page.locator("body").innerText({ timeout: 4_000 }).catch(() => "");
  const html = await page.content().catch(() => "");
  const text = (aria.trim() || htmlToText(html) || bodyText).replace(/\s+\n/g, "\n").trim();
  const links = extractHtmlLinks(html, finalUrl);
  return {
    url: finalUrl,
    ok: Boolean(text || title),
    title,
    text: text.slice(0, SNAPSHOT_MAX_CHARS),
    excerpt: excerptFromText(text || title),
    links,
    engine: "playwright",
  };
}

async function playwrightNavigate(url: string): Promise<BrowsePage> {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw new Error("PLAYWRIGHT_ENABLED but no Chrome binary. Set PLAYWRIGHT_CHROME_PATH or disable Playwright.");
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: PLAYWRIGHT_LAUNCH_ARGS,
  });
  try {
    const page = await browser.newPage({
      userAgent: PLAYWRIGHT_USER_AGENT,
    });
    page.setDefaultTimeout(BROWSE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(BROWSE_TIMEOUT_MS);
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: BROWSE_TIMEOUT_MS,
    });
    const snap = await snapshotPlaywrightPage(page);
    const ok = response ? response.ok() : snap.ok;
    return {
      ...snap,
      ok,
      error: ok ? undefined : `HTTP ${response?.status() ?? "unknown"}`,
    };
  } finally {
    await browser.close();
  }
}
