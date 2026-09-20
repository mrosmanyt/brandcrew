/**
 * Assistant Pro-only gate: helper contract + route coverage.
 * Fails if a meter/command Assistant route does not reference the helper.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASSISTANT_PRO_ONLY_SHIPPED_AT,
  ASSISTANT_PRO_REQUIRED_BODY,
  ASSISTANT_PRO_REQUIRED_CODE,
  ASSISTANT_PRO_REQUIRED_ERROR,
  ASSISTANT_SALES_WHATSAPP_E164,
  ASSISTANT_SALES_WHATSAPP_URL,
  assistantFreeCutoffAt,
  evaluateAssistantProAccess,
  hasAssistantProAccess,
  isAssistantFreeSunsetActive,
} from "../src/lib/assistant-pro-access";
import { usageSnapshot } from "../src/lib/cinem-ai-assistant";

const MUST_GATE = [
  "src/server/api/cinem-ai-assistant/usage.ts",
  "src/server/api/companion/command.ts",
  "src/server/api/companion/commands.ts",
  "src/server/api/assistant/whatsapp-link.ts",
];

const INTENTIONALLY_UNGATED = [
  "src/server/api/guest/chat.ts",
  "src/server/api/webhooks/whop.ts",
  "src/lib/billing-fulfill.ts",
  "src/lib/billing-events.ts",
  "src/server/api/downloads/cinem-ai-assistant.ts",
  "src/server/api/billing/assistant-checkout.ts",
  "src/server/api/auth/login.ts",
  "src/server/api/auth/signup.ts",
  "src/server/api/auth/token.ts",
];

const HELPER_RE = /assistant-pro-access|assertAssistantProAccess|hasAssistantProAccess|evaluateAssistantProAccess|loadAssistantProAccess|assistantProRequiredJson/;

assert.equal(ASSISTANT_PRO_REQUIRED_ERROR, "Pro required");
assert.equal(ASSISTANT_PRO_REQUIRED_CODE, "PRO_REQUIRED");
assert.deepEqual(ASSISTANT_PRO_REQUIRED_BODY, {
  error: "Pro required",
  code: "PRO_REQUIRED",
});
assert.equal(ASSISTANT_SALES_WHATSAPP_E164, "+923489057646");
assert.equal(ASSISTANT_SALES_WHATSAPP_URL, "https://wa.me/923489057646");
assert.equal(ASSISTANT_PRO_ONLY_SHIPPED_AT, "2026-09-20T18:40:00.000Z");
console.log("ok: Pro-required body + WhatsApp + ship timestamp");

const CUTOFF_ISO = "2026-09-27T18:40:00.000Z";
const beforeCutoff = new Date("2026-09-21T00:00:00.000Z");
const afterCutoff = new Date("2026-09-28T00:00:00.000Z");
const farFuture = new Date("2030-01-01T00:00:00.000Z");

function withCutoffEnv(value: string | undefined, fn: () => void) {
  const prev = process.env.ASSISTANT_FREE_CUTOFF_AT;
  if (value === undefined) delete process.env.ASSISTANT_FREE_CUTOFF_AT;
  else process.env.ASSISTANT_FREE_CUTOFF_AT = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.ASSISTANT_FREE_CUTOFF_AT;
    else process.env.ASSISTANT_FREE_CUTOFF_AT = prev;
  }
}

withCutoffEnv(undefined, () => {
  assert.equal(assistantFreeCutoffAt(), null);
  assert.equal(isAssistantFreeSunsetActive(farFuture), false);
  const unset = evaluateAssistantProAccess({ plan: "demo" }, farFuture);
  assert.equal(unset.allowed, true);
  assert.equal(unset.reason, "legacy_free");
  assert.equal(unset.proRequired, false);
  assert.equal(unset.sunsetBanner, true);
  assert.equal(unset.cutoffAt, null);
});
withCutoffEnv("", () => {
  assert.equal(assistantFreeCutoffAt(), null);
  assert.equal(evaluateAssistantProAccess({ plan: "demo" }, farFuture).allowed, true);
});
withCutoffEnv("not-a-date", () => {
  assert.equal(assistantFreeCutoffAt(), null);
  assert.equal(isAssistantFreeSunsetActive(farFuture), false);
});
console.log("ok: unset/empty/invalid ASSISTANT_FREE_CUTOFF_AT does not hard-lock");

const paidFixtures = [
  { plan: "starter", label: "desk starter (Pro $20)" },
  { plan: "pro", label: "desk pro (Pro Plus)" },
  { plan: "ultra", label: "desk ultra" },
] as const;

for (const row of paidFixtures) {
  assert.equal(hasAssistantProAccess({ plan: row.plan }), true, row.label);
  const access = evaluateAssistantProAccess({ plan: row.plan }, afterCutoff);
  assert.equal(access.allowed, true, `${row.label} allowed after cutoff`);
  assert.equal(access.pro, true, `${row.label} is Pro`);
  assert.equal(access.proRequired, false, `${row.label} never PRO_REQUIRED`);
  const snap = usageSnapshot({
    plan: row.plan,
    used: 10,
    upgradeUrl: "/billing",
    pro: true,
    includedWithPlan: true,
  });
  assert.equal(snap.allowed, true, `${row.label} snapshot allowed`);
  assert.equal(snap.proRequired, false, `${row.label} snapshot not locked`);
}
console.log("ok: desk starter / pro / ultra never false-lock");

assert.equal(hasAssistantProAccess({ assistantFoundingMember: true, plan: "demo" }), true);
const founding = evaluateAssistantProAccess(
  { assistantFoundingMember: true, plan: "demo" },
  afterCutoff,
);
assert.equal(founding.allowed, true);
assert.equal(founding.reason, "founding");
assert.equal(founding.proRequired, false);
const foundingSnap = usageSnapshot({
  plan: "demo",
  used: 10,
  upgradeUrl: "/billing",
  foundingMember: true,
  includedWithPlan: true,
  pro: true,
});
assert.equal(foundingSnap.allowed, true);
assert.equal(foundingSnap.proRequired, false);
console.log("ok: founding member never false-lock");

assert.equal(hasAssistantProAccess({ plan: "demo" }), false);

withCutoffEnv(CUTOFF_ISO, () => {
  const parsed = assistantFreeCutoffAt();
  assert.ok(parsed);
  assert.equal(parsed.toISOString(), CUTOFF_ISO);
  assert.equal(isAssistantFreeSunsetActive(beforeCutoff), false);
  assert.equal(isAssistantFreeSunsetActive(afterCutoff), true);

  const legacy = evaluateAssistantProAccess({ plan: "demo" }, beforeCutoff);
  assert.equal(legacy.allowed, true);
  assert.equal(legacy.reason, "legacy_free");
  assert.equal(legacy.sunsetBanner, true);
  assert.equal(legacy.cutoffAt, CUTOFF_ISO);

  const locked = evaluateAssistantProAccess({ plan: "demo" }, afterCutoff);
  assert.equal(locked.allowed, false);
  assert.equal(locked.proRequired, true);
  assert.equal(locked.code, "PRO_REQUIRED");

  const referral = evaluateAssistantProAccess(
    { plan: "demo", referralBonusMonths: 2 },
    afterCutoff,
  );
  assert.equal(referral.allowed, true);
  assert.equal(referral.reason, "referral_bonus");

  const activeSub = evaluateAssistantProAccess(
    {
      plan: "demo",
      subscription: { status: "active", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") },
    },
    afterCutoff,
  );
  assert.equal(activeSub.allowed, true);
  assert.equal(activeSub.reason, "assistant_subscription");

  const expiredSub = evaluateAssistantProAccess(
    {
      plan: "demo",
      subscription: { status: "active", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z") },
    },
    afterCutoff,
  );
  assert.equal(expiredSub.allowed, false);
  assert.equal(expiredSub.proRequired, true);

  const cancelledSub = evaluateAssistantProAccess(
    {
      plan: "demo",
      subscription: { status: "cancelled", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") },
    },
    afterCutoff,
  );
  assert.equal(cancelledSub.allowed, false);
  assert.equal(cancelledSub.proRequired, true);
});

withCutoffEnv(undefined, () => {
  const expiredUnset = evaluateAssistantProAccess(
    {
      plan: "demo",
      subscription: { status: "active", currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z") },
    },
    afterCutoff,
  );
  assert.equal(expiredUnset.allowed, true);
  assert.equal(expiredUnset.reason, "legacy_free");
  const cancelledUnset = evaluateAssistantProAccess(
    {
      plan: "demo",
      subscription: { status: "cancelled", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") },
    },
    afterCutoff,
  );
  assert.equal(cancelledUnset.allowed, true);
  assert.equal(cancelledUnset.reason, "legacy_free");
});
console.log("ok: sunset / referral / subscription evaluation");

for (const path of MUST_GATE) {
  const src = readFileSync(path, "utf8");
  assert.match(src, HELPER_RE, `${path} must reference the Pro access helper`);
}
console.log("ok: usage + assistant command routes reference helper");

for (const path of INTENTIONALLY_UNGATED) {
  const src = readFileSync(path, "utf8");
  assert.doesNotMatch(
    src,
    /assertAssistantProAccessForUser|assertAssistantProAccess\(/,
    `${path} must stay ungated`,
  );
}
assert.doesNotMatch(readFileSync("src/server/api/guest/chat.ts", "utf8"), /assistant-pro-access/);
console.log("ok: guest chat, Whop webhook, downloads, checkout, auth stay ungated");

const lock = readFileSync("apps/cinem-ai-assistant/src/components/gate/AssistantProLock.tsx", "utf8");
assert.match(lock, /PAYMENT CHECK \/ REFRESH/);
assert.match(lock, /WhatsApp|WHATSAPP/);
assert.doesNotMatch(lock, /NOT NOW|Dismiss|onClose/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/lib/orchestrator.ts", "utf8"), /hasClientAssistantAccess/);
console.log("ok: desktop lock cannot dismiss; orchestrator checks Pro before consumeTurn");

console.log("check-assistant-pro-gate: OK");
