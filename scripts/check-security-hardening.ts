/**
 * Security hardening — Postgres rate limiting, session versioning,
 * CSP tightening. Pure logic + source wiring only (no database): the
 * DB-backed paths are exercised on the Vercel preview.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { applyWindowHit } from "../src/lib/rate-limit-pure";
import {
  normalizeSessionVersion,
  sessionVersionFromPayload,
  sessionVersionMatches,
} from "../src/lib/auth-session-pure";
import {
  applyReportOnlyCsp,
  generateCspNonce,
  securityHeaderList,
  strictCspReportOnlyValue,
} from "../src/lib/security-headers";

// --- Fixed-window math (shared by in-memory + Postgres limiters) ---
const t0 = 1_700_000_000_000;
const first = applyWindowHit(t0, null, 3, 60_000);
assert.equal(first.ok, true);
assert.deepEqual(first.row, { count: 1, resetAt: t0 + 60_000 });

const second = applyWindowHit(t0 + 1_000, first.row, 3, 60_000);
assert.equal(second.ok, true);
assert.deepEqual(second.row, { count: 2, resetAt: t0 + 60_000 });

const third = applyWindowHit(t0 + 2_000, second.row, 3, 60_000);
assert.equal(third.ok, true);
assert.equal(third.row.count, 3);

const refused = applyWindowHit(t0 + 3_000, third.row, 3, 60_000);
assert.equal(refused.ok, false);
if (!refused.ok) {
  assert.equal(refused.retryAfterSec, 57);
  // A refused hit must not move or grow the stored window.
  assert.deepEqual(refused.row, { count: 3, resetAt: t0 + 60_000 });
}

// Boundary: exactly at resetAt a fresh window starts.
const fresh = applyWindowHit(t0 + 60_000, third.row, 3, 60_000);
assert.equal(fresh.ok, true);
assert.deepEqual(fresh.row, { count: 1, resetAt: t0 + 120_000 });

// The in-memory limiter delegates to this same math (asserted in the
// wiring section below; importing rate-limit.ts here would pull the
// http -> auth -> db chain, which needs a generated Prisma client).
console.log("ok: fixed-window math");

// --- Durable limiter wiring ---
const rateLimitSrc = readFileSync("src/lib/rate-limit.ts", "utf8");
// rate-limit.ts must not statically import the db module: the shared
// limiter is loaded lazily so a missing store degrades to memory.
assert.doesNotMatch(rateLimitSrc, /from "@\/lib\/db"/);
assert.match(rateLimitSrc, /applyWindowHit/);
assert.match(rateLimitSrc, /takeTokenShared/);
assert.match(rateLimitSrc, /rate-limit-db/);
const rateLimitDbSrc = readFileSync("src/lib/rate-limit-db.ts", "utf8");
assert.match(rateLimitDbSrc, /INSERT INTO "RateLimitBucket"/);
assert.match(rateLimitDbSrc, /ON CONFLICT \("key"\) DO UPDATE/);
assert.match(rateLimitDbSrc, /RETURNING "count", "resetAt"/);
const guestChatSrc = readFileSync("src/lib/guest-chat.ts", "utf8");
assert.match(guestChatSrc, /takeTokenShared/);
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /model RateLimitBucket \{/);
assert.ok(
  existsSync(
    "prisma/migrations/20261119120000_rate_limit_buckets/migration.sql",
  ),
);
console.log("ok: Postgres limiter wired with in-memory fallback");

// --- Session version claim ---
assert.equal(sessionVersionFromPayload({}), 0);
assert.equal(sessionVersionFromPayload({ sv: 3 }), 3);
assert.equal(sessionVersionFromPayload({ sv: 0 }), 0);
assert.equal(sessionVersionFromPayload({ sv: -2 }), 0);
assert.equal(sessionVersionFromPayload({ sv: 2.9 }), 2);
assert.equal(sessionVersionFromPayload({ sv: "3" }), 0);
assert.equal(sessionVersionFromPayload(null), 0);
assert.equal(sessionVersionFromPayload("nope"), 0);
assert.equal(normalizeSessionVersion(undefined), 0);
assert.equal(normalizeSessionVersion(7), 7);
assert.equal(sessionVersionMatches(0, 0), true);
assert.equal(sessionVersionMatches(4, 4), true);
assert.equal(sessionVersionMatches(3, 4), false);
// Legacy token (no claim -> 0) dies at the user's first bump.
assert.equal(sessionVersionMatches(0, 1), false);
console.log("ok: session-version claim extraction + matching");

// --- Session versioning wiring ---
assert.match(schema, /sessionVersion\s+Int\s+@default\(0\)/);
assert.ok(
  existsSync(
    "prisma/migrations/20261119123000_user_session_version/migration.sql",
  ),
);
const authSrc = readFileSync("src/lib/auth.ts", "utf8");
assert.match(authSrc, /SESSION_VERSION_CLAIM/);
assert.match(authSrc, /sessionVersionMatches/);
assert.match(authSrc, /invalidateAllSessions/);
assert.match(authSrc, /sessionVersion: \{ increment: 1 \}/);
const meSrc = readFileSync("src/server/api/auth/me.ts", "utf8");
assert.match(meSrc, /data\.sessionVersion = \{ increment: 1 \}/);
assert.match(meSrc, /revokeAllRefreshTokens/);
assert.match(meSrc, /setSessionCookie/);
const revokeSrc = readFileSync("src/server/api/auth/revoke.ts", "utf8");
assert.match(revokeSrc, /invalidateAllSessions/);
console.log("ok: session versioning wired (issue, verify, password change, revoke-all)");

// --- CSP: enforced tightening ---
const enforced =
  securityHeaderList().find((row) => row.key === "Content-Security-Policy")
    ?.value || "";
assert.match(enforced, /script-src-attr 'none'/);
assert.match(enforced, /frame-ancestors 'none'/);
assert.match(enforced, /object-src 'none'/);
assert.match(enforced, /base-uri 'self'/);
// Enforced policy is unchanged where pages depend on it (for now).
assert.match(enforced, /script-src[^;]*'unsafe-inline'/);
console.log("ok: enforced CSP gained script-src-attr 'none', kept the rest");

// --- CSP: strict report-only policy ---
const strict = strictCspReportOnlyValue("TESTNONCE");
const strictScriptSrc =
  strict.split("; ").find((part) => part.startsWith("script-src ")) || "";
assert.match(strictScriptSrc, /'nonce-TESTNONCE'/);
assert.match(strictScriptSrc, /'strict-dynamic'/);
assert.doesNotMatch(strictScriptSrc, /unsafe-inline/);
// ('unsafe-eval' appears only when NODE_ENV !== 'production', mirroring
// the enforced policy's dev allowance for React debugging.)
assert.match(strict, /frame-ancestors 'none'/);
assert.match(strict, /object-src 'none'/);
assert.match(strict, /script-src-attr 'none'/);
// Nonce is per-request: two generated nonces differ and change the policy.
const nonceA = generateCspNonce();
const nonceB = generateCspNonce();
assert.ok(nonceA.length >= 16);
assert.notEqual(nonceA, nonceB);
assert.notEqual(
  strictCspReportOnlyValue(nonceA),
  strictCspReportOnlyValue(nonceB),
);
// Report-only attaches under its own header name, never the enforced one.
const probe = new Headers();
applyReportOnlyCsp(probe, nonceA);
assert.ok(probe.get("Content-Security-Policy-Report-Only")?.includes(nonceA));
assert.equal(probe.get("Content-Security-Policy"), null);
// Proxy wires nonce + report-only into every response path.
const proxySrc = readFileSync("src/proxy.ts", "utf8");
assert.match(proxySrc, /generateCspNonce/);
assert.match(proxySrc, /applyReportOnlyCsp/);
assert.match(proxySrc, /CSP_NONCE_HEADER/);
console.log("ok: strict nonce CSP ships report-only from the proxy");

console.log("check-security-hardening: OK");
