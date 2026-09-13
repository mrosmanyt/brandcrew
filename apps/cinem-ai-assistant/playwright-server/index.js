/**
 * Cinem AI Assistant — Playwright automation sidecar.
 *
 * Launches a single visible, persistent Chromium and exposes a tiny HTTP API
 * the Cinem AI Assistant desktop app calls for reliable browser automation.
 *
 *   GET  /health                      → { ok: true }
 *   POST /open    { url }             → navigates (opens a tab) to url
 *   POST /search  { query }           → Google search for query
 *   POST /youtube { query, play }     → YouTube search; if play, opens first video
 *
 * Run:
 *   cd playwright-server
 *   npm install        (also downloads Chromium via postinstall)
 *   npm start          (keep this running while you use Cinem AI Assistant)
 */
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 7878;
const USER_DATA_DIR = path.join(os.tmpdir(), "cinem-ai-assistant-playwright-profile");

let context = null; // persistent browser context

/** Lazily launches (or relaunches) the persistent Chromium context. */
async function getContext() {
  if (context && context.browser() && context.browser().isConnected()) return context;
  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: null, // use the real window size
    args: ["--start-maximized"],
  });
  context.on("close", () => { context = null; });
  return context;
}

/** Returns a usable page (reuses the last one, or opens a fresh tab). */
async function getPage() {
  const ctx = await getContext();
  const pages = ctx.pages();
  const page = pages.length ? pages[pages.length - 1] : await ctx.newPage();
  return page;
}

/**
 * Forces the Chromium window into the FOREGROUND: un-minimizes it via CDP and
 * focuses the tab, so the user always SEES the action happen (not background).
 */
async function bringWindowToFront(page) {
  try {
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send("Browser.getWindowForTarget");
    const { bounds } = await session.send("Browser.getWindowBounds", { windowId });
    if (bounds.windowState === "minimized") {
      await session.send("Browser.setWindowBounds", {
        windowId,
        bounds: { windowState: "normal" },
      });
    }
    await session.detach().catch(() => {});
  } catch {
    /* CDP focus is best-effort */
  }
  await page.bringToFront().catch(() => {});
}

async function openUrl(url) {
  const page = await getPage();
  await bringWindowToFront(page); // foreground FIRST — user watches it load
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await bringWindowToFront(page);
  return { ok: true, url };
}

async function googleSearch(query) {
  return openUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
}

