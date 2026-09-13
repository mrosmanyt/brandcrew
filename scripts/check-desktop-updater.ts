/**
 * Unified Electron NSIS auto-update contract (electron-updater).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  build: {
    files: string[];
    publish?: Array<{ provider?: string; owner?: string; repo?: string }>;
  };
};

assert.equal(pkg.version, "0.3.4");
assert.match(pkg.dependencies?.["electron-updater"] ?? "", /\d/);
assert.equal(pkg.scripts?.["test:desktop-updater"], "tsx scripts/check-desktop-updater.ts");
console.log("ok: version + electron-updater dependency");

for (const file of [
  "electron/updater.cjs",
  "electron/updates.html",
  "electron/updates-preload.cjs",
]) {
  assert.ok(existsSync(file), `missing ${file}`);
  assert.ok(pkg.build.files.includes(file), `package.json build.files missing ${file}`);
}

const publish = pkg.build.publish?.[0];
assert.equal(publish?.provider, "github");
assert.equal(publish?.owner, "mrosmanyt");
assert.equal(publish?.repo, "cinem-pro-releases");
console.log("ok: GitHub publish feed is cinem-pro-releases");

const builder = require("./electron-builder.config.cjs") as {
  files: string[];
  publish: { provider?: string; owner?: string; repo?: string } | Array<{ provider?: string }>;
};
const fileList = builder.files.map(String);
assert.ok(
  fileList.some((item) => item.includes("node_modules/electron-updater")),
  "builder config must pack electron-updater",
);
const pub = Array.isArray(builder.publish) ? builder.publish[0] : builder.publish;
assert.equal(pub?.provider, "github");
console.log("ok: electron-builder packs updater + publish config");

const main = readFileSync("electron/main.cjs", "utf8");
assert.match(main, /startAutoUpdates/);
assert.match(main, /openUpdatesWindow/);
assert.match(main, /Help[\s\S]*Updates|role:\s*"help"/);
assert.match(main, /label:\s*"Updates"/);

const updater = readFileSync("electron/updater.cjs", "utf8");
assert.match(updater, /electron-updater/);
assert.match(updater, /mrosmanyt/);
assert.match(updater, /cinem-pro-releases/);
assert.match(updater, /quitAndInstall/);
assert.match(updater, /PORTABLE_EXECUTABLE_DIR/);
assert.match(updater, /cinem:update:get/);
assert.match(updater, /cinem:update:check/);
assert.match(updater, /cinem:update:download/);
assert.match(updater, /cinem:update:install/);
assert.match(updater, /cinem:update:set-auto/);
assert.match(updater, /cinem:update:status/);
assert.match(updater, /ensureAutoUpdater/);
assert.doesNotMatch(updater, /Updater is not initialized/);
assert.doesNotMatch(updater, /\.publisherName\s*=/);

const updatesHtml = readFileSync("electron/updates.html", "utf8");
assert.match(updatesHtml, /Auto Update/);
assert.match(updatesHtml, /Check now/);
assert.match(updatesHtml, /Download &amp; Install|Download & Install/);
assert.match(updatesHtml, /Restart/);
assert.match(updatesHtml, /Checking/);
assert.match(updatesHtml, /Up to date/);
assert.match(updatesHtml, /Update available/);
assert.match(updatesHtml, /Ready to restart/);
assert.match(updatesHtml, /CINEM Pro/);
assert.match(updatesHtml, /SmartScreen/);
assert.doesNotMatch(updatesHtml, /OpenAI|Claude|Gemini/);

const chrome = readFileSync("electron/chrome.html", "utf8");
assert.match(chrome, />Updates</);
assert.match(readFileSync("electron/chrome-preload.cjs", "utf8"), /openUpdates/);
assert.match(readFileSync("electron/assistant-preload.cjs", "utf8"), /cinem:update:get/);
console.log("ok: Update section + IPC + unsigned honesty");

const workflow = readFileSync(".github/workflows/desktop-windows.yml", "utf8");
assert.match(workflow, /latest\.yml/);
assert.match(workflow, /\*\.blockmap/);
assert.match(workflow, /cinem-pro-releases/);

const docs = readFileSync("docs/desktop-auto-update.md", "utf8");
assert.match(docs, /cinem-pro-vX\.Y\.Z|cinem-pro-v0\.3/);
assert.match(docs, /latest\.yml/);
assert.match(docs, /0\.3\.1/);
assert.match(docs, /0\.3\.2/);
assert.match(docs, /0\.3\.3/);
assert.match(docs, /0\.3\.0/);
assert.match(docs, /Auto Update/);
assert.match(docs, /SmartScreen/);
assert.match(docs, /Portable/);
assert.doesNotMatch(docs, /signed and trusted publisher|we signed the app/i);
console.log("ok: CI + founder docs");

const assistantUpdater = readFileSync("apps/cinem-ai-assistant/src/lib/updater.ts", "utf8");
assert.match(assistantUpdater, /cinemDesktopBridge/);
assert.match(assistantUpdater, /updates\.check/);
assert.match(assistantUpdater, /electron-updater/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx", "utf8"), /Auto Update/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx", "utf8"), /Check now/);
assert.match(readFileSync("docs/cinem-ai-assistant.md", "utf8"), /desktop-auto-update/);
console.log("ok: assistant Settings uses Electron IPC");

console.log("Desktop updater checks passed.");
