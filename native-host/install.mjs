#!/usr/bin/env node
/**
 * Register the Chrome native messaging host for CINEM Pro.
 *
 * Usage:
 *   node native-host/install.mjs --extension-id=<id from chrome://extensions>
 *
 * Unpacked extensions get a stable id after first load; paste it here so
 * Chrome will allow connectNative("com.cinem.pro.agent").
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST_NAME = "com.cinem.pro.agent";
const here = path.dirname(fileURLToPath(import.meta.url));
const hostPath = path.join(here, "host.mjs");
const wrapperPath = path.join(here, "host-wrapper.sh");

const extId = (process.argv.find((arg) => arg.startsWith("--extension-id=")) || "")
  .slice("--extension-id=".length)
  .trim();

if (!extId) {
  console.error("Pass --extension-id= from chrome://extensions (Developer mode → CINEM Pro id).");
  process.exit(1);
}

const wrapper = `#!/bin/sh
exec node "${hostPath}"
`;
fs.writeFileSync(wrapperPath, wrapper, { mode: 0o755 });

const manifest = {
  name: HOST_NAME,
  description: "CINEM Pro local agent",
  path: wrapperPath,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extId}/`],
};

const home = os.homedir();
const dirs = {
  darwin: [
    path.join(home, "Library/Application Support/Google/Chrome/NativeMessagingHosts"),
    path.join(home, "Library/Application Support/Chromium/NativeMessagingHosts"),
  ],
  linux: [
    path.join(home, ".config/google-chrome/NativeMessagingHosts"),
    path.join(home, ".config/chromium/NativeMessagingHosts"),
  ],
  win32: [path.join(home, "AppData/Local/Google/Chrome/User Data/NativeMessagingHosts")],
};

const targets = dirs[process.platform] || dirs.linux;
for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${HOST_NAME}.json`);
  fs.writeFileSync(dest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("wrote", dest);
}

console.log("Native host registered. Restart Chrome, then pair from the extension popup.");
console.log("Optional always-on agent: node native-host/host.mjs --http");
