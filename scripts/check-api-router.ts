/**
 * Catch-all API matcher: every public /api URL still resolves, and
 * literal segments win over params (e.g. /support/presence over
 * /support/:threadId). Retired desk-era routes must 404.
 */
import assert from "node:assert/strict";
import { matchBestPattern, pathToSegments } from "../src/server/api/match";

const PATTERNS: string[][] = [
  ["api", "admin"],
  ["api", "admin", "backup"],
  ["api", "admin", "support"],
  ["api", "admin", "support", ":threadId"],
  ["api", "support"],
  ["api", "support", "presence"],
  ["api", "support", ":threadId"],
  ["api", "guest", "chat"],
  ["api", "chat", "models"],
  ["api", "chat", "conversations"],
  ["api", "chat", "conversations", ":conversationId"],
  ["api", "chat", "stream"],
  ["api", "crash-reports"],
  ["api", "funnel"],
  ["api", "purchase-requests"],
  ["api", "image", "generate"],
  ["api", "founding", "spots"],
  ["api", "user", "byok"],
  ["api", "user", "invite"],
  ["api", "v1"],
  ["api", "v1", "workspace"],
  ["api", "v1", "agents", ":agentId"],
  ["api", "v1", "agents"],
  ["api", "v1", "jobs", ":jobId"],
  ["api", "v1", "jobs"],
  ["api", "v1", "artifacts", ":artifactId"],
  ["api", "v1", "artifacts"],
  ["api", "auth", "login"],
  ["api", "auth", "signup"],
  ["api", "auth", "me"],
  ["api", "auth", "logout"],
  ["api", "auth", "token"],
  ["api", "auth", "refresh"],
  ["api", "auth", "revoke"],
  ["api", "auth", "google", "callback"],
  ["api", "auth", "google"],
  ["api", "billing", "checkout"],
  ["api", "billing", "support"],
  ["api", "webhooks", "whop"],
  ["api", "webhooks", "geminigen-image"],
  ["api", "invites", ":token"],
  ["api", "workspaces"],
  ["api", "workspaces", ":workspaceId", "invites", ":inviteId"],
  ["api", "workspaces", ":workspaceId", "invites"],
  ["api", "workspaces", ":workspaceId", "members", ":memberId"],
  ["api", "workspaces", ":workspaceId", "usage"],
  ["api", "workspaces", ":workspaceId", "api-keys", ":keyId"],
  ["api", "workspaces", ":workspaceId", "api-keys"],
  ["api", "workspaces", ":workspaceId"],
];

function matchPath(pathname: string) {
  return matchBestPattern(PATTERNS, pathToSegments(pathname));
}

