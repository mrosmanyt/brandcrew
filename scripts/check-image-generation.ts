/**
 * Contract + smoke checks for multi-provider image generation
 * (Cloudflare worker, GeminiGen, native OpenAI, native Gemini).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  GEMINI_IMAGE_MODELS,
  IMAGE_GEN_CREDIT_COST,
  OPENAI_IMAGE_MODELS,
  buildImageGenPublicStatus,
  imageGenSetupHint,
  imageGenSupportsVariation,
  isImageGenCommand,
  isImageGenProviderId,
  normalizeImagePrompt,
  parseImageGenPrompt,
  resolveDefaultProvider,
} from "../src/lib/image-generation-pure";
import { cloudflareConfigured } from "../src/lib/image-generation-providers/cloudflare";
import { geminigenConfigured, geminigenDefaultModel } from "../src/lib/image-generation-providers/geminigen";
import {
  generateGeminiImage,
  geminiImageConfigured,
  geminiImageDefaultModel,
} from "../src/lib/image-generation-providers/gemini";
import {
  generateOpenAIImage,
  openaiImageConfigured,
  openaiImageDefaultModel,
} from "../src/lib/image-generation-providers/openai";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, "utf8");
}

assert.ok(existsSync("src/lib/image-generation.ts"));
assert.ok(existsSync("src/lib/image-generation-providers/cloudflare.ts"));
assert.ok(existsSync("src/lib/image-generation-providers/geminigen.ts"));
assert.ok(existsSync("src/lib/image-generation-providers/openai.ts"));
assert.ok(existsSync("src/lib/image-generation-providers/gemini.ts"));
assert.ok(existsSync("src/server/api/image/generate.ts"));
assert.ok(existsSync("src/server/api/image/history.ts"));
assert.ok(existsSync("src/server/api/webhooks/geminigen-image.ts"));
assert.ok(existsSync("src/components/desk/image-generator.tsx"));
assert.ok(existsSync("docs/integrations/cloudflare-image-worker/worker.js"));
assert.ok(existsSync("docs/integrations/geminigen-image-api/README.md"));

const router = read("src/server/api/router.ts");
assert.match(router, /"api", "image", "generate"/);
assert.match(router, /"api", "image", "history"/);
assert.match(router, /"api", "webhooks", "geminigen-image"/);

const env = read(".env.example");
assert.match(env, /CINEM_IMAGE_GEN_URL/);
assert.match(env, /CINEM_IMAGE_GEN_API_KEY/);
assert.match(env, /GEMINIGEN_API_KEY/);
assert.match(env, /OPENAI_IMAGE_MODEL/);
assert.match(env, /GEMINI_IMAGE_MODEL/);

const byok = read("src/server/api/user/byok.ts");
assert.match(byok, /geminigenApiKey/);

// Orchestrator wiring: native providers are dispatched, history + metering
// are recorded, and the Gemini BYOK key is reused for native Gemini images.
const orchestrator = read("src/lib/image-generation.ts");
assert.match(orchestrator, /generateOpenAIImage/);
assert.match(orchestrator, /generateGeminiImage/);
assert.match(orchestrator, /generateImageVariationForUser/);
assert.match(orchestrator, /listImageGenHistoryForUser/);
assert.match(orchestrator, /recordUsage/);
assert.match(orchestrator, /geminiKeyEnc/);

assert.equal(parseImageGenPrompt("generate an image of a red sports car"), "a red sports car");
assert.ok(isImageGenCommand("create a picture of sunset over mountains"));

const long = "x".repeat(900);
assert.equal(normalizeImagePrompt(long).length, 800);

const none = buildImageGenPublicStatus([
  { id: "cloudflare", label: "CF", configured: false, source: "none" },
  { id: "geminigen", label: "GG", configured: false, source: "none" },
  { id: "openai", label: "OA", configured: false, source: "none" },
  { id: "gemini", label: "GM", configured: false, source: "none" },
]);
assert.equal(none.configured, false);
assert.equal(none.defaultProvider, null);
assert.match(none.setupHint, /GEMINIGEN_API_KEY/);
assert.match(none.setupHint, /OPENAI_API_KEY/);

const both = buildImageGenPublicStatus([
  { id: "cloudflare", label: "CF", configured: true, source: "env" },
  { id: "geminigen", label: "GG", configured: true, source: "env" },
]);
assert.equal(both.configured, true);
assert.equal(resolveDefaultProvider(both.providers), "geminigen");
assert.equal(both.defaultProvider, "geminigen");

// Default-provider priority: native Gemini > GeminiGen > native OpenAI >
// Cloudflare; an unconfigured provider is never substituted silently.
const all = buildImageGenPublicStatus([
  { id: "cloudflare", label: "CF", configured: true, source: "env" },
  { id: "geminigen", label: "GG", configured: true, source: "env" },
  { id: "openai", label: "OA", configured: true, source: "env" },
  { id: "gemini", label: "GM", configured: true, source: "env" },
]);
assert.equal(all.defaultProvider, "gemini");
const openaiOnly = buildImageGenPublicStatus([
  { id: "cloudflare", label: "CF", configured: false, source: "none" },
  { id: "geminigen", label: "GG", configured: false, source: "none" },
  { id: "openai", label: "OA", configured: true, source: "env" },
  { id: "gemini", label: "GM", configured: false, source: "none" },
]);
assert.equal(openaiOnly.defaultProvider, "openai");

assert.ok(isImageGenProviderId("cloudflare"));
assert.ok(isImageGenProviderId("geminigen"));
assert.ok(isImageGenProviderId("openai"));
assert.ok(isImageGenProviderId("gemini"));
assert.equal(isImageGenProviderId("dalle"), false);
assert.equal(geminigenDefaultModel(), "nano-banana");
assert.equal(cloudflareConfigured({ url: "https://x.dev", apiKey: "secret" }), true);
assert.equal(geminigenConfigured({ apiKey: "secret" }), true);
assert.match(imageGenSetupHint(), /Cloudflare/);

// Native providers: configured flags reject placeholders, defaults are the
// documented models, and the generate functions exist (no live calls here).
assert.equal(openaiImageConfigured({ apiKey: "sk-live" }), true);
assert.equal(openaiImageConfigured({ apiKey: "placeholder" }), false);
assert.equal(openaiImageConfigured(null), false);
assert.equal(openaiImageDefaultModel(), "gpt-image-1");
assert.ok(OPENAI_IMAGE_MODELS.includes(openaiImageDefaultModel()));
assert.equal(typeof generateOpenAIImage, "function");

assert.equal(geminiImageConfigured({ apiKey: "gm-live" }), true);
assert.equal(geminiImageConfigured({ apiKey: "" }), false);
assert.equal(geminiImageConfigured(null), false);
assert.equal(geminiImageDefaultModel(), "gemini-2.5-flash-image");
assert.ok(GEMINI_IMAGE_MODELS.includes(geminiImageDefaultModel()));
assert.equal(typeof generateGeminiImage, "function");

// Variations only where the provider API accepts an input image.
assert.equal(imageGenSupportsVariation("openai"), true);
assert.equal(imageGenSupportsVariation("gemini"), true);
assert.equal(imageGenSupportsVariation("cloudflare"), false);
assert.equal(imageGenSupportsVariation("geminigen"), false);

assert.ok(IMAGE_GEN_CREDIT_COST > 0);

console.log("check-image-generation: OK");
