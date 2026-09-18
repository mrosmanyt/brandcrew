/**
 * Windows download toast: audience, session dismiss, Setup.exe CTA, desk mount.
 * No database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DESKTOP_WIN_DOWNLOAD, WIN_SETUP_FILENAME } from "../src/lib/site";
import {
  WIN_DOWNLOAD_NUDGE_LOCAL_KEY,
  WIN_DOWNLOAD_NUDGE_SESSION_KEY,
  isWindowsDownloadNudgePath,
  isWindowsDownloadPromptSurface,
  isWindowsWebVisitor,
  shouldOfferWindowsDownloadNudge,
} from "../src/lib/windows-download-nudge";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { scripts?: Record<string, string> };

const WIN_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const WIN32_LEGACY = "Mozilla/5.0 (Windows; Win32; Windows NT 10.0) AppleWebKit/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ELECTRON_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36";
const WIN_PHONE =
  "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; WebView/3.0) AppleWebKit/537.36 Mobile";

assert.equal(isWindowsWebVisitor(WIN_CHROME), true);
assert.equal(isWindowsWebVisitor(WIN32_LEGACY), true);
assert.equal(isWindowsWebVisitor("", "Win32"), true);
assert.equal(isWindowsWebVisitor(MAC), false);
assert.equal(isWindowsWebVisitor(LINUX), false);
assert.equal(isWindowsWebVisitor(IPHONE), false);
assert.equal(isWindowsWebVisitor(ANDROID), false);
assert.equal(isWindowsWebVisitor(IPAD), false);
assert.equal(isWindowsWebVisitor(ELECTRON_WIN), false);
assert.equal(isWindowsWebVisitor(WIN_PHONE), false);
assert.equal(isWindowsWebVisitor(""), false);
console.log("ok: Windows UA only — skip Mac/Linux/mobile/Electron");

assert.equal(isWindowsDownloadNudgePath("/"), true);
assert.equal(isWindowsDownloadNudgePath("/desk"), true);
assert.equal(isWindowsDownloadNudgePath("/desk/ws_1"), true);
assert.equal(isWindowsDownloadNudgePath("/desk/ws_1/settings"), true);
assert.equal(isWindowsDownloadNudgePath("/desk/ws_1/on-device"), false);
assert.equal(isWindowsDownloadNudgePath("/download"), false);
assert.equal(isWindowsDownloadNudgePath("/cinem-ai-assistant"), false);
assert.equal(isWindowsDownloadNudgePath("/login"), false);
assert.equal(isWindowsDownloadNudgePath("/billing"), false);
assert.equal(isWindowsDownloadPromptSurface("/download"), true);
assert.equal(isWindowsDownloadPromptSurface("/desk/ws_1/on-device/"), true);
console.log("ok: desk + marketing home only; skip download / on-device stacks");

assert.equal(
  shouldOfferWindowsDownloadNudge({
    userAgent: WIN_CHROME,
    pathname: "/desk/ws_1",
  }),
  true,
);
assert.equal(
  shouldOfferWindowsDownloadNudge({
    userAgent: WIN_CHROME,
    pathname: "/desk/ws_1",
    sessionDismissed: true,
  }),
  false,
);
assert.equal(
  shouldOfferWindowsDownloadNudge({
    userAgent: WIN_CHROME,
    pathname: "/desk/ws_1",
    localHidden: true,
  }),
  false,
);
assert.equal(
  shouldOfferWindowsDownloadNudge({
    userAgent: MAC,
    pathname: "/desk/ws_1",
  }),
  false,
);
assert.equal(
  shouldOfferWindowsDownloadNudge({
    userAgent: WIN_CHROME,
    pathname: "/",
  }),
  true,
);
console.log("ok: session dismiss + local hide + path gates");

assert.equal(WIN_SETUP_FILENAME, "CINEM-Pro-Setup.exe");
assert.match(DESKTOP_WIN_DOWNLOAD, /cinem-pro-releases/);
assert.match(DESKTOP_WIN_DOWNLOAD, /CINEM-Pro-Setup\.exe/);
assert.equal(WIN_DOWNLOAD_NUDGE_SESSION_KEY, "cinem-win-download-nudge");
assert.equal(WIN_DOWNLOAD_NUDGE_LOCAL_KEY, "cinem-win-download-nudge-hide");
const assistantLib = readFileSync("src/lib/cinem-ai-assistant.ts", "utf8");
assert.match(assistantLib, /export function cinemAiAssistantDownloadHref/);
assert.match(assistantLib, /DESKTOP_WIN_DOWNLOAD/);
assert.match(assistantLib, /validatedDesktopInstallerEnvUrl/);
assert.match(assistantLib, /isExternalDirectInstallerUrl/);
console.log("ok: CTA helpers still point at latest Setup.exe via direct CDN URL");

assert.ok(existsSync("src/lib/windows-download-nudge.ts"));
assert.ok(existsSync("src/components/desk/windows-download-nudge.tsx"));
const ui = readFileSync("src/components/desk/windows-download-nudge.tsx", "utf8");
assert.match(ui, /"use client"/);
assert.match(ui, /sessionStorage/);
assert.match(ui, /WIN_DOWNLOAD_NUDGE_SESSION_KEY/);
assert.match(ui, /downloadHref/);
assert.match(ui, /WIN_SETUP_FILENAME/);
assert.doesNotMatch(ui, /from ["']@\/lib\/cinem-ai-assistant["']/);
assert.match(ui, /Get CINEM Pro for Windows/);
assert.match(ui, /Desk \+ AI Assistant in one Setup\.exe/);
assert.match(ui, /Not now/);
assert.match(ui, /top-14/);
assert.match(ui, /z-40/);
assert.match(ui, /shouldOfferWindowsDownloadNudge/);
assert.match(ui, /usePathname/);
assert.doesNotMatch(ui, /onJob|JobEvent|streaming|useChat|addEventListener\(["']message/);
assert.doesNotMatch(ui, /OpenAI|Claude|Gemini|ChatGPT/i);
const visibleCopy = ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
assert.doesNotMatch(visibleCopy, /Grok/i);
const deskLayout = readFileSync("src/app/desk/[workspaceId]/layout.tsx", "utf8");
assert.match(deskLayout, /WindowsDownloadNudge/);
assert.match(deskLayout, /cinemAiAssistantDownloadHref\(\)/);
const about = readFileSync("src/app/about/page.tsx", "utf8");
assert.match(about, /WindowsDownloadNudge/);
assert.match(about, /cinemAiAssistantDownloadHref\(\)/);
const home = readFileSync("src/app/page.tsx", "utf8");
assert.match(home, /GuestChatHome/);
assert.equal(pkg.scripts?.["test:win-nudge"], "tsx scripts/check-windows-download-nudge.ts");
console.log("ok: desk shell + about mount; home is guest chat; CINEM Pro copy only");

console.log("Windows download nudge checks passed.");
