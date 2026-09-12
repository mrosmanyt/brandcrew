/**
 * Desk Agent modes: glow / Starting shine / plan+routing helpers.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGENT_MODE_PLANS,
  AGENT_MODES_SHORTCUT,
  MODEL_ROUTING_GROUPS,
  MODEL_ROUTING_OPTIONS,
  SERVER_KEYS_COPY,
  deskChatGlowClass,
  deskChatIsEmpty,
  jobWorkingLabel,
  modelRoutingLabel,
  modelRoutingLocked,
  nextAgentModePlan,
  nextModelRouting,
  planApplyAction,
  planModeDescription,
  planModeName,
  planPowerLabel,
} from "../src/lib/agent-modes";
import { pickRoute, runWithRoutingPreference } from "../src/lib/llm";

assert.deepEqual(AGENT_MODE_PLANS, ["demo", "starter", "pro", "ultra"]);
assert.equal(planModeName("demo"), "Free");
assert.equal(planModeName("growth"), "Pro Plus");
assert.equal(planPowerLabel("pro"), "Power");
assert.equal(planPowerLabel("ultra"), "Max");
assert.equal(planPowerLabel("demo"), null);
assert.match(planModeDescription("demo"), /15,000 tokens/);
assert.match(planModeDescription("starter"), /50,000 tokens/);
assert.match(planModeDescription("pro"), /Power/);
assert.match(planModeDescription("ultra"), /Max/);
assert.equal(nextAgentModePlan("demo"), "starter");
assert.equal(nextAgentModePlan("ultra"), "demo");
assert.equal(planApplyAction("demo", "demo", true), "noop");
assert.equal(planApplyAction("pro", "demo", true), "mock-apply");
assert.equal(planApplyAction("demo", "pro", false), "open-plans");
assert.equal(planApplyAction("ultra", "demo", false), "checkout");
console.log("ok: plan rows map Free/Pro/Pro Plus/Ultra with honest apply actions");

assert.equal(modelRoutingLabel("auto"), "Auto");
assert.equal(modelRoutingLocked("auto", { openai: false, anthropic: false, gemini: false }), false);
assert.equal(modelRoutingLocked("gemini-3.8-flash", { openai: true, anthropic: true, gemini: false }), true);
assert.equal(modelRoutingLocked("opus-4.8", { openai: false, anthropic: true, gemini: false }), false);
assert.equal(modelRoutingLocked("gpt-astra", { openai: false, anthropic: true, gemini: true }), true);
assert.equal(modelRoutingLocked("cinem-super-4.8", { openai: true, anthropic: false, gemini: true }), true);
assert.ok(MODEL_ROUTING_OPTIONS.length >= 8);
assert.equal(MODEL_ROUTING_OPTIONS[0].label, "Auto");
assert.ok(MODEL_ROUTING_OPTIONS.some((row) => row.label === "GPT 4.0 mini"));
assert.ok(MODEL_ROUTING_OPTIONS.some((row) => row.label === "GPT Sol"));
assert.ok(MODEL_ROUTING_OPTIONS.some((row) => row.label === "Claude Sonnet 5"));
assert.ok(MODEL_ROUTING_OPTIONS.some((row) => row.label === "Cinem super 4.8"));
assert.ok(MODEL_ROUTING_OPTIONS.some((row) => row.label === "Gemini Flash 3.8"));
assert.equal(MODEL_ROUTING_OPTIONS.some((row) => row.label === "Claude Opus"), false);
assert.equal(MODEL_ROUTING_OPTIONS.some((row) => row.label === "Claude Haiku"), false);
assert.equal(MODEL_ROUTING_OPTIONS.some((row) => row.label === "Gemini Flash"), false);
assert.ok(MODEL_ROUTING_OPTIONS.some((row) => row.hint.includes("Picks the best model")));
assert.deepEqual(
  MODEL_ROUTING_GROUPS.map((row) => row.label),
  [null, "Fastest and quick answer", "For complex", "Most advanced"],
);
assert.equal(nextModelRouting("auto"), "claude-sonnet");
assert.equal(nextModelRouting("cinem-super-4.8"), "auto");
assert.match(SERVER_KEYS_COPY, /server/);
assert.match(AGENT_MODES_SHORTCUT, /Ctrl Shift I/);
console.log("ok: routing options lock when the server key is missing");

assert.equal(jobWorkingLabel("queued"), "Starting…");
assert.equal(jobWorkingLabel("running"), "Working…");
assert.equal(deskChatIsEmpty({ messageCount: 0, hasDraft: false }), true);
assert.equal(deskChatIsEmpty({ messageCount: 1, hasDraft: false }), false);
assert.equal(deskChatIsEmpty({ messageCount: 0, hasDraft: true }), false);
assert.equal(deskChatGlowClass(true), "desk-chat-glow");
assert.match(deskChatGlowClass(false), /desk-chat-glow-soft/);
console.log("ok: empty glow vs Starting labels");

const KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "XAI_API_KEY",
] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
for (const key of KEYS) delete process.env[key];
process.env.OPENAI_API_KEY = "sk-openai-fake";
process.env.ANTHROPIC_API_KEY = "sk-ant-fake";
process.env.GEMINI_API_KEY = "gemini-fake";
assert.equal(pickRoute("draft", "general", "openai")?.provider, "openai");
assert.equal(pickRoute("draft", "general", "gemini")?.provider, "gemini");
assert.equal(pickRoute("draft", "general", "anthropic")?.model, "claude-haiku-4-5");
assert.equal(
  runWithRoutingPreference("openai", () => pickRoute("draft")?.provider),
  "openai",
);
delete process.env.GEMINI_API_KEY;
assert.equal(pickRoute("draft", "website", "gemini")?.provider, "openai");
for (const key of KEYS) {
  if (saved[key]) process.env[key] = saved[key];
  else delete process.env[key];
}
console.log("ok: prefer Gemini/Claude/OpenAI when keyed; otherwise default router");

const css = readFileSync("src/app/globals.css", "utf8");
assert.match(css, /\.desk-chat-glow\s*\{/);
assert.match(css, /\.desk-chat-glow-soft/);
assert.match(css, /\.desk-starting-shine/);
assert.match(css, /prefers-reduced-motion[\s\S]*desk-starting-shine/);
console.log("ok: glow + shine CSS and reduced-motion static text");

const composer = readFileSync("src/components/desk/chat-composer.tsx", "utf8");
assert.match(composer, /AgentModesMenu/);
assert.match(composer, /nextModelRouting/);
assert.doesNotMatch(composer, /JobStartingStatus/);
assert.doesNotMatch(composer, /nextAgentModePlan/);
assert.doesNotMatch(composer, /bring your own key/i);
const menu = readFileSync("src/components/desk/agent-modes-menu.tsx", "utf8");
assert.match(menu, /Use server API keys/);
assert.match(menu, /Add key on server/);
assert.match(menu, /MODEL_ROUTING_GROUPS/);
assert.match(menu, /modelRoutingLabel/);
assert.match(menu, /text-\[13px\]/);
assert.doesNotMatch(menu, /AGENT_MODE_PLANS/);
assert.doesNotMatch(menu, /planModeCaption/);
assert.doesNotMatch(menu, /Prefer Gemini|Prefer Claude/);
const catalog = readFileSync("src/lib/model-catalog.ts", "utf8");
assert.match(catalog, /Opus 4.8/);
assert.match(catalog, /Fable 5.1/);
assert.match(catalog, /GPT Astra/);
assert.match(catalog, /Gemini Flash 3.8/);
assert.match(catalog, /GPT 4.0 mini/);
assert.match(catalog, /GPT Sol/);
assert.match(catalog, /Cinem super 4.8/);
assert.match(catalog, /Claude Sonnet 5/);
assert.doesNotMatch(catalog, /displayName: "Claude Opus"/);
assert.doesNotMatch(catalog, /displayName: "Gemini Flash"/);
const mid = readFileSync("src/components/desk/mission-control.tsx", "utf8");
assert.match(mid, /deskChatGlowClass/);
assert.match(mid, /JobStartingStatus/);
console.log("ok: composer menu and Mission Control glow/status are wired");

console.log("Desk modes checks passed.");
