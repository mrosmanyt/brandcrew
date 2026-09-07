/**
 * Playbook / fetch-url / live-output guards. No database, no paid LLM calls.
 */
import assert from "node:assert/strict";
import {
  assertPublicHttpUrl,
  htmlToText,
  isPrivateIp,
  extractUrls,
} from "../src/lib/fetch-url";
import {
  inferPlaybookKey,
  linkedinWeekPlaybook,
  parsePlan,
  researchPackPlaybook,
  webSearchPlaybook,
} from "../src/lib/job-playbooks";
import { resolveRunOutput } from "../src/lib/live-output";
import { isTeamLaunchIntent, proposeBusinessTeam, TEAM_LAUNCH_ROLES } from "../src/lib/team-launch";
import { DEFAULT_AGENT_NAME } from "../src/lib/constants";

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
assert.equal(research.steps.some((step) => step.tool === "fetch_url"), true);
console.log("ok: research pack includes fetch_url");

const search = webSearchPlaybook("brandcrew competitors");
assert.equal(search.steps.some((step) => step.tool === "web_search"), true);
assert.equal(inferPlaybookKey("researcher", "search the web for comps"), "web_search");
console.log("ok: web_search playbook");

assert.equal(inferPlaybookKey("writer", "Generate week"), "linkedin_week");
assert.equal(inferPlaybookKey("researcher", "fetch the site"), "research_pack");
console.log("ok: playbook inference");

const roundTrip = parsePlan(JSON.stringify(week.steps));
assert.equal(roundTrip.length, week.steps.length);
assert.equal(roundTrip[1].tool, "write_artifact");
console.log("ok: plan JSON round-trip");

const text = htmlToText(
  "<html><head><style>p{}</style></head><body><script>alert(1)</script><h1>Hello</h1><p>World &amp; kitchen</p></body></html>",
);
assert.equal(text.includes("Hello"), true);
assert.equal(text.includes("World & kitchen"), true);
assert.equal(text.includes("alert"), false);
console.log("ok: htmlToText strips scripts and decodes entities");

assert.equal(isPrivateIp("127.0.0.1"), false);
assert.equal(isPrivateIp("10.0.0.4"), true);
assert.equal(isPrivateIp("192.168.1.9"), true);
assert.equal(isPrivateIp("8.8.8.8"), false);
assertPublicHttpUrl("https://example.com/about");
assert.throws(() => assertPublicHttpUrl("http://localhost/secret"));
assert.throws(() => assertPublicHttpUrl("ftp://example.com"));
assert.deepEqual(extractUrls("see https://example.com/x and http://example.org/y."), [
  "https://example.com/x",
  "http://example.org/y",
]);
console.log("ok: public URL guard + extractUrls");

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
const offline = resolveRunOutput({
  live: false,
  demoTitle: "Northline",
  demoContent: tasting,
});
assert.equal(offline.source, "demo");
console.log("ok: live output never persists canned demo copy");

console.log("Job runtime checks passed.");
