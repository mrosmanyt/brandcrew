/**
 * Display-model catalog: UI names vs cheap backend ids.
 * No paid API calls.
 */
import assert from "node:assert/strict";
import {
  DISPLAY_MODELS,
  DISPLAY_TO_BACKEND_MAP,
  catalogByProviderModelId,
  describeProviderModel,
  geminiFlashModelId,
  gptTerraModelId,
  haikuModelId,
  providerModelIdFor,
  publicModelLabel,
  refuseOpusModel,
  sonnetMaxModelId,
  sonnetModelId,
} from "../src/lib/model-catalog";
import { normalizeModelRouting } from "../src/lib/llm-routing";

assert.deepEqual(
  DISPLAY_MODELS.map((row) => row.displayName),
  ["Opus 4.8", "Fable 5.1", "GPT Astra", "Gemini 3.8 Flash"],
);
assert.equal(DISPLAY_TO_BACKEND_MAP[0].backendClass, "haiku");
assert.equal(DISPLAY_TO_BACKEND_MAP[1].backendClass, "sonnet");
assert.equal(DISPLAY_TO_BACKEND_MAP[2].backendClass, "terra");
assert.equal(DISPLAY_TO_BACKEND_MAP[3].backendClass, "flash");
assert.equal(providerModelIdFor("opus-4.8"), haikuModelId());
assert.equal(providerModelIdFor("fable-5.1"), sonnetModelId());
assert.equal(providerModelIdFor("gpt-astra"), gptTerraModelId());
assert.equal(providerModelIdFor("gemini-3.8-flash"), geminiFlashModelId());
assert.equal(gptTerraModelId(), "gpt-4o-mini");
assert.equal(geminiFlashModelId(), "gemini-2.5-flash");
console.log("ok: catalog maps 4 display names to cheap backends");

assert.equal(normalizeModelRouting("opus-4.8"), "opus-4.8");
assert.equal(normalizeModelRouting("gemini"), "gemini-3.8-flash");
assert.equal(normalizeModelRouting("anthropic"), "opus-4.8");
assert.equal(normalizeModelRouting("openai"), "gpt-astra");
assert.equal(normalizeModelRouting("nope"), "auto");
console.log("ok: legacy routing ids coerce onto the catalog");

assert.equal(publicModelLabel("claude-haiku-4-5"), "Opus 4.8");
assert.equal(publicModelLabel("claude-sonnet-5"), "Fable 5.1");
assert.equal(publicModelLabel("gpt-4o-mini"), "GPT Astra");
assert.equal(publicModelLabel("gemini-2.5-flash"), "Gemini 3.8 Flash");
assert.equal(publicModelLabel("demo"), "Offline demo");
assert.equal(catalogByProviderModelId("claude-opus-4")?.displayName, "Opus 4.8");
const described = describeProviderModel("claude-haiku-4-5");
assert.equal(described.displayName, "Opus 4.8");
assert.equal(described.providerModelId, "claude-haiku-4-5");
console.log("ok: public labels never expose raw ids");

assert.equal(refuseOpusModel("claude-opus-4-6", "claude-sonnet-5"), "claude-sonnet-5");
assert.equal(refuseOpusModel("claude-sonnet-5", "x"), "claude-sonnet-5");

const savedBoost = process.env.ANTHROPIC_BOOST_MODEL;
const savedFinal = process.env.ANTHROPIC_FINAL_MODEL;
process.env.ANTHROPIC_BOOST_MODEL = "claude-opus-4";
assert.equal(sonnetMaxModelId(), "claude-sonnet-5");
process.env.ANTHROPIC_BOOST_MODEL = "claude-sonnet-5";
assert.equal(sonnetMaxModelId(), "claude-sonnet-5");
if (savedBoost) process.env.ANTHROPIC_BOOST_MODEL = savedBoost;
else delete process.env.ANTHROPIC_BOOST_MODEL;
if (savedFinal) process.env.ANTHROPIC_FINAL_MODEL = savedFinal;
else delete process.env.ANTHROPIC_FINAL_MODEL;
console.log("ok: Opus ids are refused even on Ultra/Boost env overrides");

console.log("Model catalog checks passed.");