async function youtube(query, play) {
  const page = await getPage();
  await bringWindowToFront(page);
  await page.goto(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  if (play) {
    try {
      // First real video result; fall back to leaving the results page open.
      const first = page.locator("ytd-video-renderer a#thumbnail, a#video-title").first();
      await first.waitFor({ timeout: 8000 });
      await first.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    } catch {
      /* leave results page open */
    }
  }
  await bringWindowToFront(page);
  return { ok: true };
}

/* ══ WHATSAPP REMOTE CONTROL ════════════════════════════════════════
 * Automates WhatsApp Web in its OWN persistent Chromium profile (QR scan
 * survives restarts). The Cinem AI Assistant app polls /wa/* to read commands from the
 * user's "Message yourself" chat and replies into the same chat.
 *
 * Security model: only the self-chat is ever opened — by definition only
 * the account owner can write into it from their phone.
 * ─────────────────────────────────────────────────────────────────── */
const WA_DATA_DIR = path.join(os.homedir(), ".cinem-ai-assistant-whatsapp-profile");
let waContext = null;
let waPage = null;
const waSeen = new Set(); // message data-ids already delivered
let waPrimed = false; // first poll after open-self only absorbs history

async function waGetPage() {
  if (waPage && !waPage.isClosed()) return waPage;
  if (!waContext || !waContext.browser()?.isConnected()) {
    waContext = await chromium.launchPersistentContext(WA_DATA_DIR, {
      headless: false,
      viewport: null,
      args: ["--window-size=1100,800"],
    });
    waContext.on("close", () => { waContext = null; waPage = null; });
  }
  const pages = waContext.pages();
  waPage = pages.length ? pages[0] : await waContext.newPage();
  return waPage;
}

async function waStart() {
  const page = await waGetPage();
  if (!page.url().includes("web.whatsapp.com")) {
    await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await bringWindowToFront(page);
  waSeen.clear();
  waPrimed = false;
  return { ok: true };
}

/** loggedIn = chat list visible · qr = QR canvas on screen. */
async function waStatus() {
  if (!waPage || waPage.isClosed()) return { ok: true, running: false, loggedIn: false, qr: false };
  try {
    const loggedIn = (await waPage.locator("#side, [data-testid='chat-list']").count()) > 0;
    const qr = (await waPage.locator("canvas, [data-ref]").count()) > 0 && !loggedIn;
    return { ok: true, running: true, loggedIn, qr };
  } catch {
    return { ok: true, running: true, loggedIn: false, qr: false };
  }
}

/** Opens the user's self-chat ("Message yourself") via the search box. */
async function waOpenSelf(query) {
  const page = await waGetPage();
  // search box (several generations of selectors, newest first)
  const search = page.locator(
    "div[contenteditable='true'][data-tab='3'], [data-testid='chat-list-search'], div[title='Search input textbox']",
  ).first();
  await search.waitFor({ timeout: 15000 });
  await search.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await search.type(query, { delay: 35 });
  await page.waitForTimeout(2200); // results settle
  // first result row
  const first = page.locator("#pane-side [role='listitem'], #pane-side div[tabindex='-1'][role='row']").first();
  await first.waitFor({ timeout: 8000 });
  await first.click();
  await page.waitForTimeout(800);
  const composer = page.locator("footer div[contenteditable='true']").first();
  await composer.waitFor({ timeout: 8000 });
  waSeen.clear();
  waPrimed = false; // next poll absorbs existing history silently
  return { ok: true };
}

/** New text messages in the OPEN chat since the last poll. */
async function waPoll() {
  const page = await waGetPage();
  const rows = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("#main div[data-id]")) {
      const id = el.getAttribute("data-id") || "";
      const textEl = el.querySelector(".selectable-text span, .copyable-text span.selectable-text");
      const text = textEl ? textEl.textContent || "" : "";
      if (id && text) out.push({ id, text });
    }
    return out;
  });
  const fresh = [];
  for (const r of rows) {
    if (waSeen.has(r.id)) continue;
    waSeen.add(r.id);
    fresh.push(r);
  }
  // First poll after open-self: absorb the existing history, deliver nothing.
  if (!waPrimed) {
    waPrimed = true;
    return { ok: true, messages: [] };
  }
  return { ok: true, messages: fresh };
}

/** Types a reply into the open chat's composer and presses Enter. */
async function waSend(text) {
  const page = await waGetPage();
  const composer = page.locator("footer div[contenteditable='true']").first();
  await composer.waitFor({ timeout: 8000 });
  await composer.click();
  // insertText keeps emoji + multi-line intact (fill() is flaky on WA Web)
  for (const line of String(text).split("\n")) {
    await page.keyboard.insertText(line);
    await page.keyboard.down("Shift");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Shift");
  }
  await page.keyboard.press("Enter");
  return { ok: true };
}

async function waStop() {
  try { await waContext?.close(); } catch { /* ignore */ }
  waContext = null;
  waPage = null;
  return { ok: true };
}

/* ══ SOCIAL MEDIA UPLOADER ══════════════════════════════════════════
 * Each platform gets its OWN persistent Chromium profile, so the user logs
 * in ONCE (cookies survive restarts) and later "Upload to all" just works.
 * Web automation is inherently fragile — selectors may need updates as the
 * sites change. Every step is defensive and reports the stage it reached.
 * ─────────────────────────────────────────────────────────────────── */
const SOCIAL = {
  instagram: { url: "https://www.instagram.com/", loginCheck: "svg[aria-label='New post'], [aria-label='New post'], a[href*='/create/']" },
  tiktok:    { url: "https://www.tiktok.com/upload?lang=en", loginCheck: "input[type='file'], div[contenteditable='true']" },
  facebook:  { url: "https://www.facebook.com/", loginCheck: "[aria-label='Create a post'], [role='navigation']" },
  youtube:   { url: "https://studio.youtube.com/", loginCheck: "#create-icon, ytcp-button#create-icon, tp-yt-paper-icon-button#create-icon" },
  grok:      { url: "https://grok.com/", loginCheck: "textarea, div[contenteditable='true']" },
};
const CHROME_DEBUG_PORT = 9222;
const CHROME_PROFILE = path.join(os.homedir(), ".cinem-ai-assistant-chrome");
let realChrome = null; // { browser } connected over CDP to the user's real Chrome

