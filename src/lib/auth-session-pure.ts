/**
 * Pure helpers for the session-version (`sv`) JWT claim. No imports — safe
 * for check scripts and any runtime.
 *
 * Session tokens are stateless 30-day JWTs. Each token carries the user's
 * `sessionVersion` at issue time; verification compares it against the
 * current value on the user row. Bumping the version (password change,
 * sign-out-everywhere) therefore kills every outstanding token.
 *
 * Tokens issued before versioning existed have no `sv` claim. They read
 * as version 0, which matches the column default — so existing sessions
 * survive the rollout and die at the user's first bump, not at deploy.
 */

export const SESSION_VERSION_CLAIM = "sv";

/** Extract a valid session version from a decoded JWT payload. */
export function sessionVersionFromPayload(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const raw = (payload as Record<string, unknown>)[SESSION_VERSION_CLAIM];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  const version = Math.floor(raw);
  return version > 0 ? version : 0;
}

/** Normalize a stored user-row value (column default 0, never negative). */
export function normalizeSessionVersion(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  const version = Math.floor(raw);
  return version > 0 ? version : 0;
}

/** A token is current only when its claim equals the user row's version. */
export function sessionVersionMatches(
  tokenVersion: number,
  userVersion: number,
): boolean {
  return normalizeSessionVersion(tokenVersion) === normalizeSessionVersion(userVersion);
}
