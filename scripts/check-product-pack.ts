/**
 * Plans $20/$79/$200, onboarding, templates, invites, schedules, export PDF.
 * No database.
 */
import assert from "node:assert/strict";
import { PLANS } from "../src/lib/constants";
import { artifactMarkdown, artifactPdfBytes, estimateUsdStub } from "../src/lib/export-artifact";
import { FEATURED_JOB_TEMPLATES } from "../src/lib/job-templates";
import { inferPlaybookKey } from "../src/lib/job-playbooks";
import { limitsForPlan, normalizePlanId } from "../src/lib/limits";
import { shouldShowOnboarding, workspaceOnboarding } from "../src/lib/onboarding";
import { computeNextRunAt, isScheduleCadence } from "../src/lib/schedule-cadence";

assert.equal(PLANS.starter.price, 20);
assert.equal(PLANS.pro.price, 79);
assert.equal(PLANS.ultra.price, 200);
assert.equal(PLANS.starter.seats, 2);
assert.equal(PLANS.pro.seats, 5);
assert.ok(PLANS.ultra.seats >= 10 && PLANS.ultra.seats <= 15);
assert.ok(PLANS.starter.tokenBudget >= 40_000 && PLANS.starter.tokenBudget <= 60_000);
assert.ok(PLANS.pro.tokenBudget >= 180_000);
assert.ok(PLANS.ultra.tokenBudget >= 500_000 && PLANS.ultra.tokenBudget <= 750_000);
assert.ok(PLANS.ultra.jobsPerHour >= 80 && PLANS.ultra.jobsPerHour <= 100);
assert.ok(PLANS.ultra.maxConcurrentJobs >= 6 && PLANS.ultra.maxConcurrentJobs <= 8);
assert.ok(PLANS.demo.tokenBudget < PLANS.starter.tokenBudget);
assert.ok(PLANS.pro.tokenBudget < PLANS.ultra.tokenBudget);
assert.equal(normalizePlanId("growth"), "pro");
assert.equal(normalizePlanId("ultra"), "ultra");
assert.equal(limitsForPlan("starter").seats, 2);
assert.equal(limitsForPlan("ultra").paid, true);
console.log("ok: Starter $20 / Pro $79 / Ultra $200 caps");

assert.equal(FEATURED_JOB_TEMPLATES.length, 7);
assert.deepEqual(
  FEATURED_JOB_TEMPLATES.map((row) => row.playbookKey).sort(),
  [
    "competitor_scan",
    "deck_builder",
    "inbox_invoices",
    "linkedin_outreach_draft",
    "linkedin_week",
    "outreach_from_research",
    "website_builder",
  ].sort(),
);
assert.equal(inferPlaybookKey("writer", "", "generate_week"), "linkedin_week");
assert.equal(inferPlaybookKey("Website", "", "build_website"), "website_builder");
assert.equal(inferPlaybookKey("Website", "", "build_deck"), "deck_builder");
console.log("ok: featured playbook pack");

const empty = workspaceOnboarding({
  dismissed: false,
  agentCount: 0,
  jobCount: 0,
  approvedCount: 0,
});
assert.equal(empty.total, 3);
assert.equal(shouldShowOnboarding(empty), true);
const done = workspaceOnboarding({
  dismissed: false,
  agentCount: 1,
  jobCount: 1,
  approvedCount: 1,
});
assert.equal(done.completed, true);
assert.equal(shouldShowOnboarding(done), false);
assert.equal(
  shouldShowOnboarding(workspaceOnboarding({ dismissed: true, agentCount: 0, jobCount: 0, approvedCount: 0 })),
  false,
);
console.log("ok: 3-step onboarding dismiss/complete");

assert.equal(isScheduleCadence("weekly_monday"), true);
const monday = computeNextRunAt("weekly_monday", new Date("2026-09-07T08:00:00.000Z")); // Monday before 09:00 UTC
assert.equal(monday.toISOString(), "2026-09-07T09:00:00.000Z");
const after = computeNextRunAt("weekly_monday", new Date("2026-09-07T10:00:00.000Z"));
assert.equal(after.getUTCDay(), 1);
assert.ok(after.getTime() > Date.parse("2026-09-07T10:00:00.000Z"));
console.log("ok: Monday 09:00 UTC schedule math");

const md = artifactMarkdown({ title: "Hello", content: "Body text" });
assert.match(md, /# Hello/);
const pdf = artifactPdfBytes("Hello", "Body text");
const head = new TextDecoder().decode(pdf.slice(0, 8));
assert.equal(head.startsWith("%PDF"), true);
assert.equal(estimateUsdStub(100_000), 0.5);
console.log("ok: markdown + simple PDF export + cost stub");

console.log("Product pack checks passed.");
