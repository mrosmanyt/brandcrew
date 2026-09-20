/**
 * Desktop shell startup safety: the whenReady() setup code is guarded,
 * boot() failures and process-level crashes get logged to a file, and
 * every electron/*.cjs and *.html file main.cjs actually loads is present
 * in package.json's build.files array (else it's silently missing from
 * the packaged app). Source-only — no Electron runtime here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const mainSrc = readFileSync(join(root, "electron/main.cjs"), "utf8");
const logSrc = readFileSync(join(root, "electron/main-log.cjs"), "utf8");
const pkg = require("../package.json") as {
  build: { files: string[] };
};

// Kaam 1: the whenReady() setup code (installAppMenu, ipcMain registrations,
// computerUse/systemMeters registerIpc) is wrapped, with boot() called only
// after that try succeeds, and boot()'s own catch is unchanged in shape.
assert.match(mainSrc, /app\.whenReady\(\)\.then\(\(\) => \{\s*try \{/);
assert.match(mainSrc, /installAppMenu\(\);/);
assert.match(mainSrc, /computerUse\.registerIpc\(ipcMain\);/);
assert.match(mainSrc, /systemMeters\.registerSystemMetersIpc\(ipcMain\);/);
assert.match(
  mainSrc,
  /\} catch \(error\) \{\s*mainLog\.logError\(app, "startup", error\);\s*dialog\.showErrorBox\(/,
);
assert.match(mainSrc, /return boot\(\)\.catch\(\(error\) => \{/);
assert.match(mainSrc, /mainLog\.logError\(app, "boot", error\);/);
console.log("ok: whenReady() setup is wrapped; boot()'s own catch shape is unchanged");

// Kaam 2: startup/version log, process-level crash logging, renderer
// crash / did-fail-load logging, and a size-limited log file — no
// secrets/tokens/user data in any logged string.
assert.match(mainSrc, /app\.setName\("CINEM Pro"\);\s*mainLog\.logInfo\(/);
assert.match(mainSrc, /version=\$\{app\.getVersion\(\)\} platform=\$\{process\.platform\} arch=\$\{process\.arch\}/);
assert.match(mainSrc, /process\.on\("uncaughtException", \(error\) => \{\s*mainLog\.logError\(app, "uncaughtException", error\);/);
assert.match(mainSrc, /process\.on\("unhandledRejection", \(reason\) => \{\s*mainLog\.logError\(app, "unhandledRejection", reason\);/);
assert.match(mainSrc, /mainLog\.logInfo\(\s*app,\s*`did-fail-load/);
assert.match(mainSrc, /mainLog\.logInfo\(app, `render-process-gone/);
assert.doesNotMatch(mainSrc, /mainLog\.log\w+\([^)]*(token|password|secret|cookie)/i);
assert.match(logSrc, /MAX_LOG_BYTES/);
assert.match(logSrc, /rotateIfNeeded/);
assert.match(logSrc, /app\.getPath\("logs"\)/);
console.log("ok: startup/crash/renderer-failure events are logged with a size-limited log file");

// Every electron/*.cjs or *.html file main.cjs requires or loads by path
// must be in build.files, or it's silently missing from the packaged app
// (this is exactly how local-builder.cjs, wake-word.cjs, system-meters.cjs,
// mode-chooser.html/-preload.cjs, and ai-cursor-overlay.html were found
// missing while wiring up main-log.cjs).
const requiredCjs = [...mainSrc.matchAll(/require\("\.\/([\w-]+\.cjs)"\)/g)].map((m) => m[1]);
const referencedHtml = [...mainSrc.matchAll(/"([\w-]+\.html)"/g)].map((m) => m[1]);
const filesSet = new Set(pkg.build.files.map((f) => f.replace(/^electron\//, "")));
for (const name of [...new Set(requiredCjs)]) {
  assert.ok(filesSet.has(name), `electron/${name} is require()'d by main.cjs but missing from build.files`);
}
for (const name of [...new Set(referencedHtml)]) {
  assert.ok(filesSet.has(name), `electron/${name} is referenced by main.cjs but missing from build.files`);
}
assert.ok(filesSet.has("main-log.cjs"), "electron/main-log.cjs missing from build.files");
console.log("ok: every electron/*.cjs and *.html file main.cjs loads is packaged in build.files");

// Kaam 3: SmartScreen guidance sits near a Windows download button, in the
// site's existing small-note style (matches the Android card's pattern),
// not inside windows-download-nudge.tsx.
const homeSections = readFileSync(join(root, "src/components/marketing/home-sections.tsx"), "utf8");
const downloadPage = readFileSync(join(root, "src/app/download/page.tsx"), "utf8");
const nudge = readFileSync(join(root, "src/components/desk/windows-download-nudge.tsx"), "utf8");
assert.match(homeSections, /protected your PC.*More info, then Run anyway/s);
assert.match(downloadPage, /protected your PC.*More info, then Run anyway/s);
assert.doesNotMatch(nudge, /protected your PC/);
console.log("ok: SmartScreen guidance sits near Windows download buttons, not in the nudge card");

console.log("Desktop startup safety checks passed.");
