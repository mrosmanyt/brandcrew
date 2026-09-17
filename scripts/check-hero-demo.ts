/**
 * Homepage hero demo: CINEM-branded loop, no third-party brand lift.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HERO_DEMO_AGENT_NAME,
  HERO_DEMO_ARTIFACT,
  HERO_DEMO_CAST,
  HERO_DEMO_LOOP_MS,
  HERO_DEMO_PLAN_COPY,
  HERO_DEMO_PLAN_STEPS,
  HERO_DEMO_PROMPT,
  HERO_DEMO_SITE,
  HERO_DEMO_STATIC_MS,
  heroDemoComposerText,
  heroDemoJobStatus,
  heroDemoPhaseAt,
  heroDemoPlanCount,
  heroDemoReached,
  heroDemoToolLines,
  heroDemoTypedPrompt,
} from "../src/lib/hero-demo";

assert.ok(HERO_DEMO_LOOP_MS >= 15_000 && HERO_DEMO_LOOP_MS <= 40_000);
assert.ok(HERO_DEMO_STATIC_MS < HERO_DEMO_LOOP_MS);
assert.equal(heroDemoPhaseAt(0), "idle");
assert.equal(heroDemoPhaseAt(1_200), "typing");
assert.equal(heroDemoPhaseAt(5_000), "plan");
assert.equal(heroDemoPhaseAt(11_000), "kit");
assert.equal(heroDemoPhaseAt(14_000), "browse");
assert.equal(heroDemoPhaseAt(18_000), "write");
assert.equal(heroDemoPhaseAt(22_000), "artifacts");
assert.equal(heroDemoPhaseAt(25_000), "approve");
assert.equal(heroDemoPhaseAt(28_400), "website");
assert.equal(heroDemoPhaseAt(HERO_DEMO_STATIC_MS), "website");
assert.equal(heroDemoPhaseAt(31_000), "hold");
assert.equal(heroDemoPhaseAt(HERO_DEMO_LOOP_MS), "idle");
assert.equal(heroDemoPhaseAt(HERO_DEMO_LOOP_MS + 5_000), "plan");
console.log("ok: loop stays in 15–40s and phases teach plan → tools → approve");

assert.equal(heroDemoTypedPrompt(0), "");
assert.ok(heroDemoTypedPrompt(1_800).length > 0);
assert.ok(heroDemoTypedPrompt(1_800).length < HERO_DEMO_PROMPT.length);
assert.equal(heroDemoTypedPrompt(3_600), HERO_DEMO_PROMPT);
assert.equal(heroDemoComposerText(8_000), "");
assert.ok(heroDemoPlanCount(8_000) >= 3);
assert.equal(heroDemoPlanCount(10_000), HERO_DEMO_PLAN_STEPS.length);
assert.equal(heroDemoJobStatus("typing"), "idle");
assert.equal(heroDemoJobStatus("kit"), "running");
assert.equal(heroDemoJobStatus("approve"), "needs_you");
assert.ok(heroDemoReached("approve", "artifacts"));
assert.equal(heroDemoToolLines("write").length, 3);
assert.equal(heroDemoToolLines("approve").at(-1)?.tone, "wait");
console.log("ok: typing, plan reveal, and tool lines follow the desk story");

assert.match(HERO_DEMO_PROMPT, /LinkedIn week for Northline/);
assert.match(HERO_DEMO_PLAN_COPY, /Brand Kit/);
assert.match(HERO_DEMO_PLAN_COPY, /approval/);
assert.match(HERO_DEMO_ARTIFACT.title, /LinkedIn/);
assert.equal(HERO_DEMO_AGENT_NAME, "New Agent");
assert.equal(HERO_DEMO_CAST.length, 4);
assert.ok(HERO_DEMO_CAST.every((row) => row.spec.shape && row.spec.eyeGap));
assert.match(HERO_DEMO_SITE.kicker, /not published/i);
console.log("ok: copy is CINEM desk language with geometric agent cast");

const banned =
  /strawberry|simon|elevenlabs|lovable|anthropic mascot|tasting menu of a browser/i;
const files = [
  "src/lib/hero-demo.ts",
  "src/components/marketing/hero-demo.tsx",
  "src/app/about/page.tsx",
];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(text, banned);
  assert.doesNotMatch(text, /strawberrybrowser|cdn\.strawberry/i);
}
console.log("ok: demo files do not lift Strawberry branding or video");

const page = readFileSync("src/app/about/page.tsx", "utf8");
assert.match(page, /HeroDemo/);
assert.doesNotMatch(page, /ProductShot/);
assert.match(page, /Hire agents/);
assert.match(page, /Approve the work/);
console.log("ok: landing keeps CINEM hero copy and mounts the looping demo");

const css = readFileSync("src/app/globals.css", "utf8");
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /\.hero-demo-pop/);
assert.match(css, /\.mkt-hero-demo/);
assert.match(css, /\.hero-demo\.is-static/);
console.log("ok: reduced-motion CSS holds the static end frame");

const component = readFileSync("src/components/marketing/hero-demo.tsx", "utf8");
assert.match(component, /prefers-reduced-motion/);
assert.match(component, /HERO_DEMO_STATIC_MS/);
assert.match(component, /Approve/);
assert.match(component, /Website Builder/);
assert.match(component, /read_brand_kit|Brand Kit/);
console.log("ok: component loops tools and pauses on Approve");

console.log("Hero demo checks passed.");
