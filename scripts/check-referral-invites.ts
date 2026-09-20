/**
 * Referral invite redemption — signup bonus months and abuse caps.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REFERRAL_BONUS_MONTHS_DEFAULT,
  REFERRAL_INVITER_CAP,
  REFERRAL_TURNS_PER_MONTH,
  referralBonusTurns,
} from "../src/lib/referral-invites";
import { usageSnapshot } from "../src/lib/cinem-ai-assistant";

assert.equal(REFERRAL_BONUS_MONTHS_DEFAULT, 1);
assert.equal(REFERRAL_INVITER_CAP, 50);
assert.equal(referralBonusTurns(2), REFERRAL_TURNS_PER_MONTH * 2);

const snap = usageSnapshot({
  plan: "demo",
  used: 10,
  upgradeUrl: "/billing",
  referralBonusMonths: 1,
});
assert.equal(snap.limit, 500 + REFERRAL_TURNS_PER_MONTH);
assert.equal(snap.remaining, snap.limit - 10);

const gated = usageSnapshot({
  plan: "demo",
  used: 0,
  upgradeUrl: "/billing",
  gatePaidOnly: true,
  referralBonusMonths: 0,
});
assert.equal(gated.limit, 0);
assert.equal(gated.allowed, false);

const redeem = readFileSync("src/lib/referral-invites.ts", "utf8");
assert.doesNotMatch(redeem, /referralBonusMonths:\s*\{\s*increment/);
assert.match(redeem, /inviterBonusMonths:\s*0/);
assert.match(redeem, /inviteeBonusMonths:\s*0/);

console.log("check-referral-invites: OK");
