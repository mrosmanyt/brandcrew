#!/usr/bin/env node
/**
 * Prepare Next standalone output and run electron-builder.
 * Usage: node scripts/desktop-build.mjs [--win] [--mac] [--linux]
 * Default target is the current platform.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function run(cmd, cmdArgs, extraEnv = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function npx(cmdArgs, extraEnv) {
  run(process.platform === "win32" ? "npx.cmd" : "npx", cmdArgs, extraEnv);
}

function materializeSymlinks(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      let target;
      try {
        target = realpathSync(full);
      } catch {
        rmSync(full, { force: true });
        continue;
      }
      rmSync(full, { force: true });
      try {
        cpSync(target, full, { recursive: true });
      } catch {
        /* optional traced deps */
      }
    } else if (entry.isDirectory()) {
      materializeSymlinks(full);
    }
  }
}

/** Keep release-asset names stable for marketing / GitHub latest/download URLs. */
function ensureFriendlyWinNames() {
  const outDir = path.join(root, "dist", "desktop");
  if (!existsSync(outDir)) return;
  const names = readdirSync(outDir);
  const copies = [
    { dest: "CINEM-Pro-Setup.exe", test: (n) => /\.exe$/i.test(n) && /setup|nsis/i.test(n) },
    { dest: "CINEM-Pro-Portable.exe", test: (n) => /\.exe$/i.test(n) && /portable/i.test(n) },
  ];
  for (const { dest, test } of copies) {
    const destPath = path.join(outDir, dest);
    if (existsSync(destPath)) continue;
    const found = names.find((n) => n !== dest && test(n));
    if (found) {
      copyFileSync(path.join(outDir, found), destPath);
      console.log("Copied", found, "→", dest);
    }
  }
  const setupPath = path.join(outDir, "CINEM-Pro-Setup.exe");
  const portablePath = path.join(outDir, "CINEM-Pro-Portable.exe");
  if (!existsSync(setupPath) && existsSync(portablePath)) {
    copyFileSync(portablePath, setupPath);
    console.log("Copied CINEM-Pro-Portable.exe → CINEM-Pro-Setup.exe (NSIS not produced)");
  }
}

console.log("Generating placeholder icon…");
run(process.execPath, [path.join(root, "scripts/make-icon.mjs")]);

console.log("Building Next.js standalone (DESKTOP=1)…");
run(process.execPath, [path.join(root, "scripts/prisma-generate.mjs")]);
npx(["next", "build"], { DESKTOP: "1" });

const standalone = path.join(root, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js — Next standalone output failed.");
  process.exit(1);
}

const publicDir = path.join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, path.join(standalone, "public"), { recursive: true });
}
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});

const playwrightDir = path.join(standalone, "node_modules", "playwright-core");
if (existsSync(playwrightDir)) {
  rmSync(playwrightDir, { recursive: true, force: true });
}
materializeSymlinks(standalone);

const resources = path.join(root, "electron", "resources");
mkdirSync(resources, { recursive: true });
cpSync(path.join(root, ".env.example"), path.join(resources, "env.example"));

const targets = [];
if (args.includes("--win")) targets.push("--win");
if (args.includes("--mac")) targets.push("--mac");
if (args.includes("--linux")) targets.push("--linux");
if (targets.length === 0) {
  if (process.platform === "darwin") targets.push("--mac");
  else if (process.platform === "win32") targets.push("--win");
  else targets.push("--linux");
}

if (targets.includes("--mac") && process.platform !== "darwin") {
  console.warn(
    "Note: macOS .dmg/.zip usually require a macOS runner. electron-builder may fail here; that is expected on Linux.",
  );
}

const builderEnv = {
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};

console.log(`electron-builder ${targets.join(" ")}`);
const builderArgs = ["electron-builder", "--publish", "never", ...targets];
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", builderArgs, {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ...builderEnv },
  shell: process.platform === "win32",
});

if (result.status === 0) {
  ensureFriendlyWinNames();
  process.exit(0);
}

const wineMissing =
  process.platform === "linux" &&
  targets.includes("--win") &&
  !existsSync("/usr/bin/wine") &&
  !existsSync("/usr/bin/wine64");

if (wineMissing) {
  console.warn(
    "NSIS/.exe wrapping on Linux often needs Wine. Retrying Windows portable + unpacked dir only…",
  );
  npx(["electron-builder", "--publish", "never", "--win", "portable"], builderEnv);
  ensureFriendlyWinNames();
  console.warn(
    "Produced win-unpacked / portable .exe. Full NSIS installer needs Wine or a Windows runner.",
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
