/**
 * Catch-all API matcher: every public /api URL still resolves, and
 * /agents/launch wins over /agents/:agentId.
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
  ["api", "downloads", "extension"],
  ["api", "downloads", "cinem-ai-assistant"],
  ["api", "cinem-ai-assistant", "usage"],
  ["api", "guest", "chat"],
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
  ["api", "auth", "connect", "approve"],
  ["api", "auth", "connect", "claim"],
  ["api", "auth", "connect"],
  ["api", "auth", "google", "callback"],
  ["api", "auth", "google"],
  ["api", "oauth", "callback"],
  ["api", "composio", "callback"],
  ["api", "billing", "checkout"],
  ["api", "billing", "support"],
  ["api", "webhooks", "whop"],
  ["api", "cron", "jobs"],
  ["api", "device", "claim"],
  ["api", "device", "heartbeat"],
  ["api", "device", "commands", ":commandId"],
  ["api", "device", "commands"],
  ["api", "device", "session"],
  ["api", "device", "jobs", ":jobId", "reply"],
  ["api", "device", "jobs"],
  ["api", "invites", ":token"],
  ["api", "workspaces"],
  ["api", "workspaces", ":workspaceId", "invites", ":inviteId"],
  ["api", "workspaces", ":workspaceId", "invites"],
  ["api", "workspaces", ":workspaceId", "members", ":memberId"],
  ["api", "workspaces", ":workspaceId", "audit", "export"],
  ["api", "workspaces", ":workspaceId", "clients"],
  ["api", "workspaces", ":workspaceId", "usage"],
  ["api", "workspaces", ":workspaceId", "devices", ":deviceId"],
  ["api", "workspaces", ":workspaceId", "devices"],
  ["api", "workspaces", ":workspaceId", "approvals"],
  ["api", "workspaces", ":workspaceId", "audit"],
  ["api", "workspaces", ":workspaceId", "phase2"],
  ["api", "workspaces", ":workspaceId", "routines"],
  ["api", "workspaces", ":workspaceId", "triggers", "fire"],
  ["api", "workspaces", ":workspaceId", "triggers"],
  ["api", "workspaces", ":workspaceId", "schedules", ":scheduleId"],
  ["api", "workspaces", ":workspaceId", "schedules"],
  ["api", "workspaces", ":workspaceId", "api-keys", ":keyId"],
  ["api", "workspaces", ":workspaceId", "api-keys"],
  ["api", "workspaces", ":workspaceId", "artifacts", ":artifactId"],
  ["api", "workspaces", ":workspaceId", "artifacts"],
  ["api", "workspaces", ":workspaceId", "plugins", ":pluginId", "oauth", "start"],
  ["api", "workspaces", ":workspaceId", "plugins", ":pluginId", "connect"],
  ["api", "workspaces", ":workspaceId", "plugins"],
  ["api", "workspaces", ":workspaceId", "calendar"],
  ["api", "workspaces", ":workspaceId", "skills", ":skillId", "run"],
  ["api", "workspaces", ":workspaceId", "skills"],
  ["api", "workspaces", ":workspaceId", "agents", "launch"],
  ["api", "workspaces", ":workspaceId", "agents", ":agentId"],
  ["api", "workspaces", ":workspaceId", "agents"],
  ["api", "workspaces", ":workspaceId", "tasks", ":taskId"],
  ["api", "workspaces", ":workspaceId", "tasks"],
  ["api", "workspaces", ":workspaceId", "jobs", ":jobId", "reply"],
  ["api", "workspaces", ":workspaceId", "jobs", ":jobId", "replay"],
  ["api", "workspaces", ":workspaceId", "jobs", ":jobId"],
  ["api", "workspaces", ":workspaceId", "jobs"],
  ["api", "workspaces", ":workspaceId", "companions"],
  ["api", "workspaces", ":workspaceId", "chat"],
  ["api", "workspaces", ":workspaceId", "brand-kit"],
  ["api", "workspaces", ":workspaceId", "memory", ":memoryId"],
  ["api", "workspaces", ":workspaceId", "memory"],
  ["api", "workspaces", ":workspaceId", "marketplace", "playbooks"],
  ["api", "workspaces", ":workspaceId", "composio", "probe"],
  ["api", "workspaces", ":workspaceId", "marketplace", "bots"],
  ["api", "workspaces", ":workspaceId", "marketplace"],
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
  ["/api/downloads/extension", ["api", "downloads", "extension"], {}],
  ["/api/downloads/cinem-ai-assistant", ["api", "downloads", "cinem-ai-assistant"], {}],
  ["/api/cinem-ai-assistant/usage", ["api", "cinem-ai-assistant", "usage"], {}],
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
  ["/api/auth/connect", ["api", "auth", "connect"], {}],
  ["/api/auth/connect/approve", ["api", "auth", "connect", "approve"], {}],
  ["/api/auth/connect/claim", ["api", "auth", "connect", "claim"], {}],
  ["/api/auth/google", ["api", "auth", "google"], {}],
  ["/api/auth/google/callback", ["api", "auth", "google", "callback"], {}],
  ["/api/oauth/callback", ["api", "oauth", "callback"], {}],
  ["/api/composio/callback", ["api", "composio", "callback"], {}],
  ["/api/billing/checkout", ["api", "billing", "checkout"], {}],
  ["/api/billing/support", ["api", "billing", "support"], {}],
  ["/api/webhooks/whop", ["api", "webhooks", "whop"], {}],
  ["/api/cron/jobs", ["api", "cron", "jobs"], {}],
  ["/api/device/claim", ["api", "device", "claim"], {}],
  ["/api/device/heartbeat", ["api", "device", "heartbeat"], {}],
  ["/api/device/commands", ["api", "device", "commands"], {}],
  [
    "/api/device/commands/cmd_1",
    ["api", "device", "commands", ":commandId"],
    { commandId: "cmd_1" },
  ],
  ["/api/device/session", ["api", "device", "session"], {}],
  ["/api/device/jobs", ["api", "device", "jobs"], {}],
  [
    "/api/device/jobs/job_9/reply",
    ["api", "device", "jobs", ":jobId", "reply"],
    { jobId: "job_9" },
  ],
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
    "/api/workspaces/ws_1/audit/export",
    ["api", "workspaces", ":workspaceId", "audit", "export"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/clients",
    ["api", "workspaces", ":workspaceId", "clients"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/usage",
    ["api", "workspaces", ":workspaceId", "usage"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/devices",
    ["api", "workspaces", ":workspaceId", "devices"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/devices/dev_1",
    ["api", "workspaces", ":workspaceId", "devices", ":deviceId"],
    { workspaceId: "ws_1", deviceId: "dev_1" },
  ],
  [
    "/api/workspaces/ws_1/approvals",
    ["api", "workspaces", ":workspaceId", "approvals"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/audit",
    ["api", "workspaces", ":workspaceId", "audit"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/phase2",
    ["api", "workspaces", ":workspaceId", "phase2"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/routines",
    ["api", "workspaces", ":workspaceId", "routines"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/triggers/fire",
    ["api", "workspaces", ":workspaceId", "triggers", "fire"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/triggers",
    ["api", "workspaces", ":workspaceId", "triggers"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/schedules",
    ["api", "workspaces", ":workspaceId", "schedules"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/schedules/sch_1",
    ["api", "workspaces", ":workspaceId", "schedules", ":scheduleId"],
    { workspaceId: "ws_1", scheduleId: "sch_1" },
  ],
  [
    "/api/workspaces/ws_1",
    ["api", "workspaces", ":workspaceId"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/jobs",
    ["api", "workspaces", ":workspaceId", "jobs"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/jobs/job_9/reply",
    ["api", "workspaces", ":workspaceId", "jobs", ":jobId", "reply"],
    { workspaceId: "ws_1", jobId: "job_9" },
  ],
  [
    "/api/workspaces/ws_1/jobs/job_9/replay",
    ["api", "workspaces", ":workspaceId", "jobs", ":jobId", "replay"],
    { workspaceId: "ws_1", jobId: "job_9" },
  ],
  [
    "/api/workspaces/ws_1/jobs/job_9",
    ["api", "workspaces", ":workspaceId", "jobs", ":jobId"],
    { workspaceId: "ws_1", jobId: "job_9" },
  ],
  [
    "/api/workspaces/ws_1/agents/launch",
    ["api", "workspaces", ":workspaceId", "agents", "launch"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/agents/ag_2",
    ["api", "workspaces", ":workspaceId", "agents", ":agentId"],
    { workspaceId: "ws_1", agentId: "ag_2" },
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
    "/api/workspaces/ws_1/plugins/gmail/oauth/start",
    ["api", "workspaces", ":workspaceId", "plugins", ":pluginId", "oauth", "start"],
    { workspaceId: "ws_1", pluginId: "gmail" },
  ],
  [
    "/api/workspaces/ws_1/plugins/tavily/connect",
    ["api", "workspaces", ":workspaceId", "plugins", ":pluginId", "connect"],
    { workspaceId: "ws_1", pluginId: "tavily" },
  ],
  [
    "/api/workspaces/ws_1/skills/sk_1/run",
    ["api", "workspaces", ":workspaceId", "skills", ":skillId", "run"],
    { workspaceId: "ws_1", skillId: "sk_1" },
  ],
  [
    "/api/workspaces/ws_1/marketplace/bots",
    ["api", "workspaces", ":workspaceId", "marketplace", "bots"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/artifacts/art_1",
    ["api", "workspaces", ":workspaceId", "artifacts", ":artifactId"],
    { workspaceId: "ws_1", artifactId: "art_1" },
  ],
  [
    "/api/workspaces/ws_1/companions",
    ["api", "workspaces", ":workspaceId", "companions"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/chat",
    ["api", "workspaces", ":workspaceId", "chat"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/brand-kit",
    ["api", "workspaces", ":workspaceId", "brand-kit"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/memory",
    ["api", "workspaces", ":workspaceId", "memory"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/memory/mem_1",
    ["api", "workspaces", ":workspaceId", "memory", ":memoryId"],
    { workspaceId: "ws_1", memoryId: "mem_1" },
  ],
  [
    "/api/workspaces/ws_1/marketplace/playbooks",
    ["api", "workspaces", ":workspaceId", "marketplace", "playbooks"],
    { workspaceId: "ws_1" },
  ],
  [
    "/api/workspaces/ws_1/composio/probe",
    ["api", "workspaces", ":workspaceId", "composio", "probe"],
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

assert.equal(PATTERNS.length, 91);
console.log("ok: 91 handlers share one catch-all (Hobby function budget)");

assert.equal(matchPath("/api/unknown"), null);
assert.equal(matchPath("/api/workspaces/ws_1/nope"), null);
assert.equal(matchPath("/api/v1/nope"), null);
console.log("ok: unknown API paths 404");

const encoded = matchPath("/api/workspaces/ws%2Fslash/agents/ag%201");
assert.equal(encoded?.params.workspaceId, "ws/slash");
assert.equal(encoded?.params.agentId, "ag 1");
console.log("ok: path params decode");
