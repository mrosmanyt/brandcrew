/**
 * Guest landing Cinem AI Assistant download modal — refresh behavior, CTA, mount.
 * No database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY,
  GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY,
  isPackagedDesktopShell,
  shouldShowGuestAssistantDownloadPrompt,
} from "../src/lib/guest-assistant-download-prompt";
import { cinemAiAssistantDownloadHref } from "../src/lib/cinem-ai-assistant";
import { WIN_SETUP_FILENAME } from "../src/lib/site";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { scripts?: Record<string, string> };

const ELECTRON_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36";
const WIN_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

assert.equal(GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY, "cinem-guest-assistant-download-dismiss");
assert.equal(GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY, "cinem-guest-assistant-download-complete");
assert.equal(shouldShowGuestAssistantDownloadPrompt({ downloaded: false }), true);
assert.equal(shouldShowGuestAssistantDownloadPrompt({ downloaded: true }), false);
assert.equal(shouldShowGuestAssistantDownloadPrompt({ downloaded: false, signedIn: true }), false);
assert.equal(
  shouldShowGuestAssistantDownloadPrompt({ downloaded: false, userAgent: ELECTRON_WIN }),
  false,
);
assert.equal(
  shouldShowGuestAssistantDownloadPrompt({ downloaded: false, userAgent: WIN_CHROME }),
  true,
);
assert.equal(isPackagedDesktopShell(ELECTRON_WIN), true);
console.log("ok: download-complete + signed-in + packaged shell gates");

const href = cinemAiAssistantDownloadHref();
assert.match(href, /^https:\/\/github\.com\/mrosmanyt\/cinem-pro-releases\//);
assert.match(href, /CINEM-Pro-Setup\.exe/);
assert.equal(WIN_SETUP_FILENAME, "CINEM-Pro-Setup.exe");
console.log("ok: download CTA reuses unified Setup.exe");

assert.ok(existsSync("src/lib/guest-assistant-download-prompt.ts"));
assert.ok(existsSync("src/components/marketing/cinem-ai-assistant-download-prompt.tsx"));
const ui = readFileSync("src/components/marketing/cinem-ai-assistant-download-prompt.tsx", "utf8");
assert.match(ui, /"use client"/);
assert.match(ui, /GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY/);
assert.match(ui, /useMarketingAuth/);
assert.match(ui, /cinemAiAssistantDownloadHref/);
assert.match(ui, /Download now/);
assert.match(ui, /CINEM_AI_ASSISTANT_NAME/);
assert.match(ui, /Not now/);
assert.match(ui, /Dialog/);
assert.doesNotMatch(ui, /GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY/);

const home = readFileSync("src/components/web/guest-chat-home.tsx", "utf8");
assert.match(home, /CinemAiAssistantDownloadPrompt/);
assert.match(home, /FoundingSpotsBanner/);
assert.match(home, /DesktopBuildRequiredDialog/);
assert.match(home, /What can I help with\?/);
console.log("ok: guest landing mounts prompt without regressing banner or build gate");

assert.equal(
  pkg.scripts?.["test:guest-assistant-prompt"],
  "tsx scripts/check-guest-assistant-download-prompt.ts",
);
console.log("Guest assistant download prompt checks passed.");