const cases: Array<[string, string[], Record<string, string>]> = [
  ["/api/admin", ["api", "admin"], {}],
  ["/api/admin/backup", ["api", "admin", "backup"], {}],
  ["/api/admin/support", ["api", "admin", "support"], {}],
  [
    "/api/admin/support/th_1",
    ["api", "admin", "support", ":threadId"],
    { threadId: "th_1" },
  ],
  ["/api/support", ["api", "support"], {}],
  ["/api/support/presence", ["api", "support", "presence"], {}],
  [
    "/api/support/th_1",
    ["api", "support", ":threadId"],
    { threadId: "th_1" },
  ],
  ["/api/guest/chat", ["api", "guest", "chat"], {}],
  ["/api/chat/models", ["api", "chat", "models"], {}],
  ["/api/chat/conversations", ["api", "chat", "conversations"], {}],
  [
    "/api/chat/conversations/conv_1",
    ["api", "chat", "conversations", ":conversationId"],
    { conversationId: "conv_1" },
  ],
  ["/api/chat/stream", ["api", "chat", "stream"], {}],
  ["/api/image/generate", ["api", "image", "generate"], {}],
  ["/api/v1", ["api", "v1"], {}],
  ["/api/v1/workspace", ["api", "v1", "workspace"], {}],
  ["/api/v1/agents", ["api", "v1", "agents"], {}],
  [
    "/api/v1/agents/ag_2",
    ["api", "v1", "agents", ":agentId"],
    { agentId: "ag_2" },
  ],
  ["/api/v1/jobs", ["api", "v1", "jobs"], {}],
  [
    "/api/v1/jobs/job_9",
    ["api", "v1", "jobs", ":jobId"],
    { jobId: "job_9" },
  ],
  ["/api/v1/artifacts", ["api", "v1", "artifacts"], {}],
  [
    "/api/v1/artifacts/art_1",
    ["api", "v1", "artifacts", ":artifactId"],
    { artifactId: "art_1" },
  ],
  ["/api/auth/login", ["api", "auth", "login"], {}],
  ["/api/auth/signup", ["api", "auth", "signup"], {}],
  ["/api/auth/me", ["api", "auth", "me"], {}],
  ["/api/auth/logout", ["api", "auth", "logout"], {}],
  ["/api/auth/token", ["api", "auth", "token"], {}],
  ["/api/auth/refresh", ["api", "auth", "refresh"], {}],
  ["/api/auth/revoke", ["api", "auth", "revoke"], {}],
  ["/api/auth/google", ["api", "auth", "google"], {}],
  ["/api/auth/google/callback", ["api", "auth", "google", "callback"], {}],
  ["/api/billing/checkout", ["api", "billing", "checkout"], {}],
  ["/api/billing/support", ["api", "billing", "support"], {}],
  ["/api/webhooks/whop", ["api", "webhooks", "whop"], {}],
  ["/api/webhooks/geminigen-image", ["api", "webhooks", "geminigen-image"], {}],
  [
    "/api/invites/tok_1",
    ["api", "invites", ":token"],
    { token: "tok_1" },
  ],
  ["/api/workspaces", ["api", "workspaces"], {}],
  [
    "/api/workspaces/ws_1/invites",
    ["api", "workspaces", ":workspaceId", "invites"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/invites/inv_1",
    ["api", "workspaces", ":workspaceId", "invites", ":inviteId"],
    { workspaceId: "ws_1", inviteId: "inv_1" },
  ],
  [
    "/api/workspaces/ws_1/members/mem_1",
    ["api", "workspaces", ":workspaceId", "members", ":memberId"],
    { workspaceId: "ws_1", memberId: "mem_1" },
  ],
  [
    "/api/workspaces/ws_1/usage",
    ["api", "workspaces", ":workspaceId", "usage"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/api-keys",
    ["api", "workspaces", ":workspaceId", "api-keys"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/api-keys/key_1",
    ["api", "workspaces", ":workspaceId", "api-keys", ":keyId"],
    { workspaceId: "ws_1", keyId: "key_1" },
  ],
  [
    "/api/workspaces/ws_1",
    ["api", "workspaces", ":workspaceId"],
    { workspaceId: "ws_1" },
  ],
];

for (const [pathname, pattern, params] of cases) {
  const hit = matchPath(pathname);
  assert.ok(hit, `expected match for ${pathname}`);
  assert.deepEqual(hit.pattern, pattern);
  assert.deepEqual(hit.params, params);
}
console.log(`ok: ${cases.length} public API URLs still match`);

assert.equal(PATTERNS.length, 49);
console.log("ok: 49 handlers share one catch-all (Hobby function budget)");

assert.equal(matchPath("/api/unknown"), null);
assert.equal(matchPath("/api/workspaces/ws_1/nope"), null);
assert.equal(matchPath("/api/v1/nope"), null);
// Retired desk-era routes stay dead.
assert.equal(matchPath("/api/workspaces/ws_1/jobs"), null);
assert.equal(matchPath("/api/workspaces/ws_1/agents"), null);
assert.equal(matchPath("/api/workspaces/ws_1/marketplace"), null);
assert.equal(matchPath("/api/workspaces/ws_1/chat"), null);
assert.equal(matchPath("/api/device/claim"), null);
assert.equal(matchPath("/api/companion/pair"), null);
assert.equal(matchPath("/api/cron/jobs"), null);
assert.equal(matchPath("/api/auth/connect"), null);
assert.equal(matchPath("/api/downloads/extension"), null);
console.log("ok: unknown and retired API paths 404");

const encoded = matchPath("/api/v1/agents/ag%201");
assert.equal(encoded?.params.agentId, "ag 1");
console.log("ok: path params decode");
