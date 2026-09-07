/**
 * Playbook / fetch-url / browse / live-output guards. No database, no paid LLM calls.
 */
import assert from "node:assert/strict";
import {
  assertPublicHttpUrl,
  htmlToText,
  isPrivateIp,
  extractUrls,
  extractHtmlLinks,
} from "../src/lib/fetch-url";
import {
  browserInteractGuard,
  MAX_PAGES_PER_JOB,
  playwrightEnabled,
} from "../src/lib/browse";
import {
  competitorScanPlaybook,
  inferPlaybookKey,
  linkedinWeekPlaybook,
  outreachFromResearchPlaybook,
  parsePlan,
  researchPackPlaybook,
  webSearchPlaybook,
  adAnglesFromUrlPlaybook,
  ensureAskUser,
  gmailDraftPlaybook,
  gmailInboxPlaybook,
  slackPostPlaybook,
} from "../src/lib/job-playbooks";
import { slackPostAllowed } from "../src/lib/slack";
import { resolveRunOutput } from "../src/lib/live-output";
import { isTeamLaunchIntent, proposeBusinessTeam, TEAM_LAUNCH_ROLES } from "../src/lib/team-launch";
import {
  DEFAULT_AGENT_NAME,
  jobChipsForHint,
  missingRoleMarketplaceChips,
} from "../src/lib/constants";

const week = linkedinWeekPlaybook();
assert.equal(week.agentRole, "writer");
assert.equal(
  week.steps.filter((step) => step.tool === "write_artifact").length,
  5,
);
assert.equal(week.steps[0].tool, "read_brand_kit");
assert.equal(week.steps.at(-1)?.tool, "ask_user");
console.log("ok: LinkedIn week playbook is kit → 5 posts → ask_user");

const research = researchPackPlaybook("https://example.com");
assert.equal(research.agentRole, "researcher");
assert.equal(research.steps.some((step) => step.tool === "browser_navigate"), true);
assert.equal(research.steps.some((step) => step.tool === "browser_snapshot"), true);
assert.equal(research.steps.some((step) => step.tool === "crawl_links"), true);
console.log("ok: research pack includes browser_navigate + snapshot + crawl");

const search = webSearchPlaybook("brandcrew competitors");
assert.equal(search.steps.some((step) => step.tool === "web_search"), true);
assert.equal(inferPlaybookKey("researcher", "search the web for comps"), "web_search");
console.log("ok: web_search playbook");

const scan = competitorScanPlaybook([
  "https://example.com",
  "https://example.org",
  "https://example.net",
]);
assert.equal(scan.agentRole, "researcher");
assert.equal(
  scan.steps.filter((step) => step.tool === "browser_navigate").length,
  3,
);
assert.equal(scan.steps.some((step) => step.args.kind === "competitor_scan"), true);
console.log("ok: competitor scan browses 2–3 URLs then writes comparison");

const outreach = outreachFromResearchPlaybook();
assert.equal(outreach.steps.some((step) => step.tool === "read_artifact"), true);
assert.equal(outreach.steps.some((step) => step.args.kind === "outreach_pack"), true);
console.log("ok: outreach pack reads a research artifact");

const angles = adAnglesFromUrlPlaybook("https://example.com");
assert.equal(angles.steps.some((step) => step.tool === "browser_navigate"), true);
assert.equal(angles.steps.some((step) => step.args.kind === "ad_angles"), true);
console.log("ok: ad angles from URL browses then writes");

assert.equal(inferPlaybookKey("writer", "Generate week"), "linkedin_week");
assert.equal(inferPlaybookKey("researcher", "fetch the site"), "research_pack");
assert.equal(inferPlaybookKey("researcher", "competitor scan of these sites"), "competitor_scan");
assert.equal(
  inferPlaybookKey("sales", "outreach pack from research artifact"),
  "outreach_from_research",
);
assert.equal(inferPlaybookKey("ads", "ad angles from the landing page"), "ad_angles_from_url");
assert.equal(inferPlaybookKey("ops", "list recent gmail"), "gmail_inbox");
assert.equal(inferPlaybookKey("sales", "create a gmail draft to alex@example.com"), "gmail_draft");
assert.equal(inferPlaybookKey("ops", "post this to slack"), "slack_post");
console.log("ok: playbook inference");

const gmailInbox = gmailInboxPlaybook();
assert.equal(gmailInbox.steps.some((step) => step.tool === "gmail_list_recent"), true);
assert.equal(gmailInbox.steps.at(-1)?.tool, "ask_user");
const gmailDraft = gmailDraftPlaybook();
assert.equal(gmailDraft.steps.some((step) => step.tool === "gmail_create_draft"), true);
assert.equal(gmailDraft.steps.some((step) => step.tool === "gmail_list_recent"), false);
const slackPost = slackPostPlaybook();
assert.equal(slackPost.steps.some((step) => step.tool === "slack_draft_message"), true);
assert.equal(slackPost.steps.some((step) => step.tool === "ask_user"), true);
assert.equal(slackPost.steps.at(-1)?.tool, "slack_post_message");
const postStep = slackPost.steps.find((step) => step.tool === "slack_post_message")!;
assert.equal(slackPostAllowed(slackPost.steps, postStep.id), false);
const approvedPlan = slackPost.steps.map((step) =>
  step.tool === "ask_user" ? { ...step, status: "done" as const } : step,
);
assert.equal(slackPostAllowed(approvedPlan, postStep.id), true);
console.log("ok: Gmail/Slack playbooks; post requires completed ask_user");