/** Finds the user's installed Chrome executable (Windows / macOS / Linux). */
function findChrome() {
  const c = [
    process.env.CHROME_PATH,
    path.join(process.env["PROGRAMFILES"] || "C:\\Program Files", "Google\\Chrome\\Application\\chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google\\Chrome\\Application\\chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  return c.find((p) => p && fs.existsSync(p)) || null;
}

/** Polls the CDP endpoint until Chrome's debug server is ready. */
function waitForCdp(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`http://127.0.0.1:${port}/json/version`, (r) => { r.resume(); resolve(true); })
        .on("error", () => {
          if (Date.now() > deadline) reject(new Error("Chrome debug port never opened"));
          else setTimeout(tick, 400);
        });
    };
    tick();
  });
}

/**
 * Launches the user's REAL Chrome with a debugging port (normal browser, NOT
 * Playwright's bundled Chromium and WITHOUT webdriver/automation launch flags),
 * then attaches over CDP. Google sees a genuine, manually-used Chrome → no
 * "browser not secure" warning. Login + cookies persist in CHROME_PROFILE.
 */
async function getRealChrome() {
  if (realChrome?.browser?.isConnected()) return realChrome;

  const chromePath = findChrome();
  if (!chromePath) throw new Error("Google Chrome not found. Please install Chrome.");

  // Reuse if already listening (e.g. launched earlier), else spawn it.
  try {
    await waitForCdp(CHROME_DEBUG_PORT, 1500);
  } catch {
    const proc = spawn(chromePath, [
      `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
      `--user-data-dir=${CHROME_PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--start-maximized",
    ], { detached: true, stdio: "ignore" });
    proc.unref();
    await waitForCdp(CHROME_DEBUG_PORT, 25000);
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CHROME_DEBUG_PORT}`);
  browser.on("disconnected", () => { realChrome = null; });
  realChrome = { browser };
  return realChrome;
}

/** A tab in the real Chrome, reusing an existing tab on the platform's host. */
async function getPlatformPage(platform) {
  if (!SOCIAL[platform]) throw new Error(`unknown platform: ${platform}`);
  const { browser } = await getRealChrome();
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const host = new URL(SOCIAL[platform].url).host.replace(/^www\./, "");
  let page = ctx.pages().find((p) => {
    try { return new URL(p.url()).host.includes(host); } catch { return false; }
  });
  if (!page) page = await ctx.newPage();
  return page;
}

/** Opens the platform in the user's real Chrome so they log in once. */
async function socialConnect(platform) {
  const page = await getPlatformPage(platform);
  await page.goto(SOCIAL[platform].url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await bringWindowToFront(page);
  return { ok: true };
}

async function socialStatus(platform) {
  if (!realChrome?.browser?.isConnected()) return { ok: true, connected: false };
  try {
    const page = await getPlatformPage(platform);
    const n = await page.locator(SOCIAL[platform].loginCheck).count();
    return { ok: true, connected: n > 0 };
  } catch { return { ok: true, connected: false }; }
}

/** Sets a file on the first <input type=file> (works even when hidden). */
async function attachFile(page, file) {
  const input = page.locator("input[type='file']").first();
  await input.waitFor({ state: "attached", timeout: 20000 });
  await input.setInputFiles(file);
}

async function socialUpload(platform, opts) {
  const { file, title = "", caption = "", hashtags = [] } = opts;
  if (!file || !fs.existsSync(file)) return { ok: false, stage: "file", error: "video file not found" };
  const tags = Array.isArray(hashtags) ? hashtags.join(" ") : String(hashtags || "");
  const fullCaption = `${caption}\n\n${tags}`.trim();
  const page = await getPlatformPage(platform);
  await bringWindowToFront(page);

  try {
    if (platform === "tiktok") {
      await page.goto("https://www.tiktok.com/upload?lang=en", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      await attachFile(page, file);
      await page.waitForTimeout(6000); // processing
      const cap = page.locator("div[contenteditable='true'], div[data-text='true']").first();
      await cap.click().catch(() => {});
      await page.keyboard.type(fullCaption.slice(0, 2200), { delay: 8 }).catch(() => {});
      const post = page.locator("button:has-text('Post'), [data-e2e='post_video_button']").first();
      await post.click({ timeout: 15000 });
      return { ok: true, stage: "posted", message: "TikTok upload submitted" };
    }

    if (platform === "instagram") {
      await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.locator("svg[aria-label='New post'], [aria-label='New post']").first().click({ timeout: 15000 });
      await page.waitForTimeout(1200);
      await attachFile(page, file);
      await page.waitForTimeout(4000);
      // Next → Next → caption → Share (button text varies)
      for (let i = 0; i < 2; i++) {
        await page.locator("button:has-text('Next'), div[role='button']:has-text('Next')").first().click({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      const cap = page.locator("textarea[aria-label*='caption' i], div[contenteditable='true']").first();
      await cap.click().catch(() => {});
      await page.keyboard.type(fullCaption.slice(0, 2200), { delay: 6 }).catch(() => {});
      await page.locator("button:has-text('Share'), div[role='button']:has-text('Share')").first().click({ timeout: 15000 });
      return { ok: true, stage: "posted", message: "Instagram upload submitted" };
    }

    if (platform === "youtube") {
      await page.goto("https://studio.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.locator("#create-icon, ytcp-button#create-icon").first().click({ timeout: 15000 });
      await page.locator("tp-yt-paper-item:has-text('Upload'), #text-item-0").first().click({ timeout: 10000 }).catch(() => {});
      await attachFile(page, file);
      await page.waitForTimeout(4000);
      // Title + description boxes
      const titleBox = page.locator("#title-textarea #textbox, ytcp-social-suggestions-textbox#title-textarea #textbox").first();
      await titleBox.click().catch(() => {});
      await page.keyboard.press("Control+A").catch(() => {});
      await page.keyboard.type((title || caption).slice(0, 100), { delay: 5 }).catch(() => {});
      const descBox = page.locator("#description-textarea #textbox").first();
      await descBox.click().catch(() => {});
      await page.keyboard.type(fullCaption.slice(0, 4900), { delay: 3 }).catch(() => {});
      // "Not made for kids"
      await page.locator("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_NOT_MFK']").click({ timeout: 8000 }).catch(() => {});
      for (let i = 0; i < 3; i++) {
        await page.locator("#next-button, ytcp-button#next-button").first().click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      await page.locator("tp-yt-paper-radio-button[name='PUBLIC']").click({ timeout: 8000 }).catch(() => {});
      await page.locator("#done-button, ytcp-button#done-button").first().click({ timeout: 12000 }).catch(() => {});
      return { ok: true, stage: "published", message: "YouTube upload submitted via Studio" };
    }

    if (platform === "facebook") {
      await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.locator("[aria-label='Create a post'], [role='button']:has-text(\"What's on your mind\")").first().click({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.locator("[aria-label='Photo/video'], div[role='button']:has-text('Photo/video')").first().click({ timeout: 10000 }).catch(() => {});
      await attachFile(page, file);
      await page.waitForTimeout(4000);
      const box = page.locator("div[contenteditable='true'][role='textbox']").first();
      await box.click().catch(() => {});
      await page.keyboard.type(fullCaption.slice(0, 2000), { delay: 5 }).catch(() => {});
      await page.locator("[aria-label='Post'], div[role='button']:has-text('Post')").first().click({ timeout: 15000 });
      return { ok: true, stage: "posted", message: "Facebook post submitted" };
    }

    return { ok: false, stage: "platform", error: "unsupported platform" };
  } catch (e) {
    return { ok: false, stage: "automation", error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}

/* ══ SUPER GROK — AI VIDEO GENERATION ═══════════════════════════════
 * Drives grok.com (Grok Imagine) in the user's real Chrome: types the
 * scene prompt, generates, waits for the clip, downloads it to disk.
 * Semi-automatic + resilient: returns the stage it reached so the UI can
 * ask the user to finish a step manually (captcha, plan limit, etc.).
 * Selectors WILL need tuning as grok.com changes. ──────────────────── */
async function grokGenerate(prompt, outPath) {
  try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch { /* ignore */ }
  const page = await getPlatformPage("grok");
  await bringWindowToFront(page);

  try {
    // Land on the image/video creation surface (a few known routes).
    if (!/grok\.com/.test(page.url())) {
      await page.goto("https://grok.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    }
    await page.waitForTimeout(1500);

    // 1) Composer — type the scene's visual prompt.
    const box = page.locator("textarea, div[contenteditable='true']").first();
    await box.waitFor({ timeout: 20000 });
    await box.click();
    await page.keyboard.press("Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.type(prompt, { delay: 4 });

    // 2) Submit (Enter, or a Create/Generate/Imagine button).
    await page.keyboard.press("Enter").catch(() => {});
    await page.locator(
      "button:has-text('Create'), button:has-text('Generate'), button:has-text('Imagine'), button[aria-label*='generate' i], button[type='submit']",
    ).first().click({ timeout: 4000 }).catch(() => {});

    // 3) Wait for a rendered <video> (up to ~3.5 min).
    const deadline = Date.now() + 210000;
    let videoSrc = null;
    while (Date.now() < deadline) {
      const v = page.locator("video[src], video source[src]").last();
      if (await v.count()) {
        videoSrc = await v.getAttribute("src").catch(() => null);
        if (videoSrc) break;
      }
      await page.waitForTimeout(2500);
    }
    if (!videoSrc) {
      return { ok: false, stage: "render", error: "Video render timeout — captcha/limit/selector. Browser mein dekhein." };
    }

    // 4a) Prefer the site's own Download button (handles blob videos).
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 9000 }).catch(() => null),
        page.locator(
          "button:has-text('Download'), a[download], [aria-label*='download' i], button:has-text('Save')",
        ).first().click({ timeout: 5000 }).catch(() => {}),
      ]);
      if (download) {
        await download.saveAs(outPath);
        return { ok: true, path: outPath };
      }
    } catch { /* fall through */ }

    // 4b) Fallback — direct fetch of an http(s) src (won't work for blob:).
    if (/^https?:/.test(videoSrc)) {
      const resp = await page.context().request.get(videoSrc);
      fs.writeFileSync(outPath, Buffer.from(await resp.body()));
      return { ok: true, path: outPath };
    }

    return { ok: false, stage: "download", error: "Clip bani par auto-download nahi hua (blob). Manually download karein." };
  } catch (e) {
    return { ok: false, stage: "automation", error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}

/* ── HTTP server ─────────────────────────────────────────────────── */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function send(res, status, body) {
  res.writeHead(status, CORS);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });

  try {
    if (req.url === "/health") return send(res, 200, { ok: true });

    const body = await readBody(req);

    if (req.url === "/open") {
      if (!body.url) return send(res, 400, { ok: false, error: "url required" });
      return send(res, 200, await openUrl(body.url));
    }
    if (req.url === "/search") {
      if (!body.query) return send(res, 400, { ok: false, error: "query required" });
      return send(res, 200, await googleSearch(body.query));
    }
    if (req.url === "/youtube") {
      if (!body.query) return send(res, 400, { ok: false, error: "query required" });
      return send(res, 200, await youtube(body.query, !!body.play));
    }

    /* — WhatsApp remote control — */
    if (req.url === "/wa/start") return send(res, 200, await waStart());
    if (req.url === "/wa/status") return send(res, 200, await waStatus());
    if (req.url === "/wa/open-self") {
      if (!body.query) return send(res, 400, { ok: false, error: "query required" });
      return send(res, 200, await waOpenSelf(body.query));
    }
    if (req.url === "/wa/poll") return send(res, 200, await waPoll());
    if (req.url === "/wa/send") {
      if (!body.text) return send(res, 400, { ok: false, error: "text required" });
      return send(res, 200, await waSend(body.text));
    }
    if (req.url === "/wa/stop") return send(res, 200, await waStop());

    /* — Social media uploader — */
    if (req.url === "/social/connect") {
      if (!body.platform) return send(res, 400, { ok: false, error: "platform required" });
      return send(res, 200, await socialConnect(body.platform));
    }
    if (req.url === "/social/status") {
      if (!body.platform) return send(res, 400, { ok: false, error: "platform required" });
      return send(res, 200, await socialStatus(body.platform));
    }
    if (req.url === "/social/upload") {
      if (!body.platform || !body.file) return send(res, 400, { ok: false, error: "platform and file required" });
      return send(res, 200, await socialUpload(body.platform, body));
    }

    /* — Super Grok video generation — */
    if (req.url === "/grok/connect") return send(res, 200, await socialConnect("grok"));
    if (req.url === "/grok/generate") {
      if (!body.prompt || !body.outPath) return send(res, 400, { ok: false, error: "prompt and outPath required" });
      return send(res, 200, await grokGenerate(body.prompt, body.outPath));
    }

    return send(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    console.error("[playwright-server] error:", e);
    return send(res, 500, { ok: false, error: String(e?.message ?? e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cinem AI Assistant Playwright sidecar listening on http://127.0.0.1:${PORT}`);
  console.log("Launching Chromium…");
  getContext().catch((e) => console.error("Chromium launch failed:", e));
});

// Clean shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    try { await context?.close(); } catch { /* ignore */ }
    try { await waContext?.close(); } catch { /* ignore */ }
    // Note: we DON'T kill the user's real Chrome on shutdown — leave their
    // browser + logins intact. Just detach the CDP connection.
    try { await realChrome?.browser?.close(); } catch { /* ignore */ }
    process.exit(0);
  });
}
