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
  playwrightDesktopRequiredReason,
} from "../src/lib/browse";
import { isNegativeClarification, parseAskKind } from "../src/lib/job-clarify";
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
  inboxRepliesPlaybook,
  slackPostPlaybook,
  recruiterSheetPlaybook,
  inboxInvoicesPlaybook,
  linkedinOutreachDraftPlaybook,
  whatsappDraftsPlaybook,
  websiteBuilderPlaybook,
  appBuilderPlaybook,
  brandKitDraftPlaybook,
  deckBuilderPlaybook,
  prospectingScanPlaybook,
  outreachDraftPackPlaybook,
  weeklyClientBriefPlaybook,
} from "../src/lib/job-playbooks";
import { slackPostAllowed } from "../src/lib/slack";
import { resolveRunOutput } from "../src/lib/live-output";
import { isTeamLaunchIntent, proposeBusinessTeam, TEAM_LAUNCH_ROLES } from "../src/lib/team-launch";
import {
  DEFAULT_AGENT_NAME,
  jobChipsForHint,
  missingRoleMarketplaceChips,
} from "../src/lib/constants";
import { JOB_TOOLS } from "../src/lib/job-types";
import { PAGE_CONTENT_START, wrapUntrustedPageText } from "../src/lib/page-content";
import { hostAllowed } from "../src/lib/domain-allowlist";
import { isWriteExternalTool } from "../src/lib/write-gate";

const week = linkedinWeekPlaybook();
assert.equal(week.agentRole, "writer");
assert.equal(
  week.steps.filter((step) => step.tool === "write_artifact").length,
  5,
);
assert.equal(week.steps[0].tool, "read_brand_kit");
assert.equal(week.steps.at(-1)?.tool, "write_artifact");
assert.equal(week.steps.some((step) => step.tool === "ask_user"), false);
console.log("ok: LinkedIn week playbook is kit → 5 posts (in-desk, no trailing approve)");

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
assert.equal(inferPlaybookKey("ops", "draft inbox replies"), "inbox_replies");
assert.equal(inferPlaybookKey("ops", "whatsapp drafts do not send"), "whatsapp_drafts");
assert.equal(inferPlaybookKey("sales", "create a gmail draft to alex@example.com"), "gmail_draft");
assert.equal(inferPlaybookKey("ops", "post this to slack"), "slack_post");
assert.equal(inferPlaybookKey("Website", "Build a website"), "website_builder");
assert.equal(inferPlaybookKey("App", "Build an app"), "app_builder");
assert.equal(inferPlaybookKey("builder", "Build a pitch deck"), "deck_builder");
assert.equal(inferPlaybookKey("strategist", "Brand Kit creative draft"), "brand_kit_draft");
assert.equal(inferPlaybookKey("writer", "", "build_deck"), "deck_builder");
assert.equal(inferPlaybookKey("writer", "", "brand_kit_draft"), "brand_kit_draft");
assert.equal(inferPlaybookKey("sales", "", "prospecting_scan"), "prospecting_scan");
assert.equal(inferPlaybookKey("sales", "outreach draft pack"), "outreach_draft_pack");
assert.equal(inferPlaybookKey("researcher", "weekly client brief"), "weekly_client_brief");
console.log("ok: playbook inference");

const website = websiteBuilderPlaybook();
assert.equal(website.agentRole, "builder");
assert.equal(website.steps.some((step) => step.args.kind === "website"), true);
assert.equal(website.steps.at(-1)?.tool, "write_artifact");
assert.equal(website.steps.some((step) => step.tool === "ask_user"), false);
const appJob = appBuilderPlaybook();
assert.equal(appJob.steps.some((step) => step.args.kind === "app"), true);
const deck = deckBuilderPlaybook();
assert.equal(deck.agentRole, "builder");
assert.equal(deck.steps.some((step) => step.args.kind === "deck"), true);
assert.equal(deck.steps.at(-1)?.tool, "write_artifact");
const kitDraft = brandKitDraftPlaybook();
assert.equal(kitDraft.agentRole, "strategist");
assert.equal(kitDraft.steps.some((step) => step.args.kind === "brand_kit_draft"), true);
assert.equal(kitDraft.steps.at(-1)?.tool, "write_artifact");
console.log("ok: website/app/deck/brand-kit builder playbooks");

