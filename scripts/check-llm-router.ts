/**
 * Boot / routing check for LLMProvider.
 * Fake keys construct clients only — no paid API calls.
 */
import assert from "node:assert/strict";
import {
  createAnthropicClient,
  createGeminiClient,
  createXaiClient,
  getLlmStatus,
  pickRoute,
  runWithLlmRouting,
  runWithRoutingPreference,
} from "../src/lib/llm";

const KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "XAI_API_KEY",
] as const;

const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function setKeys(keys: {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  geminiAlias?: string;
  xai?: string;
}) {
  for (const key of KEYS) delete process.env[key];
  if (keys.openai) process.env.OPENAI_API_KEY = keys.openai;
  if (keys.anthropic) process.env.ANTHROPIC_API_KEY = keys.anthropic;
  if (keys.gemini) process.env.GEMINI_API_KEY = keys.gemini;
  if (keys.geminiAlias) process.env.GOOGLE_GENERATIVE_AI_API_KEY = keys.geminiAlias;
  if (keys.xai) process.env.XAI_API_KEY = keys.xai;
}

function restore() {
  for (const key of KEYS) {
    if (saved[key]) process.env[key] = saved[key];
    else delete process.env[key];
  }
}

try {
  setKeys({});
  const demo = getLlmStatus();
  assert.equal(demo.configured, false);
  assert.equal(demo.mode, "demo");
  assert.equal(pickRoute("draft"), null);
  assert.equal(pickRoute("final"), null);
  console.log("ok: no keys → demo mode");

  setKeys({ openai: "sk-openai-fake" });
  assert.equal(getLlmStatus().openai, true);
  assert.equal(pickRoute("draft")?.provider, "openai");
  assert.equal(pickRoute("draft")?.model, "gpt-4o-mini");
  assert.equal(pickRoute("final")?.provider, "openai");
  assert.equal(pickRoute("final")?.model, "gpt-4o-mini");
  console.log("ok: OpenAI only → GPT Terra (gpt-4o-mini) for drafts and finals");

  const fakeAnthropic = "sk-ant-fake-boot-check-do-not-call";
  setKeys({ anthropic: fakeAnthropic });
  assert.equal(getLlmStatus().anthropic, true);
  assert.equal(pickRoute("draft")?.provider, "anthropic");
  assert.equal(pickRoute("draft")?.model, "claude-haiku-4-5");
  assert.equal(pickRoute("final")?.provider, "anthropic");
  assert.equal(pickRoute("final")?.model, "claude-haiku-4-5");
  const anthropicClient = createAnthropicClient(fakeAnthropic);
  assert.equal(anthropicClient.apiKey, fakeAnthropic);
  console.log("ok: Anthropic only → Haiku (Opus 4.8 catalog) never Opus");

  const fakeGemini = "gemini-fake-boot-check-do-not-call";
  setKeys({ gemini: fakeGemini });
  const geminiOnly = getLlmStatus();
  assert.equal(geminiOnly.gemini, true);
  assert.equal(geminiOnly.configured, true);
  assert.equal(pickRoute("draft")?.provider, "gemini");
  assert.equal(pickRoute("draft")?.model, "gemini-2.5-flash");
  assert.equal(pickRoute("final")?.provider, "gemini");
  assert.equal(pickRoute("final")?.model, "gemini-2.5-flash");
  const geminiClient = createGeminiClient(fakeGemini);
  assert.ok(geminiClient.models, "Gemini models API is present");
  console.log("ok: Gemini only → Flash (Gemini 3.8 Flash catalog), never Pro");

  setKeys({ geminiAlias: fakeGemini });
  assert.equal(getLlmStatus().gemini, true);
  assert.equal(pickRoute("draft")?.provider, "gemini");
  console.log("ok: GOOGLE_GENERATIVE_AI_API_KEY alias selects Gemini");

  setKeys({ openai: "sk-openai-fake", anthropic: fakeAnthropic });
  assert.equal(pickRoute("draft")?.provider, "openai");
  assert.equal(pickRoute("final")?.provider, "openai");
  assert.equal(pickRoute("draft")?.model, "gpt-4o-mini");
  console.log("ok: OpenAI + Anthropic (no Gemini) → GPT Terra for auto general");

  setKeys({
    openai: "sk-openai-fake",
    anthropic: fakeAnthropic,
    gemini: fakeGemini,
  });
  assert.equal(pickRoute("draft")?.provider, "gemini");
  assert.equal(pickRoute("draft")?.model, "gemini-2.5-flash");
  assert.equal(pickRoute("final")?.provider, "gemini");
  assert.equal(pickRoute("final")?.model, "gemini-2.5-flash");
  assert.equal(pickRoute("draft", "website")?.provider, "gemini");
  assert.equal(pickRoute("draft", "coding")?.provider, "anthropic");
  assert.equal(pickRoute("draft", "coding")?.model, "claude-sonnet-5");
  assert.equal(pickRoute("draft", "json")?.provider, "anthropic");
  assert.equal(pickRoute("draft", "json")?.model, "claude-haiku-4-5");
  assert.equal(pickRoute("draft", "research")?.provider, "gemini");
  assert.equal(pickRoute("draft", "outreach")?.provider, "gemini");
  assert.equal(pickRoute("draft", "whatsapp")?.provider, "gemini");
  assert.equal(pickRoute("draft", "posts")?.provider, "gemini");
  assert.equal(pickRoute("draft", "general", "openai")?.provider, "openai");
  assert.equal(pickRoute("draft", "general", "openai")?.model, "gpt-4o-mini");
  assert.equal(pickRoute("draft", "general", "gpt-astra")?.model, "gpt-4o-mini");
  assert.equal(pickRoute("draft", "general", "opus-4.8")?.model, "claude-haiku-4-5");
  assert.equal(pickRoute("draft", "general", "fable-5.1")?.model, "claude-sonnet-5");
  assert.equal(pickRoute("draft", "general", "gpt-4o-mini")?.model, "gpt-4o-mini");
  assert.equal(pickRoute("draft", "general", "gpt-sol")?.model, "gpt-4o-mini");
  assert.equal(pickRoute("draft", "general", "claude-opus")?.model, "claude-haiku-4-5");
  assert.equal(pickRoute("draft", "general", "gemini-flash")?.model, "gemini-2.5-flash");
  assert.equal(
    runWithRoutingPreference("anthropic", () => pickRoute("draft")?.model),
    "claude-haiku-4-5",
  );
  assert.equal(
    runWithLlmRouting({ prefer: "auto", plan: "ultra" }, () => pickRoute("draft", "research")?.model),
    "claude-sonnet-5",
  );
  assert.doesNotMatch(pickRoute("draft", "boost")?.model || "", /opus/i);
  console.log("ok: all three → Flash auto, Haiku JSON, Sonnet code, Ultra uses Sonnet max");

  setKeys({
    openai: "sk-openai-fake",
    anthropic: fakeAnthropic,
    gemini: fakeGemini,
    xai: "xai-fake-boot-check",
  });
  assert.equal(getLlmStatus().xai, true);
  assert.equal(pickRoute("draft", "posts")?.provider, "gemini");
  assert.equal(pickRoute("draft", "website")?.provider, "gemini");
  assert.equal(pickRoute("draft", "apps")?.provider, "anthropic");
  assert.equal(pickRoute("draft", "apps")?.model, "claude-sonnet-5");
  const xaiClient = createXaiClient("xai-fake-boot-check");
  const base = String(
    (xaiClient as unknown as { baseURL?: string; _options?: { baseURL?: string } })
      .baseURL ||
      (xaiClient as unknown as { _options?: { baseURL?: string } })._options
        ?.baseURL ||
      "",
  );
  assert.match(base, /x\.ai/);
  console.log("ok: posts stay Gemini Flash even if xAI is keyed; apps stay Sonnet");

  console.log("LLM router checks passed (no paid API calls).");
} finally {
  restore();
}
