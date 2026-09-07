/**
 * Developer API: hashed keys, catalog, JSON errors. No database required.
 */
import assert from "node:assert/strict";
import {
  generateApiKeySecret,
  hashApiKey,
  hashesMatch,
  readBearerToken,
  serializeApiKey,
} from "../src/lib/api-key-crypto";
import {
  API_KEY_PREFIX,
  API_KEY_PREFIX_LENGTH,
  API_KEY_RATE_LIMIT,
  V1_ENDPOINTS,
} from "../src/lib/api-catalog";
import { DEFAULT_AGENT_NAME } from "../src/lib/constants";
import { ApiAuthError, jsonError } from "../src/lib/http";

const generated = generateApiKeySecret();
assert.ok(generated.token.startsWith(API_KEY_PREFIX));
assert.equal(generated.prefix, generated.token.slice(0, API_KEY_PREFIX_LENGTH));
assert.equal(generated.prefix.length, API_KEY_PREFIX_LENGTH);
assert.equal(generated.keyHash, hashApiKey(generated.token));
assert.equal(hashesMatch(generated.token, generated.keyHash), true);
assert.equal(hashesMatch(`${generated.token}x`, generated.keyHash), false);
assert.equal(generated.token.includes(generated.keyHash), false);
console.log("ok: API key mint + sha256 verify");

const serialized = serializeApiKey({
  id: "k1",
  workspaceId: "w1",
  name: "CI",
  prefix: generated.prefix,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date("2026-09-07T00:00:00.000Z"),
});
assert.equal("keyHash" in serialized, false);
assert.equal("token" in serialized, false);
assert.ok(!JSON.stringify(serialized).includes(generated.token.slice(API_KEY_PREFIX.length)));
assert.ok(!JSON.stringify(serialized).includes(generated.keyHash));
console.log("ok: serialized key never includes the secret");

assert.ok(V1_ENDPOINTS.some((row) => row.path === "/api/v1/agents" && row.method === "POST"));
assert.ok(V1_ENDPOINTS.some((row) => row.path === "/api/v1/jobs" && row.method === "POST"));
assert.ok(V1_ENDPOINTS.some((row) => row.path === "/api/v1/jobs/:jobId" && row.method === "GET"));
assert.ok(V1_ENDPOINTS.some((row) => row.path === "/api/v1/workspace" && row.method === "GET"));
assert.equal(DEFAULT_AGENT_NAME, "New Agent");
assert.equal(API_KEY_RATE_LIMIT, 60);
assert.equal(API_KEY_PREFIX, "cinem_live_");
console.log("ok: catalog + New Agent default");

const providerLeak = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "SESSION_SECRET"];
for (const key of providerLeak) {
  assert.equal(JSON.stringify(serialized).includes(key), false);
}
console.log("ok: no provider key names on API key DTO");

const missing = jsonError(new ApiAuthError("Provide Authorization: Bearer cinem_live_…"));
assert.equal(missing.status, 401);
const missingBody = await missing.json();
assert.equal(missingBody.code, "unauthorized");
assert.ok(typeof missingBody.error === "string");
assert.equal(missing.headers.get("WWW-Authenticate"), "Bearer");
console.log("ok: JSON 401 includes code + WWW-Authenticate");

const req = new Request("http://127.0.0.1:43180/api/v1");
assert.equal(readBearerToken(req), "");
const authed = new Request("http://127.0.0.1:43180/api/v1", {
  headers: { Authorization: `Bearer ${generated.token}` },
});
assert.equal(readBearerToken(authed), generated.token);
console.log("ok: Bearer parsing");

console.log("Developer API checks passed.");
