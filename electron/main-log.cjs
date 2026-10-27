/**
 * Plain-file diagnostic log for the desktop shell main process.
 * Best-effort only — a logging failure must never crash the app or
 * change startup behavior. Never write secrets, tokens, or user data.
 */
const fs = require("node:fs");
const path = require("node:path");

const MAX_LOG_BYTES = 1 * 1024 * 1024; // 1 MB, then rotate to main.log.old

let cachedLogFilePath = null;

function getLogFilePath(app) {
  if (cachedLogFilePath) return cachedLogFilePath;
  try {
    const dir = app.getPath("logs");
    fs.mkdirSync(dir, { recursive: true });
    cachedLogFilePath = path.join(dir, "main.log");
  } catch {
    cachedLogFilePath = path.join(require("node:os").tmpdir(), "cinem-pro-main.log");
  }
  return cachedLogFilePath;
}

function rotateIfNeeded(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_LOG_BYTES) {
      const rotated = `${filePath}.old`;
      fs.rmSync(rotated, { force: true });
      fs.renameSync(filePath, rotated);
    }
  } catch {
    /* no existing file yet — nothing to rotate */
  }
}

function appendLine(app, line) {
  try {
    const filePath = getLogFilePath(app);
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* logging is best-effort only */
  }
}

function logInfo(app, message) {
  appendLine(app, `[info] ${message}`);
}

function logError(app, context, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  appendLine(app, `[error] ${context}: ${message}`);
}

module.exports = { getLogFilePath, logInfo, logError };
