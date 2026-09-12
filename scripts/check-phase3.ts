/**
 * Phase 3: Composio (honest disconnect), learning memory, multi-tab,
 * agency playbooks, client workspaces. No live Composio calls.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  COMPOSIO_AGENCY_TOOLKITS,
  composioPluginId,
  composioToolLooksLikeWrite,
  composioUserId,
  getComposioToolkit,
} from "../src/lib/composio-catalog";
import {
  composioApiKey,
  composioConfigured,
  composioMissingHint,
  readComposioConnectLink,
  resetComposioSdkForTests,
} from "../src/lib/composio";
import { setupHint } from "../src/lib/plugins";
import { memoryFromArtifact, formatMemoryBrief, parseMemoryKind } from "../src/lib/learning-memory";
import {
  MAX_RESEARCH_TABS,
  researchUrlsFromMessage,
  tabCapForPlaybook,
} from "../src/lib/multi-tab";
import {
  clientNameFrom,
  isClientNamedEmail,
  parseWorkspaceKind,
} from "../src/lib/client-workspaces";
import {
  dailyClientBriefPlaybook,
  clientNamedEmailPlaybook,
  inferPlaybookKey,
  multiTabResearchPlaybook,
  playbookFromKey,
  seoBriefPlaybook,
} from "../src/lib/job-playbooks";
import { FEATURED_JOB_TEMPLATES } from "../src/lib/job-templates";
import { JOB_TOOLS } from "../src/lib/job-types";
import { DEVICE_TOOLS } from "../src/lib/device-protocol";
import { approvalClass, toolNeedsApproval } from "../src/lib/write-gate";
import { getMarketplacePlugin, MARKETPLACE_PLUGINS } from "../src/lib/marketplace";

const savedKey = process.env.COMPOSIO_API_KEY;
const savedTypo = process.env.COMPOSER_API_KEY;
delete process.env.COMPOSIO_API_KEY;
delete process.env.COMPOSER_API_KEY;
resetComposioSdkForTests();
assert.equal(composioConfigured(), false);
assert.equal(composioApiKey(), "");
assert.match(composioMissingHint(), /COMPOSIO_API_KEY/);
assert.doesNotMatch(composioMissingHint(), /COMPOSER_API_KEY/);
assert.match(composioMissingHint(), /does not fake Connected/);
process.env.COMPOSER_API_KEY = "ak_typo_fallback_do_not_commit";
resetComposioSdkForTests();
assert.equal(composioConfigured(), true);
assert.equal(composioApiKey(), "ak_typo_fallback_do_not_commit");
delete process.env.COMPOSER_API_KEY;
if (savedKey !== undefined) process.env.COMPOSIO_API_KEY = savedKey;
if (savedTypo !== undefined) process.env.COMPOSER_API_KEY = savedTypo;
resetComposioSdkForTests();
console.log("ok: missing COMPOSIO_API_KEY stays disconnected; COMPOSER typo still configures");

const composioSrc = readFileSync("src/lib/composio.ts", "utf8");
assert.match(composioSrc, /function readProcessEnv\(name: string\)/);
assert.match(composioSrc, /process\.env\[name\]/);
assert.match(composioSrc, /readProcessEnv\(COMPOSIO_API_KEY_NAME\)/);
assert.doesNotMatch(composioSrc, /process\.env\.COMPOSIO_API_KEY\s*\|\|/);
assert.doesNotMatch(composioSrc, /process\.env\.COMPOSER_API_KEY\s*\|\|/);
assert.match(composioSrc, /session\.authorize\(toolkit\.slug/);
assert.doesNotMatch(
  composioSrc,
  /if \(toolkit\.auth === "api_key"\) \{\s*const pasted = input\.apiKey/,
);
const hubspot = getMarketplacePlugin("composio-hubspot")!;
const savedForHint = process.env.COMPOSIO_API_KEY;
process.env.COMPOSIO_API_KEY = "ak_runtime_present";
resetComposioSdkForTests();
assert.equal(composioConfigured(), true);
assert.match(setupHint(hubspot), /Connect opens Composio/);
assert.doesNotMatch(setupHint(hubspot), /Set COMPOSIO_API_KEY/);
if (savedForHint !== undefined) process.env.COMPOSIO_API_KEY = savedForHint;
else delete process.env.COMPOSIO_API_KEY;
resetComposioSdkForTests();
console.log("ok: COMPOSIO_API_KEY is read at runtime; Connect hint is not a missing-key prompt");

const link = readComposioConnectLink({
  id: "ca_1",
  status: "INITIATED",
  redirectUrl: "https://connect.composio.dev/link/abc",
});
assert.equal(link.redirectUrl, "https://connect.composio.dev/link/abc");
assert.equal(link.connectionId, "ca_1");
assert.equal(readComposioConnectLink({ redirectUrl: "null", id: "ca_2" }).redirectUrl, "");
assert.equal(
  readComposioConnectLink({ redirect_url: "https://backend.composio.dev/connect/x" }).redirectUrl,
  "https://backend.composio.dev/connect/x",
);
console.log("ok: session.authorize ConnectionRequest maps to a Connect Link");

assert.ok(getComposioToolkit("composio-gmail"));
assert.ok(getComposioToolkit("gmail"));
assert.ok(getComposioToolkit("hackernews"));
assert.ok(getComposioToolkit("hubspot"));
assert.equal(composioPluginId("gmail"), "composio-gmail");
assert.equal(composioUserId("ws_1"), "cinem-ws-ws_1");
assert.equal(composioToolLooksLikeWrite("GMAIL_GET_PROFILE"), false);
assert.equal(composioToolLooksLikeWrite("GMAIL_SEND_EMAIL"), true);
assert.equal(composioToolLooksLikeWrite("HUBSPOT_CREATE_CONTACT"), true);
for (const row of COMPOSIO_AGENCY_TOOLKITS) {
  const plugin = getMarketplacePlugin(row.id);
  assert.ok(plugin, `missing marketplace plugin ${row.id}`);
  assert.equal(plugin.auth, "composio");
  assert.ok(plugin.envKeys.includes("COMPOSIO_API_KEY"));
}
assert.ok(MARKETPLACE_PLUGINS.some((row) => row.id === "composio-gmail"));
assert.equal(getMarketplacePlugin("gmail")?.auth, "oauth");
assert.equal(getMarketplacePlugin("web-search")?.auth, "api_key");
assert.equal(getMarketplacePlugin("whatsapp")?.auth, "api_key");
assert.doesNotMatch(getMarketplacePlugin("gmail")!.envKeys.join(" "), /COMPOSIO/);
assert.doesNotMatch(getMarketplacePlugin("web-search")!.envKeys.join(" "), /COMPOSIO/);
assert.doesNotMatch(getMarketplacePlugin("whatsapp")!.envKeys.join(" "), /COMPOSIO/);
console.log(`ok: ${COMPOSIO_AGENCY_TOOLKITS.length} Composio agency toolkits in Marketplace`);

const approved = memoryFromArtifact({
  status: "approved",
  title: "Outreach pack",
  content: "Keep the short openers.",
  type: "outreach_pack",
});
assert.equal(approved.source, "approved_draft");
assert.match(approved.value, /Approved/);
const rejected = memoryFromArtifact({
  status: "rejected",
  title: "Outreach pack",
  content: "Too salesy.",
  type: "outreach_pack",
});
assert.equal(rejected.source, "rejected_draft");
assert.match(rejected.value, /Rejected/);
assert.equal(parseMemoryKind("project"), "project");
const brief = formatMemoryBrief([
  {
    id: "m1",
    workspaceId: "ws",
    kind: "style",
    source: "approved_draft",
    title: "Keep: pack",
    value: "Short openers",
    approved: true,
    artifactId: "a1",
    jobId: null,
    createdAt: new Date().toISOString(),
  },
]);
assert.match(brief, /not as instructions/);
assert.match(brief, /Short openers/);
console.log("ok: learning memory from approve/reject");

assert.equal(MAX_RESEARCH_TABS, 10);
const urls = researchUrlsFromMessage(
  "https://a.example https://b.example https://c.example https://d.example https://e.example https://f.example",
  "https://client.example",
);
assert.ok(urls.length >= 5 && urls.length <= 10);
assert.equal(tabCapForPlaybook("multi_tab_research"), 10);
assert.equal(tabCapForPlaybook("prospecting_scan") < 10, true);
const tabs = multiTabResearchPlaybook(urls);
assert.equal(tabs.steps.some((step) => step.tool === "browser_tabs"), true);
assert.ok(JOB_TOOLS.includes("browser_tabs"));
assert.ok(DEVICE_TOOLS.includes("browser_tabs"));
assert.ok(JOB_TOOLS.includes("composio_execute"));
console.log("ok: multi-tab research cap 10 + browser_tabs tool");

const agencyKeys = [
  "prospecting_scan",
  "outreach_draft_pack",
  "weekly_client_brief",
  "daily_client_brief",
  "seo_brief",
  "multi_tab_research",
  "client_named_email",
  "follow_up_sequence",
  "competitor_watch",
  "talent_sourcing",
];
for (const key of agencyKeys) {
  assert.ok(
    FEATURED_JOB_TEMPLATES.some((row) => row.playbookKey === key),
    `missing featured template ${key}`,
  );
  const playbook = playbookFromKey(key, "sales", "https://example.com https://example.org");
  assert.equal(playbook.key, key);
  assert.ok(playbook.steps.length >= 2);
  assert.equal(playbook.steps.some((step) => step.tool === "write_artifact"), true);
}
assert.equal(inferPlaybookKey("researcher", "daily client brief"), "daily_client_brief");
assert.equal(inferPlaybookKey("researcher", "seo brief"), "seo_brief");
assert.equal(inferPlaybookKey("sales", "client-named email"), "client_named_email");
const daily = dailyClientBriefPlaybook(["https://example.com"]);
assert.equal(daily.steps.some((step) => step.tool === "browser_tabs"), true);
const email = clientNamedEmailPlaybook();
assert.equal(email.steps.some((step) => step.tool === "ask_user"), true);
assert.equal(
  email.steps.some((step) => step.tool === "gmail_create_draft" && step.args.clientNamed === true),
  true,
);
const seo = seoBriefPlaybook(["https://example.com"]);
assert.equal(seo.steps.at(-1)?.args.kind, "seo_brief");
console.log("ok: 10 agency playbooks install as real job structure");

assert.equal(parseWorkspaceKind("client"), "client");
assert.equal(parseWorkspaceKind("agency"), "agency");
assert.equal(clientNameFrom({ kind: "client", name: "Acme" }), "Acme");
assert.equal(
  isClientNamedEmail({ workspaceKind: "client", clientName: "Acme", subject: "Hello Acme" }),
  true,
);
assert.equal(
  isClientNamedEmail({ workspaceKind: "agency", clientName: "", subject: "Hello" }),
  false,
);
assert.equal(approvalClass("gmail_create_draft"), "none");
assert.equal(approvalClass("gmail_create_draft", { clientNamedEmail: true }), "always");
assert.equal(toolNeedsApproval("gmail_create_draft", true, { clientNamedEmail: true }), true);
assert.equal(approvalClass("composio_execute", { composioTool: "HUBSPOT_CREATE_CONTACT" }), "always");
assert.equal(approvalClass("composio_execute", { composioTool: "GMAIL_GET_PROFILE" }), "none");
assert.ok(existsSync("src/components/desk/learning-memory.tsx"));
assert.match(readFileSync("src/lib/workspace.ts", "utf8"), /kind === "client"/);
assert.match(readFileSync("src/components/desk/sidebar.tsx", "utf8"), /kind: "client"/);
assert.match(readFileSync("AGENTS.md", "utf8"), /COMPOSIO_API_KEY/);
assert.match(readFileSync(".env.example", "utf8"), /COMPOSIO_API_KEY/);
console.log("ok: client workspaces + write-gate for client-named email");

console.log("Phase 3 checks passed.");
