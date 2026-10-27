/**
 * Display-model catalog: UI names vs cheap backend ids.
 * No paid API calls.
 */
import assert from "node:assert/strict";
import {
  DISPLAY_MODELS,
  DISPLAY_TO_BACKEND_MAP,
  PICKER_GROUPS,
  PICKER_MODELS,
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

const names = DISPLAY_MODELS.map((row) => row.displayName);
assert.ok(names.includes("Opus 4.8"));
assert.ok(names.includes("Fable 5.1"));
assert.ok(names.includes("GPT Astra"));
assert.ok(names.includes("Gemini Flash 3.8"));
assert.ok(names.includes("GPT 4.0 mini"));
assert.ok(names.includes("GPT Sol"));
assert.ok(names.includes("Claude Sonnet 5"));
assert.ok(names.includes("Cinem super 4.8"));
assert.ok(names.includes("Claude Haiku"));
assert.equal(names.includes("Claude Opus"), false);
assert.equal(names.includes("Gemini Flash"), false);
assert.deepEqual(
  PICKER_GROUPS.map((row) => row.label),
  ["Fastest and quick answer", "For complex", "Most advanced"],
);
assert.deepEqual(
  PICKER_MODELS.filter((row) => row.pickerGroup === "fastest").map((row) => row.displayName),
  ["Claude Sonnet 5", "GPT 4.0 mini"],
);
assert.deepEqual(
  PICKER_MODELS.filter((row) => row.pickerGroup === "complex").map((row) => row.displayName),
  ["Opus 4.8", "GPT Sol", "Gemini Flash 3.8"],
);
assert.deepEqual(
  PICKER_MODELS.filter((row) => row.pickerGroup === "advanced").map((row) => row.displayName),
  ["GPT Astra", "Fable 5.1", "Cinem super 4.8"],
);
assert.equal(PICKER_MODELS.some((row) => row.id === "claude-haiku"), false);
assert.equal(DISPLAY_MODELS.length, 9);
assert.equal(
  DISPLAY_TO_BACKEND_MAP.filter((row) => row.backendClass === "terra").length,
  3,
);
assert.equal(providerModelIdFor("opus-4.8"), haikuModelId());
assert.equal(providerModelIdFor("claude-haiku"), haikuModelId());
assert.equal(providerModelIdFor("fable-5.1"), sonnetModelId());
assert.equal(providerModelIdFor("claude-sonnet"), sonnetModelId());
assert.equal(providerModelIdFor("cinem-super-4.8"), sonnetMaxModelId());
assert.equal(providerModelIdFor("gpt-astra"), gptTerraModelId());
assert.equal(providerModelIdFor("gpt-4o-mini"), gptTerraModelId());
assert.equal(providerModelIdFor("gpt-sol"), gptTerraModelId());
assert.equal(providerModelIdFor("gemini-3.8-flash"), geminiFlashModelId());
assert.equal(gptTerraModelId(), "gpt-4o-mini");
assert.equal(geminiFlashModelId(), "gemini-2.5-flash");
console.log("ok: catalog maps named aliases onto cheap backends");

assert.equal(normalizeModelRouting("opus-4.8"), "opus-4.8");
assert.equal(normalizeModelRouting("claude-opus"), "opus-4.8");
assert.equal(normalizeModelRouting("gpt-4o-mini"), "gpt-4o-mini");
assert.equal(normalizeModelRouting("gpt-sol"), "gpt-sol");
assert.equal(normalizeModelRouting("gemini-flash"), "gemini-3.8-flash");
assert.equal(normalizeModelRouting("gemini"), "gemini-3.8-flash");
assert.equal(normalizeModelRouting("anthropic"), "opus-4.8");
assert.equal(normalizeModelRouting("openai"), "gpt-astra");
assert.equal(normalizeModelRouting("cinem-super-4.8"), "cinem-super-4.8");
assert.equal(normalizeModelRouting("claude-haiku"), "claude-haiku");
assert.equal(normalizeModelRouting("nope"), "auto");
console.log("ok: legacy routing ids coerce onto the catalog");

assert.equal(publicModelLabel("claude-haiku-4-5"), "Opus 4.8");
assert.equal(publicModelLabel("claude-sonnet-5"), "Fable 5.1");
assert.equal(publicModelLabel("gpt-4o-mini"), "GPT Astra");
assert.equal(publicModelLabel("gemini-2.5-flash"), "Gemini Flash 3.8");
assert.equal(publicModelLabel("demo"), "Offline templates");
assert.equal(catalogByProviderModelId("claude-opus-4")?.displayName, "Opus 4.8");
const described = describeProviderModel("claude-haiku-4-5");
assert.equal(described.displayName, "Opus 4.8");
assert.equal(described.providerModelId, "claude-haiku-4-5");
assert.doesNotMatch(displayHint("cinem-super-4.8"), /Claude|GPT|Gemini|OpenAI|Anthropic/i);
console.log("ok: public labels never expose raw ids");

assert.equal(refuseOpusModel("claude-opus-4-6", "claude-sonnet-5"), "claude-sonnet-5");
assert.equal(refuseOpusModel("claude-sonnet-5", "x"), "claude-sonnet-5");

const savedBoost = process.env.ANTHROPIC_BOOST_MODEL;
const savedFinal = process.env.ANTHROPIC_FINAL_MODEL;
process.env.ANTHROPIC_BOOST_MODEL = "claude-opus-4";
assert.equal(sonnetMaxModelId(), "claude-sonnet-5");
process.env.ANTHROPIC_BOOST_MODEL = "claude-sonnet-5";
assert.equal(sonnetMaxModelId(), "claude-sonnet-5");
assert.equal(providerModelIdFor("cinem-super-4.8"), "claude-sonnet-5");
if (savedBoost) process.env.ANTHROPIC_BOOST_MODEL = savedBoost;
else delete process.env.ANTHROPIC_BOOST_MODEL;
if (savedFinal) process.env.ANTHROPIC_FINAL_MODEL = savedFinal;
else delete process.env.ANTHROPIC_FINAL_MODEL;
console.log("ok: Opus ids are refused even on Ultra/Boost env overrides");

function displayHint(id: string) {
  return DISPLAY_MODELS.find((row) => row.id === id)?.hint ?? "";
}

console.log("Model catalog checks passed.");
