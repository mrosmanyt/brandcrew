#!/usr/bin/env node
/**
 * Vite-only build of Cinem AI Assistant for the unified Electron shell.
 * Does not compile Rust / Tauri. Safe to run from desktop:build and Next-adjacent CI checks.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "apps", "cinem-ai-assistant");

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(path.join(appDir, "package.json"))) {
  console.error("Missing apps/cinem-ai-assistant/package.json");
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (!existsSync(path.join(appDir, "node_modules"))) {
  console.log("Installing Cinem AI Assistant renderer dependencies…");
  run(npm, ["install"], { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" });
}

const launchEnv = {
  CINEM_ELECTRON_ASSISTANT: "1",
  VITE_CINEM_CLOUD_URL: process.env.VITE_CINEM_CLOUD_URL || "https://app.cinem.tech",
  VITE_CINEM_UPGRADE_URL:
    process.env.VITE_CINEM_UPGRADE_URL ||
    "https://app.cinem.tech/billing?plan=pro&product=cinem-ai-assistant",
  COMPUTER_USE_ENABLED: process.env.COMPUTER_USE_ENABLED || "1",
  MULTILAYER_ORCHESTRATOR_ENABLED: process.env.MULTILAYER_ORCHESTRATOR_ENABLED || "1",
  SOCIAL_CHROME_PLAYBOOKS_ENABLED: process.env.SOCIAL_CHROME_PLAYBOOKS_ENABLED || "1",
  REMOTE_PHONE_CONTROL_ENABLED: process.env.REMOTE_PHONE_CONTROL_ENABLED || "1",
};

console.log("Building Cinem AI Assistant Vite renderer for Electron…");
run(npm, ["exec", "--", "vite", "build"], launchEnv);

const index = path.join(appDir, "dist", "index.html");
if (!existsSync(index)) {
  console.error("Assistant renderer missing dist/index.html");
  process.exit(1);
}
console.log("Assistant renderer ready:", index);
