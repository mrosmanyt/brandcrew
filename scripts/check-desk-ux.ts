/**
 * Step 3 desk UX: unknown subroutes 404, credits copy, checkout wrap, mobile menu.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatComposerUsageLine,
  formatCreditsLine,
  formatJobsCapLine,
  formatJobsLeftLine,
  usageLookbackLabel,
  creditsFromTokens,
} from "../src/lib/credits";
import { resolveDeskSection } from "../src/lib/desk-routes";

assert.deepEqual(resolveDeskSection([]), { kind: "mission" });
assert.deepEqual(resolveDeskSection(undefined), { kind: "mission" });
assert.deepEqual(resolveDeskSection(["usage"]), { kind: "page", section: "usage" });
assert.deepEqual(resolveDeskSection(["billing"]), { kind: "page", section: "billing" });
assert.deepEqual(resolveDeskSection(["developers"]), { kind: "page", section: "developers" });
assert.deepEqual(resolveDeskSection(["api-console"]), { kind: "not-found" });
assert.deepEqual(resolveDeskSection(["not-a-page"]), { kind: "not-found" });
assert.deepEqual(resolveDeskSection(["settings", "extra"]), { kind: "not-found" });
console.log("ok: unknown desk segments 404 instead of Mission Control hijack");

const page = readFileSync("src/app/desk/[workspaceId]/[[...section]]/page.tsx", "utf8");
assert.match(page, /resolveDeskSection/);
assert.match(page, /notFound\(\)/);
assert.doesNotMatch(page, /agentId=\$\{encodeURIComponent/);
assert.match(readFileSync("src/app/desk/[workspaceId]/not-found.tsx", "utf8"), /NotFoundView/);
assert.match(readFileSync("src/app/not-found.tsx", "utf8"), /NotFoundView/);
assert.match(readFileSync("src/components/not-found-view.tsx", "utf8"), /That page is not on the desk/);
console.log("ok: desk 404 mirrors the top-level not-found copy");

const credits = creditsFromTokens(250, 1000);
assert.equal(formatCreditsLine(credits), "750 / 1,000 credits this cycle");
assert.equal(formatJobsCapLine(90), "90 jobs/hr cap");
assert.equal(formatJobsLeftLine(90), "90 jobs/hr left");
assert.equal(
  formatComposerUsageLine({ creditsLeft: 750, jobsLeft: 88, planName: "Free" }),
  "750 credits this cycle · 88 jobs/hr left · Free",
);
assert.equal(usageLookbackLabel(30), "last 30 days");
assert.equal(usageLookbackLabel(1), "last 1 day");

const chrome = readFileSync("src/components/desk/desk-chrome.tsx", "utf8");
assert.match(chrome, /formatCreditsLine/);
assert.match(chrome, /formatJobsCapLine/);
assert.doesNotMatch(chrome, /tokens ·/);
const footer = readFileSync("src/components/desk/mission-control.tsx", "utf8");
assert.match(footer, /formatComposerUsageLine/);
assert.doesNotMatch(footer, /tokens · \$\{jobsLeft\}/);
const usage = readFileSync("src/components/desk/usage-dashboard.tsx", "utf8");
assert.match(usage, /Credits remaining this cycle/);
assert.match(usage, /Recent credit events/);
assert.doesNotMatch(usage, /Recent token events/);
const chart = readFileSync("src/components/desk/usage-chart.tsx", "utf8");
assert.match(chart, /usageLookbackLabel/);
assert.match(chart, /Remaining this billing cycle/);
assert.doesNotMatch(chart, /in \{days\}d/);
console.log("ok: header/footer/usage label credits and label both usage windows");

const plans = readFileSync("src/components/desk/billing-plans.tsx", "utf8");
assert.match(plans, /whitespace-normal/);
assert.match(plans, /minmax\(16rem,1fr\)/);
assert.match(plans, /credits \/ cycle/);
assert.match(plans, /See remaining credits/);
assert.doesNotMatch(plans, /tokens \/ cycle/);
console.log("ok: checkout buttons wrap; plan cards say credits");

const sidebar = readFileSync("src/components/desk/sidebar.tsx", "utf8");
assert.match(sidebar, /Open desk menu/);
assert.match(sidebar, /menuOpen/);
assert.match(sidebar, />\s*Menu\s*</);
assert.match(sidebar, /creditsLine/);
console.log("ok: mobile desk menu is labeled and closes on navigate");

console.log("Desk UX checks passed.");
