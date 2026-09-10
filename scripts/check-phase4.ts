/**
 * Phase 4: workspace RBAC, client-desk admin, GDPR/DPA, SOC 2 readiness
 * (not certified), audit export hashes. No live network.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  canAssignRole,
  capabilitiesFor,
  parseInviteRole,
  parseWorkspaceRole,
  roleCan,
  serializeMembership,
  WORKSPACE_ROLES,
} from "../src/lib/rbac";
import {
  chainHash,
  hashAuditPayload,
  packWorkspaceAuditExport,
  AUDIT_EXPORT_NOTE,
} from "../src/lib/audit-export";
import { DATA_PROCESSING_ROWS, GDPR_SUBPROCESSORS } from "../src/lib/gdpr";
import { SOC2_CERTIFIED, SOC2_STATUS_LABEL, soc2ReadinessSummary } from "../src/lib/soc2";
import { CLIENT_ISOLATION_FACTS, isClientNamedEmail } from "../src/lib/client-workspaces";
import { approvalClass, toolNeedsApproval } from "../src/lib/write-gate";
import { settingsDeskLinks } from "../src/lib/desk-settings";

assert.deepEqual([...WORKSPACE_ROLES], ["owner", "admin", "approver", "member"]);
assert.equal(parseWorkspaceRole("Owner"), "owner");
assert.equal(parseWorkspaceRole("nope"), "member");
assert.equal(parseInviteRole("owner"), "admin");
assert.equal(parseInviteRole("approver"), "approver");
assert.equal(roleCan("member", "approve_sends"), false);
assert.equal(roleCan("approver", "approve_sends"), true);
assert.equal(roleCan("approver", "invite"), false);
assert.equal(roleCan("admin", "billing"), true);
assert.equal(roleCan("admin", "always_approved"), true);
assert.equal(roleCan("member", "always_approved"), false);
assert.ok(capabilitiesFor("owner").includes("audit_export"));
assert.equal(serializeMembership("approver").roleLabel, "Approver");
assert.equal(
  canAssignRole({
    actorRole: "member",
    targetCurrent: "member",
    nextRole: "admin",
    ownerCount: 1,
  }).ok,
  false,
);
assert.equal(
  canAssignRole({
    actorRole: "owner",
    targetCurrent: "owner",
    nextRole: "member",
    ownerCount: 1,
  }).ok,
  false,
);
assert.equal(
  canAssignRole({
    actorRole: "admin",
    targetCurrent: "owner",
    nextRole: "member",
    ownerCount: 2,
  }).ok,
  false,
);
console.log("ok: RBAC roles, invite parse, last-owner protection");

assert.equal(approvalClass("gmail_create_draft", { clientNamedEmail: true }), "always");
assert.equal(toolNeedsApproval("gmail_send", true), true);
assert.equal(
  isClientNamedEmail({ workspaceKind: "client", clientName: "Acme", subject: "Hello Acme" }),
  true,
);
assert.ok(CLIENT_ISOLATION_FACTS.some((row) => row.key === "billing"));
console.log("ok: client-named email still always gated; isolation facts listed");

const emptyPack = packWorkspaceAuditExport({
  workspaceId: "ws_1",
  exportedBy: "ada@cinem.tech",
  exportedByRole: "owner",
  rows: [],
});
assert.equal(emptyPack.meta.certified, false);
assert.match(emptyPack.meta.note, /not SOC 2 certified/i);
assert.equal(emptyPack.count, 0);
assert.equal(emptyPack.packHash.length, 64);

const now = new Date("2026-09-10T00:00:00.000Z");
const later = new Date("2026-09-10T00:00:01.000Z");
const packed = packWorkspaceAuditExport({
  workspaceId: "ws_1",
  exportedBy: "ada@cinem.tech",
  exportedByRole: "admin",
  rows: [
    {
      id: "b",
      workspaceId: "ws_1",
      jobId: "job_1",
      deviceId: null,
      actor: "ada@cinem.tech",
      action: "artifact_approved",
      detail: "approved pack",
      data: JSON.stringify({ actorRole: "admin" }),
      createdAt: later,
    },
    {
      id: "a",
      workspaceId: "ws_1",
      jobId: null,
      deviceId: null,
      actor: "ada@cinem.tech",
      action: "invite",
      detail: "invited bob",
      data: JSON.stringify({ actorRole: "admin" }),
      createdAt: now,
    },
  ],
});
assert.equal(packed.entries[0].id, "a");
assert.equal(packed.entries[1].id, "b");
assert.equal(packed.entries[0].prevHash, "0".repeat(64));
assert.equal(packed.entries[1].prevHash, packed.entries[0].chainHash);
assert.equal(
  packed.entries[1].chainHash,
  chainHash(packed.entries[0].chainHash, packed.entries[1].rowHash),
);
assert.equal(hashAuditPayload({ a: 1 }).length, 64);
assert.match(AUDIT_EXPORT_NOTE, /Type I/);
console.log("ok: hash-chained audit export (not certified)");

assert.equal(SOC2_CERTIFIED, false);
assert.match(SOC2_STATUS_LABEL, /Not certified/);
const soc2 = soc2ReadinessSummary();
assert.equal(soc2.certified, false);
assert.ok(soc2.controls.length >= 8);
assert.ok(soc2.controls.every((row) => row.status !== ("certified" as never)));
assert.match(JSON.stringify(soc2), /in_product/);
assert.equal(JSON.stringify(soc2).toLowerCase().includes("soc 2 certified."), false);
console.log("ok: SOC 2 readiness does not claim certified");

assert.ok(DATA_PROCESSING_ROWS.some((row) => row.location === "device" && !row.leavesDevice));
assert.ok(DATA_PROCESSING_ROWS.some((row) => row.location === "processor"));
assert.ok(GDPR_SUBPROCESSORS.some((row) => /Composio/.test(row.name)));
console.log("ok: GDPR processing table includes on-device vs processor");

const links = settingsDeskLinks("ws_1").map((row) => row.label);
assert.ok(links.includes("Client desks"));
assert.ok(links.includes("Trust & audit"));
console.log("ok: Settings lists Client desks and Trust & audit");

for (const file of [
  "src/app/dpa/page.tsx",
  "src/app/security/page.tsx",
  "docs/security/soc2-readiness.md",
  "docs/security/controls-inventory.md",
  "docs/gdpr-dpa.md",
  "src/lib/rbac.ts",
  "src/components/desk/invite-team.tsx",
  "src/components/desk/client-desks.tsx",
  "src/components/desk/trust-center.tsx",
]) {
  assert.ok(existsSync(file), `missing ${file}`);
}
assert.match(readFileSync("src/app/security/page.tsx", "utf8"), /not SOC 2 certified/i);
assert.match(readFileSync("src/app/dpa/page.tsx", "utf8"), /not a signed agreement/i);
assert.match(readFileSync("AGENTS.md", "utf8"), /Phase 4/);
assert.match(readFileSync("electron/main.cjs", "utf8"), /not SOC 2 certified/);
assert.match(readFileSync("src/server/api/router.ts", "utf8"), /audit", "export"/);
assert.match(readFileSync("src/lib/auth.ts", "utf8"), /requireWorkspaceCapability/);
assert.equal(readFileSync("src/lib/composio.ts", "utf8").includes("COMPOSIO_API_KEY"), true);
console.log("ok: Phase 4 routes, docs, and Electron Trust menu exist");

console.log("Phase 4 checks passed.");
