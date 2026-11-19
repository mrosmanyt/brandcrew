/**
 * Retirement guard: the Windows download toast ("Get CINEM Pro for
 * Windows — Desk + AI Assistant in one Setup.exe") promoted the retired
 * desktop installer and was removed from the public site by owner order
 * (copy sweep, 2026-11-19). This check now asserts it stays gone.
 * No database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { scripts?: Record<string, string> };

// The retired toast component and its gating lib are deleted.
assert.equal(
  existsSync("src/components/desk/windows-download-nudge.tsx"),
  false,
  "windows download nudge component must stay deleted",
);
assert.equal(
  existsSync("src/lib/windows-download-nudge.ts"),
  false,
  "windows download nudge lib must stay deleted",
);
console.log("ok: windows download nudge files are gone");

// No public page mounts it anymore.
const about = readFileSync("src/app/about/page.tsx", "utf8");
assert.doesNotMatch(about, /WindowsDownloadNudge/);
assert.doesNotMatch(about, /cinemAiAssistantDownloadHref/);
const home = readFileSync("src/app/page.tsx", "utf8");
assert.match(home, /GuestChatHome/);
assert.doesNotMatch(home, /AssistantMarketingMain/);
assert.doesNotMatch(home, /WindowsDownloadNudge/);
const chat = readFileSync("src/app/chat/page.tsx", "utf8");
assert.match(chat, /GuestChatHome/);
console.log("ok: about + home mount no download nudge; home is CINEM Pro chat");

assert.equal(pkg.scripts?.["test:win-nudge"], "tsx scripts/check-windows-download-nudge.ts");
console.log("Windows download nudge retirement checks passed.");