const gmailInbox = gmailInboxPlaybook();
assert.equal(gmailInbox.steps.some((step) => step.tool === "gmail_list_recent"), true);
assert.equal(gmailInbox.steps.at(-1)?.tool, "write_artifact");
assert.equal(gmailInbox.steps.some((step) => step.tool === "ask_user"), false);
const gmailDraft = gmailDraftPlaybook();
assert.equal(gmailDraft.steps.some((step) => step.tool === "gmail_create_draft"), true);
assert.equal(gmailDraft.steps.some((step) => step.tool === "gmail_list_recent"), false);
assert.equal(gmailDraft.steps.some((step) => step.tool === "ask_user"), false);
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
const inbox = inboxRepliesPlaybook(true);
assert.equal(inbox.steps.some((step) => step.tool === "gmail_list_recent"), true);
assert.equal(inboxRepliesPlaybook(false).steps.some((step) => step.tool === "gmail_list_recent"), false);
assert.equal(inbox.steps.at(-1)?.tool, "write_artifact");
assert.equal(whatsappDraftsPlaybook().steps.some((step) => step.args.kind === "whatsapp_drafts"), true);
assert.equal(whatsappDraftsPlaybook().steps.at(-1)?.tool, "write_artifact");
console.log("ok: Gmail/Slack playbooks; post requires completed ask_user");
console.log("ok: inbox + WhatsApp drafts stay in-desk (no trailing approve)");

const roundTrip = parsePlan(JSON.stringify(week.steps));
assert.equal(roundTrip.length, week.steps.length);
assert.equal(roundTrip[1].tool, "write_artifact");
const withAsk = ensureAskUser([
  { id: "x", tool: "read_brand_kit", label: "kit", status: "pending", args: {} },
]);
assert.equal(withAsk.at(-1)?.tool, "read_brand_kit");
const withPost = ensureAskUser([
  { id: "x", tool: "read_brand_kit", label: "kit", status: "pending", args: {} },
  { id: "p", tool: "slack_post_message", label: "post", status: "pending", args: {} },
]);
assert.equal(withPost.at(-1)?.tool, "ask_user");
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
const publicClick = browserInteractGuard("browser_click", { selector: "a.more" });
assert.equal(publicClick.ok, true);
assert.equal(MAX_PAGES_PER_JOB, 4);
assert.match(playwrightDesktopRequiredReason("browser_click"), /desktop|Playwright|Chrome/i);
console.log("ok: browse guards refuse password/send; public click is allowed; page cap is 4");
console.log(`ok: playwrightEnabled=${playwrightEnabled()} (informational)`);

const outreachDraft = linkedinOutreachDraftPlaybook("https://example.com");
assert.equal(outreachDraft.steps.some((step) => step.tool === "browser_extract"), true);
assert.equal(outreachDraft.steps.some((step) => step.args.kind === "clarify"), true);
assert.equal(outreachDraft.steps.at(-1)?.tool, "write_artifact");
assert.equal(outreachDraft.steps.some((step) => step.tool === "ask_user" && step.args.kind === "clarify"), true);
assert.equal(inferPlaybookKey("sales", "draft outreach from this public page"), "linkedin_outreach_draft");
const recruiter = recruiterSheetPlaybook("https://example.com/careers");
assert.equal(recruiter.steps.some((step) => step.args.kind === "recruiter_sheet"), true);
assert.equal(recruiter.steps.some((step) => step.args.kind === "clarify"), true);
const invoices = inboxInvoicesPlaybook(true);
assert.equal(invoices.steps.some((step) => step.tool === "gmail_list_recent"), true);
assert.equal(invoices.steps.some((step) => step.args.kind === "inbox_invoices"), true);
assert.equal(inboxInvoicesPlaybook(false).steps.some((step) => step.tool === "gmail_list_recent"), false);
assert.equal(inferPlaybookKey("ops", "find invoices in gmail"), "inbox_invoices");
assert.equal(parseAskKind({ kind: "clarify" }), "clarify");
assert.equal(isNegativeClarification("No"), true);
assert.equal(isNegativeClarification("yes"), false);
console.log("ok: LinkedIn outreach + recruiter sheet + invoice finder; clarify is Prisma-shaped");

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

assert.ok(JOB_TOOLS.includes("native_file_read"));
assert.ok(JOB_TOOLS.includes("native_file_write"));
assert.ok(JOB_TOOLS.includes("browser_tabs"));
assert.ok(JOB_TOOLS.includes("composio_execute"));
assert.equal(isWriteExternalTool("browser_click"), true);
assert.equal(isWriteExternalTool("gmail_create_draft"), false);
assert.equal(hostAllowed("https://evil.test/x", ["example.com"]).ok, false);
assert.match(wrapUntrustedPageText("hi", "https://example.com"), new RegExp(PAGE_CONTENT_START));
const prospect = prospectingScanPlaybook("https://example.com");
assert.equal(prospect.steps.at(-1)?.tool, "write_artifact");
assert.equal(outreachDraftPackPlaybook().steps.some((step) => step.args.kind === "outreach_pack"), true);
assert.equal(weeklyClientBriefPlaybook().steps.some((step) => step.args.kind === "weekly_client_brief"), true);
console.log("ok: native tools, write-gate, allowlist, page delimiters, agency playbooks");

console.log("Job runtime checks passed.");
