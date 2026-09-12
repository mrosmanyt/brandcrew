#!/usr/bin/env node
/**
 * Open the Electron window against the production desk (no local Next/Postgres).
 * Usage: npm run desktop:cloud
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronBin = process.platform === "win32" ? "electron.cmd" : "electron";

function run(cmd, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code) reject(new Error(`${cmd} exited ${code}`));
      else resolve();
    });
  });
}

await run(process.execPath, [path.join(root, "scripts/make-icon.mjs")]);
await run(electronBin, ["electron/main.cjs"], { CINEM_DESK_MODE: "cloud" });
