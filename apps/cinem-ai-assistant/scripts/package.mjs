/**
 * Cinem AI Assistant release packager — run AFTER `npm run tauri build`:
 *
 *   npm run package        (or `npm run dist` = build + package)
 *
 * Produces in D:\Cinem AI Assistant\release\:
 *   • Cinem-AI-Assistant-Setup.exe        — the professional NSIS installer (renamed)
 *   • README-INSTALL.txt      — end-user instructions
 *   • CINEM-AI-ASSISTANT-Full-Package.zip — both files, ready to upload anywhere
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nsisDir = path.join(root, "src-tauri", "target", "release", "bundle", "nsis");
const releaseDir = path.join(root, "release");

/* 1 — locate the freshest installer produced by Tauri's NSIS bundler */
if (!existsSync(nsisDir)) {
  console.error(`✗ No NSIS output at ${nsisDir}`);
  console.error("  Run `npm run tauri build` first (or use `npm run dist`).");
  process.exit(1);
}
const installers = readdirSync(nsisDir)
  .filter((f) => f.endsWith(".exe"))
  .map((f) => ({ f, t: statSync(path.join(nsisDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
if (!installers.length) {
  console.error("✗ No .exe found in the NSIS bundle folder. Build first.");
  process.exit(1);
}
const src = path.join(nsisDir, installers[0].f);

/* 2 — assemble the release folder */
mkdirSync(releaseDir, { recursive: true });
const setupExe = path.join(releaseDir, "Cinem-AI-Assistant-Setup.exe");
cpSync(src, setupExe);
console.log(`✓ Cinem-AI-Assistant-Setup.exe  ←  ${installers[0].f}`);

const readmeSrc = path.join(root, "README-INSTALL.txt");
const readmeDst = path.join(releaseDir, "README-INSTALL.txt");
if (existsSync(readmeSrc)) {
  cpSync(readmeSrc, readmeDst);
  console.log("✓ README-INSTALL.txt copied");
}

/* 3 — zip it (PowerShell Compress-Archive — no extra dependencies) */
const zipPath = path.join(releaseDir, "Cinem-AI-Assistant-Full-Package.zip");
const items = [setupExe, existsSync(readmeDst) ? readmeDst : null].filter(Boolean);
execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Compress-Archive -Force -Path ${items.map((p) => `'${p}'`).join(",")} -DestinationPath '${zipPath}'`,
]);
console.log("✓ CINEM-AI-ASSISTANT-Full-Package.zip created");

console.log(`\n🎉 Release ready in: ${releaseDir}`);
console.log("   Upload Cinem-AI-Assistant-Full-Package.zip — users just run Cinem-AI-Assistant-Setup.exe.");
