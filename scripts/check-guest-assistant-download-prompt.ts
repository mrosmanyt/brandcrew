/**
 * Retirement guard: the guest-landing "Cinem AI Assistant — Download now"
 * modal and the founding-spots banner were removed by owner order
 * (copy sweep, 2026-11-19). This check now asserts they stay gone and the
 * guest landing itself is intact. No database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { scripts?: Record<string, string> };

// The retired components and their prompt-gating lib are deleted.
assert.equal(
  existsSync("src/components/marketing/cinem-ai-assistant-download-prompt.tsx"),
  false,
  "download prompt component must stay deleted",
);
assert.equal(
  existsSync("src/lib/guest-assistant-download-prompt.ts"),
  false,
  "download prompt lib must stay deleted",
);
assert.equal(
  existsSync("src/components/marketing/founding-spots-banner.tsx"),
  false,
  "founding spots banner component must stay deleted",
);
console.log("ok: download prompt + founding banner files are gone");

// Nothing on the guest landing mounts them anymore.
const home = readFileSync("src/components/web/guest-chat-home.tsx", "utf8");
assert.doesNotMatch(home, /CinemAiAssistantDownloadPrompt/);
assert.doesNotMatch(home, /FoundingSpotsBanner/);
assert.doesNotMatch(home, /founding-spots-banner/);
assert.doesNotMatch(home, /cinem-ai-assistant-download-prompt/);
console.log("ok: guest landing mounts neither the download prompt nor the banner");

// The guest landing itself is unharmed.
assert.match(home, /DesktopBuildRequiredDialog/);
assert.match(home, /What can I help with\?/);
assert.match(home, /Sign in to save your chats and generate/);
console.log("ok: guest landing still renders chat + build gate");

// The signup page no longer renders the founding banner either.
const signup = readFileSync("src/app/signup/signup-screen.tsx", "utf8");
assert.doesNotMatch(signup, /FoundingSpotsBanner/);
console.log("ok: signup screen mounts no founding banner");

assert.equal(
  pkg.scripts?.["test:guest-assistant-prompt"],
  "tsx scripts/check-guest-assistant-download-prompt.ts",
);
console.log("Guest assistant download prompt retirement checks passed.");