const roundTrip = parsePlan(JSON.stringify(week.steps));
assert.equal(roundTrip.length, week.steps.length);
assert.equal(roundTrip[1].tool, "write_artifact");
const withAsk = ensureAskUser([
  { id: "x", tool: "read_brand_kit", label: "kit", status: "pending", args: {} },
]);
assert.equal(withAsk.at(-1)?.tool, "ask_user");
console.log("ok: plan JSON round-trip + ensureAskUser");

const text = htmlToText(
  "<html><head><style>p{}</style></head><body><script>alert(1)</script><h1>Hello</h1><p>World &amp; kitchen</p></body></html>",
);
assert.equal(text.includes("Hello"), true);
assert.equal(text.includes("World & kitchen"), true);
assert.equal(text.includes("alert"), false);
console.log("ok: htmlToText strips scripts and decodes entities");

assert.equal(isPrivateIp("127.0.0.1"), true);
assert.equal(isPrivateIp("10.0.0.4"), true);
assert.equal(isPrivateIp("192.168.1.9"), true);
assert.equal(isPrivateIp("8.8.8.8"), false);
assertPublicHttpUrl("https://example.com/about");
assert.throws(() => assertPublicHttpUrl("http://localhost/secret"));
assert.throws(() => assertPublicHttpUrl("ftp://example.com"));
assert.throws(() => assertPublicHttpUrl("file:///etc/passwd"));
assert.deepEqual(extractUrls("see https://example.com/x and http://example.org/y."), [
  "https://example.com/x",
  "http://example.org/y",
]);
const links = extractHtmlLinks(
  `<a href="/about">x</a><a href="https://example.org/a">y</a><a href="javascript:alert(1)">z</a>`,
  "https://example.com",
);
assert.equal(links.includes("https://example.com/about"), true);
assert.equal(links.includes("https://example.org/a"), true);
assert.equal(links.some((href) => href.startsWith("javascript:")), false);
console.log("ok: public URL guard + extractUrls + extractHtmlLinks");

const password = browserInteractGuard("browser_type", { selector: "input[type=password]" });
assert.equal(password.ok, false);
assert.match(password.reason, /password/i);
const send = browserInteractGuard("browser_click", { selector: "Send message" });
assert.equal(send.ok, false);
assert.match(send.reason, /send|stub|read-only/i);
assert.equal(MAX_PAGES_PER_JOB, 4);
console.log("ok: browse stubs refuse password/send; page cap is 4");
console.log(`ok: playwrightEnabled=${playwrightEnabled()} (informational)`);

assert.equal(TEAM_LAUNCH_ROLES.length >= 10, true);
const proposal = proposeBusinessTeam();
assert.equal(proposal.length, TEAM_LAUNCH_ROLES.length);
assert.ok(proposal.every((row) => row.name === DEFAULT_AGENT_NAME));
assert.equal(isTeamLaunchIntent("poori team banao"), true);
assert.equal(isTeamLaunchIntent("launch a full business team"), true);
assert.equal(isTeamLaunchIntent("write a linkedin post"), false);
console.log("ok: team launch proposal ≥10, names stay New Agent");

const tasting = "A tasting menu is a brand system.";
assert.throws(
  () =>
    resolveRunOutput({
      live: true,
      demoTitle: "Northline",
      demoContent: tasting,
    }),
  /no model or tool output/i,
);
const fromFetch = resolveRunOutput({
  live: true,
  fetched: { url: "https://example.com", ok: true, text: "Hello from the page." },
  demoTitle: "Northline",
  demoContent: tasting,
});
assert.equal(fromFetch.source, "tools");
assert.equal(fromFetch.content.includes(tasting), false);
assert.equal(fromFetch.content.includes("Hello from the page."), true);
const fromPages = resolveRunOutput({
  live: true,
  pages: [{ url: "https://example.org", ok: true, text: "Competitor headline." }],
  demoTitle: "Northline",
  demoContent: tasting,
});
assert.equal(fromPages.source, "tools");
assert.equal(fromPages.content.includes("Competitor headline."), true);
assert.equal(fromPages.content.includes(tasting), false);
const offline = resolveRunOutput({
  live: false,
  demoTitle: "Northline",
  demoContent: tasting,
});
assert.equal(offline.source, "demo");
console.log("ok: live output never persists canned demo copy");

const researchChips = jobChipsForHint("researcher");
assert.equal(
  researchChips.some((chip) => chip.action === "competitor_scan"),
  true,
);
const chipBlob = JSON.stringify([
  jobChipsForHint("writer"),
  jobChipsForHint("researcher"),
  jobChipsForHint("sales"),
  jobChipsForHint("ads"),
  missingRoleMarketplaceChips([], "ws"),
]);
assert.equal(/Maya|Omar|Sam|Lex/.test(chipBlob), false);
assert.equal(
  missingRoleMarketplaceChips([{ role: "Research" }], "ws").some((chip) =>
    /Research/.test(chip.label),
  ),
  false,
);
assert.equal(
  missingRoleMarketplaceChips([], "ws").some((chip) => /Research/.test(chip.label)),
  true,
);
console.log("ok: chips bind to role hints; no named Mission Control cast");

console.log("Job runtime checks passed.");
