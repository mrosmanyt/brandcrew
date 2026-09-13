/**
 * Unified desktop modes: cloud desk + Cinem AI Assistant.
 * Keep this file free of `electron` so Node tests can require it.
 */
const path = require("node:path");

const MODES = ["desk", "assistant"];
const DEFAULT_MODE = "desk";
const CHROME_HEIGHT = 44;
const ASSISTANT_DEV_PORT = 1420;
const ASSISTANT_PING = "CINEM Pro core online";
const SHELL_NAME = "cinem-pro";

function normalizeMode(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "assistant" || value === "ai" || value === "cinem-ai-assistant") {
    return "assistant";
  }
  if (value === "both") return "both";
  if (value === "desk" || value === "pro" || value === "cloud") return "desk";
  return DEFAULT_MODE;
}

function parseStartMode(argv = [], env = process.env) {
  const eq = argv.find((arg) => typeof arg === "string" && arg.startsWith("--mode="));
  if (eq) return normalizeMode(eq.slice("--mode=".length));
  const idx = argv.findIndex((arg) => arg === "--mode");
  if (idx >= 0) return normalizeMode(argv[idx + 1]);
  if (env.CINEM_START_MODE) return normalizeMode(env.CINEM_START_MODE);
  if (env.CINEM_DESKTOP_MODE) return normalizeMode(env.CINEM_DESKTOP_MODE);
  return DEFAULT_MODE;
}

function modeFromProtocolUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    const host = (url.hostname || url.host || "").toLowerCase();
    const pathAction = url.pathname.replace(/^\//, "").split("/")[0].toLowerCase();
    const action = host || pathAction;
    if (action === "assistant" || action === "ai") return "assistant";
    if (action === "both") return "both";
    if (action === "desk") return "desk";
    if (action === "open") {
      const mode = url.searchParams.get("mode");
      if (mode) return normalizeMode(mode);
      const pathName = url.searchParams.get("path") || "";
      if (String(pathName).includes("assistant")) return "assistant";
      return "desk";
    }
    if (action === "connect") return null;
    return null;
  } catch {
    return null;
  }
}

function assistantDevOrigin(env = process.env) {
  return String(env.CINEM_ASSISTANT_DEV_URL || `http://127.0.0.1:${ASSISTANT_DEV_PORT}`).replace(
    /\/$/,
    "",
  );
}

function assistantIndexPath({ packaged, resourcesPath, projectRoot }) {
  if (packaged) return path.join(resourcesPath, "assistant", "index.html");
  return path.join(projectRoot, "apps", "cinem-ai-assistant", "dist", "index.html");
}

function isHttpUrl(raw) {
  try {
    const parsed = new URL(String(raw || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function verifyShellNonce(nonce) {
  const value = String(nonce || "");
  return value.length >= 8 && value.length <= 200 && !/[\r\n]/.test(value);
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  CHROME_HEIGHT,
  ASSISTANT_DEV_PORT,
  ASSISTANT_PING,
  SHELL_NAME,
  normalizeMode,
  parseStartMode,
  modeFromProtocolUrl,
  assistantDevOrigin,
  assistantIndexPath,
  isHttpUrl,
  verifyShellNonce,
};
