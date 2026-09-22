/**
 * Crash-loop detection + safe mode for the desktop shell. Local state only
 * (userData/safe-mode-state.json) — never touches server/workspace data.
 * Best-effort like main-log.cjs: a failure here must never crash the app.
 */
const fs = require("node:fs");
const path = require("node:path");

const CRASH_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const CRASH_LOOP_THRESHOLD = 3; // 3 crashes inside the window = safe mode
const STABLE_AFTER_MS = 15 * 1000; // window survives 15s → clears crash count

function statePath(app) {
  try {
    return path.join(app.getPath("userData"), "safe-mode-state.json");
  } catch {
    return path.join(require("node:os").tmpdir(), "cinem-pro-safe-mode-state.json");
  }
}

function readState(app) {
  try {
    const raw = fs.readFileSync(statePath(app), "utf8");
    const parsed = JSON.parse(raw);
    return { crashes: Array.isArray(parsed.crashes) ? parsed.crashes : [] };
  } catch {
    return { crashes: [] };
  }
}

function writeState(app, state) {
  try {
    fs.mkdirSync(path.dirname(statePath(app)), { recursive: true });
    fs.writeFileSync(statePath(app), JSON.stringify(state));
  } catch {
    /* best-effort only */
  }
}

/** Call once at launch, before creating windows. True = enter safe mode. */
function shouldEnterSafeMode(app) {
  const state = readState(app);
  const now = Date.now();
  const recent = state.crashes.filter((ts) => now - ts < CRASH_WINDOW_MS);
  return recent.length >= CRASH_LOOP_THRESHOLD;
}

/** Call from a renderer crash handler (render-process-gone, non-clean-exit). */
function recordCrash(app, reason) {
  const state = readState(app);
  const now = Date.now();
  const recent = state.crashes.filter((ts) => now - ts < CRASH_WINDOW_MS);
  recent.push(now);
  writeState(app, { crashes: recent });
  return { reason, count: recent.length };
}

/** Call once a window has stayed up for STABLE_AFTER_MS — clears the counter. */
function scheduleStabilityMark(app) {
  setTimeout(() => {
    writeState(app, { crashes: [] });
  }, STABLE_AFTER_MS).unref?.();
}

/**
 * Repair: clears local caches/storage only (Electron session data,
 * safe-mode state itself). Never touches server-side workspace/Brand Kit
 * data — that lives on the desk backend, not on this machine.
 */
async function repair(app, session) {
  try {
    if (session?.defaultSession) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData();
    }
  } catch {
    /* best-effort */
  }
  writeState(app, { crashes: [] });
}

module.exports = { shouldEnterSafeMode, recordCrash, scheduleStabilityMark, repair, statePath };
