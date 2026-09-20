/**
 * API error-handling safety net: DB failures return the app's clean
 * jsonError() JSON envelope (500, application/json), never a bare
 * framework crash. See src/server/api/founding/spots.ts,
 * src/server/api/auth/me.ts, src/server/api/router.ts (dispatchApi),
 * src/components/desk/trust-center.tsx.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Point at an unreachable Postgres before anything imports @/lib/db, so the
// real Prisma client fails fast with a connection error (no mocking).
process.env.DATABASE_URL = "postgresql://check:check@127.0.0.1:5999/check?schema=public";
process.env.DIRECT_URL = process.env.DATABASE_URL;

const root = process.cwd();

async function checkFoundingSpotsHandlesDbFailure() {
  const { GET } = await import("../src/server/api/founding/spots");
  const response = await GET();
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  const body = (await response.json()) as { error?: string; code?: string };
  assert.equal(body.code, "internal_error");
  assert.equal(typeof body.error, "string");
  // Never leak the raw Prisma/connection string message to the client.
  assert.doesNotMatch(body.error || "", /prisma|ECONNREFUSED|postgres:\/\//i);
}

const spots = readFileSync(join(root, "src/server/api/founding/spots.ts"), "utf8");
assert.match(spots, /try \{/);
assert.match(spots, /\} catch \(error\) \{\s*return jsonError\(error\);/);
console.log("ok: founding/spots.ts GET is wrapped in try/catch -> jsonError");

// auth/me.ts GET uses next/headers (cookies()), which throws outside a real
// Next.js request scope — cannot invoke it directly from a bare script, so
// this is a source-contract check instead of a live call.
const me = readFileSync(join(root, "src/server/api/auth/me.ts"), "utf8");
assert.match(me, /export async function GET\(\) \{\s*try \{/);
assert.match(
  me,
  /if \(!user\) \{\s*return withNativeCors\(jsonOk\(\{ user: null, workspaces: \[\], googleLogin \}\)\);\s*\}/,
);
assert.match(me, /\} catch \(error\) \{\s*return jsonError\(error\);\s*\}\s*\}/);
console.log("ok: auth/me.ts GET wraps its DB calls in try/catch and keeps the no-session early return");

const router = readFileSync(join(root, "src/server/api/router.ts"), "utf8");
assert.match(
  router,
  /try \{\s*response = await handler\(request, \{ params: Promise\.resolve\(matched\.params\) \}\);\s*\} catch \(error\) \{\s*return jsonError\(error\);\s*\}/,
);
console.log("ok: dispatchApi() catches handler() throws and returns jsonError");

const trustCenter = readFileSync(
  join(root, "src/components/desk/trust-center.tsx"),
  "utf8",
);
assert.match(trustCenter, /try \{[\s\S]*\} finally \{\s*setExporting\(false\);\s*\}/);
console.log("ok: TrustCenter.exportAudit() always resets exporting via finally");

async function run() {
  await checkFoundingSpotsHandlesDbFailure();
  console.log("ok: GET /api/founding/spots returns clean jsonError JSON on a real DB failure");
}

run().then(() => console.log("API error-handling checks passed."));
