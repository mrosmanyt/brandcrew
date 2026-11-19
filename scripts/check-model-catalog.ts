/**
 * Display-model catalog: picker names must be the models that get called.
 * No paid API calls.
 *
 * Honesty rules asserted here:
 * - Every picker entry's display identity matches its routed backend:
 *   providerModelIdFor(id) resolves through the entry's OWN provider env
 *   to the real model the name states.
 * - The "Fast" group holds exactly the cheaper draft models (plus Grok 3
 *   Mini, xAI's only wired model); full models sit in "Most advanced".
 * - Grok is present in the catalog and in routing (routingProvider → xai).
 * - No retired marketing names remain as entries, and the public label
 *   for a backend model id is that model's truthful picker name.
 * - Retired ids coerce via LEGACY_ROUTING to the entry whose backend they
 *   actually executed under the old map.
 *
 * Identity-rule note: the assistant's chat OUTPUT still never names
 * providers (language-policy). The picker is product UI and the owner
 * explicitly decided it shows real model names — so display names here
 * ARE the real model names. Hints stay provider-free (asserted below).
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
  geminiProModelId,
  gptTerraModelId,
  haikuModelId,
  openaiFinalModelId,
  providerModelIdFor,
  publicModelLabel,
  refuseOpusModel,
  sonnetMaxModelId,
  sonnetModelId,
  xaiModelId,
} from "../src/lib/model-catalog";
import {
  LLM_ROUTING_PREFERENCES,
  normalizeModelRouting,
  routingProvider,
} from "../src/lib/llm-routing";

const names = DISPLAY_MODELS.map((row) => row.displayName);
assert.deepEqual(names, [
  "Claude Sonnet 5",
  "GPT-4.1",
  "Gemini 2.5 Pro",
  "Claude Haiku 4.5",
  "GPT-4o mini",
  "Gemini 2.5 Flash",
  "Grok 3 Mini",
]);
// Retired marketing names must never come back as picker entries.
for (const retired of [
  "Opus 4.8",
  "Fable 5.1",
  "GPT Astra",
  "GPT Sol",
  "Gemini Flash 3.8",
  "Cinem super 4.8",
  "GPT 4.0 mini",
  "Claude Haiku",
  "Claude Opus",
  "Gemini Flash",
]) {
  assert.equal(names.includes(retired), false, `retired name still present: ${retired}`);
}
assert.deepEqual(
  PICKER_GROUPS.map((row) => row.label),
  ["Fast — quick answers, lower cost", "Most advanced"],
);
assert.deepEqual(
  PICKER_MODELS.filter((row) => row.pickerGroup === "fastest").map((row) => row.displayName),
  ["Claude Haiku 4.5", "GPT-4o mini", "Gemini 2.5 Flash", "Grok 3 Mini"],
);
assert.deepEqual(
  PICKER_MODELS.filter((row) => row.pickerGroup === "advanced").map((row) => row.displayName),
  ["Claude Sonnet 5", "GPT-4.1", "Gemini 2.5 Pro"],
);
assert.equal(DISPLAY_MODELS.length, 7);
assert.equal(PICKER_MODELS.length, 7);
console.log("ok: picker lists real models — Fast drafts vs Most advanced full models");

// Every entry's routed backend is the model its name states.
assert.equal(providerModelIdFor("claude-sonnet"), sonnetModelId());
assert.equal(providerModelIdFor("claude-haiku"), haikuModelId());
assert.equal(providerModelIdFor("gpt-4.1"), openaiFinalModelId());
assert.equal(providerModelIdFor("gpt-4o-mini"), gptTerraModelId());
assert.equal(providerModelIdFor("gemini-2.5-pro"), geminiProModelId());
assert.equal(providerModelIdFor("gemini-2.5-flash"), geminiFlashModelId());
assert.equal(providerModelIdFor("grok-3-mini"), xaiModelId());
assert.equal(sonnetModelId(), "claude-sonnet-5");
assert.equal(haikuModelId(), "claude-haiku-4-5");
assert.equal(openaiFinalModelId(), "gpt-4.1");
assert.equal(gptTerraModelId(), "gpt-4o-mini");
assert.equal(geminiProModelId(), "gemini-2.5-pro");
assert.equal(geminiFlashModelId(), "gemini-2.5-flash");
assert.equal(xaiModelId(), "grok-3-mini");
for (const row of DISPLAY_TO_BACKEND_MAP) {
  assert.equal(
    providerModelIdFor(row.catalogId),
    row.defaultProviderModelId,
    `${row.catalogId} must route to its named default backend`,
  );
  if (row.provider === "xai") {
    assert.equal(row.backendClass, "xai");
  } else {
    assert.ok(
      row.backendClass.startsWith(`${row.provider}-`),
      `${row.catalogId} backend class must match its provider`,
    );
  }
  if (row.pickerGroup === "fastest") {
    assert.ok(
      row.backendClass.endsWith("-draft") || row.backendClass === "xai",
      `Fast entry ${row.catalogId} must be a draft-tier backend`,
    );
  }
  if (row.pickerGroup === "advanced") {
    assert.ok(
      row.backendClass.endsWith("-final"),
      `Advanced entry ${row.catalogId} must be a full backend`,
    );
  }
}
console.log("ok: every picker entry routes to the backend its name states");

// Grok is wired through routing, not just the catalog.
assert.equal(routingProvider("grok-3-mini"), "xai");
assert.equal(routingProvider("claude-sonnet"), "anthropic");
assert.equal(routingProvider("gpt-4.1"), "openai");
assert.equal(routingProvider("gemini-2.5-pro"), "gemini");
assert.equal(routingProvider("auto"), null);
assert.ok((LLM_ROUTING_PREFERENCES as readonly string[]).includes("grok-3-mini"));
for (const retired of ["opus-4.8", "fable-5.1", "gpt-astra", "gpt-sol", "gemini-3.8-flash", "cinem-super-4.8"]) {
  assert.equal(
    (LLM_ROUTING_PREFERENCES as readonly string[]).includes(retired),
    false,
    `retired id still routable: ${retired}`,
  );
}
console.log("ok: Grok present in catalog + routing; retired ids are not routable");

// Current ids pass through; retired ids coerce to what they actually ran.
assert.equal(normalizeModelRouting("claude-sonnet"), "claude-sonnet");
assert.equal(normalizeModelRouting("gpt-4.1"), "gpt-4.1");
assert.equal(normalizeModelRouting("gemini-2.5-pro"), "gemini-2.5-pro");
assert.equal(normalizeModelRouting("claude-haiku"), "claude-haiku");
assert.equal(normalizeModelRouting("gpt-4o-mini"), "gpt-4o-mini");
assert.equal(normalizeModelRouting("gemini-2.5-flash"), "gemini-2.5-flash");
assert.equal(normalizeModelRouting("grok-3-mini"), "grok-3-mini");
assert.equal(normalizeModelRouting("grok"), "grok-3-mini");
assert.equal(normalizeModelRouting("xai"), "grok-3-mini");
assert.equal(normalizeModelRouting("opus-4.8"), "claude-haiku");
assert.equal(normalizeModelRouting("claude-opus"), "claude-haiku");
assert.equal(normalizeModelRouting("anthropic"), "claude-haiku");
assert.equal(normalizeModelRouting("claude"), "claude-haiku");
assert.equal(normalizeModelRouting("fable-5.1"), "claude-sonnet");
assert.equal(normalizeModelRouting("cinem-super-4.8"), "claude-sonnet");
assert.equal(normalizeModelRouting("gpt-astra"), "gpt-4o-mini");
assert.equal(normalizeModelRouting("gpt-sol"), "gpt-4o-mini");
assert.equal(normalizeModelRouting("openai"), "gpt-4o-mini");
assert.equal(normalizeModelRouting("gemini"), "gemini-2.5-flash");
assert.equal(normalizeModelRouting("gemini-flash"), "gemini-2.5-flash");
assert.equal(normalizeModelRouting("gemini-3.8-flash"), "gemini-2.5-flash");
assert.equal(normalizeModelRouting("nope"), "auto");
console.log("ok: legacy routing ids coerce onto the backend they actually executed");

// Public labels tell the truth about which model answered.
assert.equal(publicModelLabel("claude-haiku-4-5"), "Claude Haiku 4.5");
assert.equal(publicModelLabel("claude-sonnet-5"), "Claude Sonnet 5");
assert.equal(publicModelLabel("gpt-4o-mini"), "GPT-4o mini");
assert.equal(publicModelLabel("gpt-4.1"), "GPT-4.1");
assert.equal(publicModelLabel("gemini-2.5-flash"), "Gemini 2.5 Flash");
assert.equal(publicModelLabel("gemini-2.5-pro"), "Gemini 2.5 Pro");
assert.equal(publicModelLabel("grok-3-mini"), "Grok 3 Mini");
assert.equal(publicModelLabel("demo"), "Offline templates");
assert.equal(catalogByProviderModelId("claude-opus-4"), undefined);
const described = describeProviderModel("claude-haiku-4-5");
assert.equal(described.displayName, "Claude Haiku 4.5");
assert.equal(described.providerModelId, "claude-haiku-4-5");
// Hints stay provider-free even though picker names are real (see header).
for (const row of DISPLAY_MODELS) {
  assert.doesNotMatch(row.hint, /Claude|GPT|Gemini|OpenAI|Anthropic|Grok|xAI/i);
}
console.log("ok: public labels name the real model; hints stay provider-free");

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
