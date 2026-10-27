/**
 * Usage series aggregation — credits wrap tokens 1:1. No database.
 */
import assert from "node:assert/strict";
import {
  aggregateUsageByModel,
  aggregateUsageSeries,
  seriesTotals,
  usageSeriesMeta,
} from "../src/lib/usage-series";

const now = new Date("2026-09-10T12:00:00.000Z");
const series = aggregateUsageSeries({
  days: 7,
  now,
  events: [
    { tokens: 100, createdAt: "2026-09-10T08:00:00.000Z" },
    { tokens: 50, createdAt: "2026-09-08T08:00:00.000Z" },
    { tokens: 25, createdAt: "2026-08-01T08:00:00.000Z" },
  ],
  jobs: [{ createdAt: "2026-09-10T09:00:00.000Z" }],
});
assert.equal(series.length, 7);
assert.equal(series[0].date, "2026-09-04");
assert.equal(series.at(-1)?.date, "2026-09-10");
assert.equal(series.find((row) => row.date === "2026-09-10")?.credits, 100);
assert.equal(series.find((row) => row.date === "2026-09-08")?.credits, 50);
assert.equal(series.find((row) => row.date === "2026-09-10")?.jobs, 1);
assert.equal(series.find((row) => row.date === "2026-09-04")?.credits, 0);
const totals = seriesTotals(series);
assert.equal(totals.credits, 150);
assert.equal(totals.events, 2);
console.log("ok: daily series fills zeros and ignores out-of-window events");

const byModel = aggregateUsageByModel([
  { tokens: 10, model: "claude-haiku-4-5" },
  { tokens: 5, model: "claude-haiku-4-5" },
  { tokens: 8, model: "gpt-4o-mini" },
]);
assert.equal(byModel[0].model, "claude-haiku-4-5");
assert.equal(byModel[0].credits, 15);
console.log("ok: model slices sum tokens as credits");

assert.equal(usageSeriesMeta({ eventCount: 2, jobCount: 1, tokenUsed: 9 }).source, "usage_event");
assert.equal(usageSeriesMeta({ eventCount: 0, jobCount: 3, tokenUsed: 9 }).source, "job");
assert.equal(usageSeriesMeta({ eventCount: 0, jobCount: 0, tokenUsed: 9 }).source, "credit_ledger");
console.log("ok: honest ledger source when events are missing");

console.log("Usage series checks passed.");
