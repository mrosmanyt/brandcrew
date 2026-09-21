/**
 * Privacy contracts for Admin Insights.
 * Source checks always run. Prisma smokes skip if Postgres is down or unmigrated.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyAnalyticsTopics,
  payloadHasForbiddenAnalyticsKey,
  redactAnalyticsText,
  topicsFromUserText,
} from "../src/lib/analytics-privacy";
import {
  ANALYTICS_NO_DETAIL_TABLE,
  pruneAnalyticsDetails,
  recordAnalytics,
} from "../src/lib/analytics";
import { prisma } from "../src/lib/db";

const insightsApi = readFileSync("src/server/api/admin/insights.ts", "utf8");
const insightsUi = readFileSync("src/components/admin/admin-insights.tsx", "utf8");
const analyticsSrc = readFileSync("src/lib/analytics.ts", "utf8");
const helpdeskSrc = readFileSync("src/lib/helpdesk.ts", "utf8");
const guestChatSrc = readFileSync("src/server/api/guest/chat.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const shell = readFileSync("src/components/admin/admin-shell.tsx", "utf8");
const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");

assert.match(insightsApi, /requireAdmin/);
assert.match(insightsApi, /getAdminInsights/);
assert.match(insightsApi, /buildWeeklyAnalyticsReport/);
assert.match(insightsApi, /weeklyReportToCsv/);
assert.doesNotMatch(insightsApi, /\bemail\b/);
assert.doesNotMatch(insightsApi, /\bauthorEmail\b/);
assert.doesNotMatch(insightsApi, /\bguestKey\b/);
assert.doesNotMatch(insightsApi, /\buserId\b/);
assert.doesNotMatch(insightsApi, /\bpasswordHash\b/);
assert.doesNotMatch(insightsApi, /request\.json\(\)/);
assert.doesNotMatch(insightsApi, /\.body\b/);
assert.doesNotMatch(insightsUi, /authorEmail|\.email\b|["']email["']/);
assert.doesNotMatch(insightsUi, /guestKey|passwordHash/);
console.log("ok: insights API/UI do not expose raw body, content, or email fields");

assert.equal(ANALYTICS_NO_DETAIL_TABLE, true);
assert.match(schema, /model AnalyticsEvent/);
assert.match(schema, /analyticsOptIn/);
assert.doesNotMatch(schema, /model AnalyticsWeeklyReport/);
assert.doesNotMatch(schema, /model AnalyticsDetail/);
assert.match(analyticsSrc, /No detail\/log table/);
assert.doesNotMatch(analyticsSrc, /prisma\.message/);
assert.doesNotMatch(helpdeskSrc, /prisma\.message/);
assert.match(helpdeskSrc, /recordSupportMessageTopics/);
assert.match(helpdeskSrc, /role === "user"/);
assert.match(guestChatSrc, /recordGuestChatTopics\(body\.message\)/);
assert.doesNotMatch(guestChatSrc, /recordGuestChatTopics\([^\)]*guestKey/);
console.log("ok: aggregates only; Support + guest tagged; desk Conversation Message is not");

assert.match(shell, /label: "Insights"/);
assert.match(shell, /\/admin\/insights/);
assert.match(privacy, /anonymous topic counts/i);
assert.match(privacy, /Guest chat/);
console.log("ok: Admin nav is Insights; privacy discloses guest chat topics");

const redacted = redactAnalyticsText(
  "Email ada@cinem.tech phone +1 (415) 555-0100 and https://secret.example/path",
);
assert.equal(redacted.includes("ada@cinem.tech"), false);
assert.equal(redacted.includes("@cinem.tech"), false);
assert.match(redacted, /\[email\]/);
assert.match(redacted, /\[phone\]/);
assert.match(redacted, /\[url\]/);
assert.doesNotMatch(redacted, /555-0100/);
assert.doesNotMatch(redacted, /secret\.example/);
console.log("ok: redact strips email, phone, and URL");

const topics = topicsFromUserText("Please refund my billing at ada@cinem.tech");
assert.ok(topics.includes("billing"));
assert.equal(topics.some((topic) => topic.includes("@")), false);
assert.deepEqual(classifyAnalyticsTopics(""), ["other"]);
console.log("ok: keyword topics from redacted text, no LLM");

const leak = payloadHasForbiddenAnalyticsKey({
  section: "insights",
  optIn: { users: 1 },
  email: "ada@cinem.tech",
});
assert.equal(leak, "email");
assert.equal(
  payloadHasForbiddenAnalyticsKey({
    section: "insights",
    optIn: { users: 0 },
    anonymous: { accounts: 2, logins: 0, signups: 0, workspacesByPlan: { demo: 1 } },
    topics: { support: [], guestChat: [] },
    errors: [],
  }),
  null,
);
console.log("ok: payload key guard rejects email and allows count widgets");

async function smokePrisma() {
  try {
    const prune = await pruneAnalyticsDetails();
    assert.equal(prune.deleted, 0);
    assert.equal(prune.skipped, true);

    const { getAdminInsights } = await import("../src/lib/analytics");
    const payload = await getAdminInsights();
    assert.equal(payload.section, "insights");
    assert.equal(payloadHasForbiddenAnalyticsKey(payload), null);
    assert.equal("email" in payload, false);
    assert.equal("body" in payload, false);
    assert.equal("content" in payload, false);
    const dumped = JSON.stringify(payload);
    assert.doesNotMatch(dumped, /@/);
    assert.doesNotMatch(dumped, /"body"/);
    assert.doesNotMatch(dumped, /"content"/);
    assert.doesNotMatch(dumped, /"email"/);

    const stamp = `${Date.now()}`;
    const email = `analytics-check-${stamp}@example.com`;
    const probeKey = `check_${stamp}`;
    const user = await prisma.user.create({
      data: { email, name: "Analytics Check", analyticsOptIn: false },
    });
    const before = await prisma.analyticsEvent.aggregate({ _sum: { count: true } });
    const beforeCount = before._sum.count ?? 0;
    const optedOut = await recordAnalytics({
      kind: "topic_support",
      key: probeKey,
      userId: user.id,
    });
    assert.equal(optedOut.recorded, false);
    const afterOut = await prisma.analyticsEvent.aggregate({ _sum: { count: true } });
    assert.equal(afterOut._sum.count ?? 0, beforeCount);

    const guest = await recordAnalytics({
      kind: "topic_guest",
      key: probeKey,
      planBucket: "guest",
    });
    assert.equal(guest.recorded, true);

    await prisma.user.update({
      where: { id: user.id },
      data: { analyticsOptIn: true, analyticsOptedAt: new Date() },
    });
    const optedIn = await recordAnalytics({
      kind: "topic_support",
      key: probeKey,
      userId: user.id,
      planBucket: "demo",
    });
    assert.equal(optedIn.recorded, true);

    await prisma.user.delete({ where: { id: user.id } });
    await prisma.analyticsEvent.deleteMany({
      where: { key: probeKey },
    });
    console.log("ok: opt-out no-op; guest emit without userId; insights payload has no PII");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /Can't reach database server|P1001|P1017|ECONNREFUSED|does not exist|DATABASE_URL|P2021|P2022/i.test(
        message,
      )
    ) {
      console.log("skip: Postgres analytics privacy smoke (start docker compose or migrate)");
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

smokePrisma()
  .then(() => console.log("Analytics privacy checks passed."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
