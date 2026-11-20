/**
 * Chunk-load recovery — client-safe helpers (no server imports).
 *
 * After a new deployment, a tab or installed PWA still running the previous
 * build can fail to load JS chunks that no longer exist on the server
 * (ChunkLoadError / "Failed to fetch dynamically imported module"). The only
 * reliable recovery is a full page reload, which fetches fresh HTML and the
 * current build's chunks. These helpers detect that failure class and
 * perform the reload at most a few times per tab session, so a genuinely
 * broken deploy still ends on the error screen instead of a reload loop.
 */

const RELOAD_KEY = "cinem-pro-chunk-reload";
const MIN_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;

const CHUNK_ERROR_PATTERN =
  /chunkloaderror|loading chunk [\d]+ failed|failed to fetch dynamically imported module|importing a module script failed|failed to load chunk/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return CHUNK_ERROR_PATTERN.test(name) || CHUNK_ERROR_PATTERN.test(message);
}

/**
 * Reload the page once to recover from a stale-build chunk failure.
 * Returns true when a reload was triggered. Guarded by sessionStorage so
 * repeated failures within a session stop after MAX_ATTEMPTS tries (and
 * never more often than MIN_INTERVAL_MS apart); the error screen with its
 * manual Reload button remains the backstop.
 */
export function recoverFromChunkErrorOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const now = Date.now();
    let count = 0;
    let last = 0;
    try {
      const raw = window.sessionStorage.getItem(RELOAD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { count?: number; last?: number };
        count = typeof parsed.count === "number" ? parsed.count : 0;
        last = typeof parsed.last === "number" ? parsed.last : 0;
      }
    } catch {
      // Storage unavailable (private mode etc.) — fall through and reload;
      // the attempt counters just won't persist.
    }
    if (count >= MAX_ATTEMPTS || now - last < MIN_INTERVAL_MS) return false;
    try {
      window.sessionStorage.setItem(
        RELOAD_KEY,
        JSON.stringify({ count: count + 1, last: now }),
      );
    } catch {
      // Non-fatal: reload anyway.
    }
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
