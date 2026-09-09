/**
 * Marketing fundraising banner: raising (not raised), marketing chrome only.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANNOUNCEMENT_DISMISS_KEY,
  FOUNDER_EMAIL,
  FOUNDER_MAILTO,
} from "../src/lib/site";

assert.equal(FOUNDER_EMAIL, "cinemtech@gmail.com");
assert.equal(FOUNDER_MAILTO, "mailto:cinemtech@gmail.com");
assert.equal(ANNOUNCEMENT_DISMISS_KEY, "cinem_announce_raise_1m");
assert.doesNotMatch(ANNOUNCEMENT_DISMISS_KEY, /brandcrew_session|session_token/);
console.log("ok: founder mailto + dismiss key are public marketing constants");

const banner = readFileSync("src/components/marketing/announcement-banner.tsx", "utf8");
assert.match(banner, /"use client"/);
assert.match(banner, /raising a \$1M round to build the AI employee desk/);
assert.doesNotMatch(banner, /\$5M/);
assert.match(banner, /Talk to the founder/);
assert.match(banner, /FOUNDER_MAILTO|mailto:cinemtech@gmail\.com/);
assert.match(banner, /ANNOUNCEMENT_DISMISS_KEY|localStorage/);
assert.match(banner, /Dismiss announcement/);
assert.doesNotMatch(banner, /we raised|round is closed|we've raised|has been raised/i);
assert.doesNotMatch(banner, /80k\+?\s*users|80,000\s*users/i);
assert.doesNotMatch(banner, /prisma|getCurrentUser|\/api\/billing/);
console.log("ok: banner copy is seeking (raising), dismissible, founder mailto");

const shell = readFileSync("src/components/marketing/marketing-shell.tsx", "utf8");
assert.match(shell, /AnnouncementBanner/);
console.log("ok: MarketingShell mounts the banner on public chrome");

const nav = readFileSync("src/components/marketing/site-nav.tsx", "utf8");
assert.match(nav, /--announce-h/);
console.log("ok: SiteNav sits below the banner while it is visible");

const home = readFileSync("src/app/page.tsx", "utf8");
assert.match(home, /MarketingShell/);
assert.match(home, /SiteNav/);
console.log("ok: homepage uses marketing chrome (banner + nav)");

const deskLayout = readFileSync("src/app/desk/[workspaceId]/layout.tsx", "utf8");
const deskIndex = readFileSync("src/app/desk/page.tsx", "utf8");
const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
for (const [name, text] of [
  ["desk layout", deskLayout],
  ["desk index", deskIndex],
  ["admin layout", adminLayout],
] as const) {
  assert.doesNotMatch(text, /AnnouncementBanner|MarketingShell/, `${name} must not mount the marketing banner`);
}
console.log("ok: logged-in desk and admin do not mount the marketing banner");

console.log("Announcement banner checks passed.");
