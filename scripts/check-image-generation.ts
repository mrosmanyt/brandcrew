/**
 * Contract + smoke checks for dual-provider image generation.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  buildImageGenPublicStatus,
  imageGenSetupHint,
  isImageGenCommand,
  isImageGenProviderId,
  normalizeImagePrompt,
  parseImageGenPrompt,
  resolveDefaultProvider,
} from "../src/lib/image-generation-pure";
import { cloudflareConfigured } from "../src/lib/image-generation-providers/cloudflare";
import { geminigenConfigured, geminigenDefaultModel } from "../src/lib/image-generation-providers/geminigen";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, "utf8");
}

assert.ok(existsSync("src/lib/image-generation.ts"));
assert.ok(existsSync("src/lib/image-generation-providers/cloudflare.ts"));
assert.ok(existsSync("src/lib/image-generation-providers/geminigen.ts"));
assert.ok(existsSync("src/server/api/image/generate.ts"));
assert.ok(existsSync("src/server/api/webhooks/geminigen-image.ts"));
assert.ok(existsSync("src/components/desk/image-generator.tsx"));
assert.ok(existsSync("docs/integrations/cloudflare-image-worker/worker.js"));
assert.ok(existsSync("docs/integrations/geminigen-image-api/README.md"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/imageGeneration.ts"));

const router = read("src/server/api/router.ts");
assert.match(router, /"api", "image", "generate"/);
assert.match(router, /"api", "webhooks", "geminigen-image"/);

const env = read(".env.example");
assert.match(env, /CINEM_IMAGE_GEN_URL/);
assert.match(env, /CINEM_IMAGE_GEN_API_KEY/);
assert.match(env, /GEMINIGEN_API_KEY/);

const orchestrator = read("apps/cinem-ai-assistant/src/lib/orchestrator.ts");
assert.match(orchestrator, /generateImageViaCloud/);
assert.match(orchestrator, /isImageGenCommand/);

const tools = read("apps/cinem-ai-assistant/src/lib/toolRegistry.ts");
assert.match(tools, /generate_image/);
assert.match(tools, /GeminiGen/);

const byok = read("src/server/api/user/byok.ts");
assert.match(byok, /geminigenApiKey/);

assert.equal(parseImageGenPrompt("generate an image of a red sports car"), "a red sports car");
assert.ok(isImageGenCommand("create a picture of sunset over mountains"));

const long = "x".repeat(900);
assert.equal(normalizeImagePrompt(long).length, 800);

const none = buildImageGenPublicStatus([
  { id: "cloudflare", label: "CF", configured: false, source: "none" },
  { id: "geminigen", label: "GG", configured: false, source: "none" },
]);
assert.equal(none.configured, false);
assert.match(none.setupHint, /GEMINIGEN_API_KEY/);

const both = buildImageGenPublicStatus([
  { id: "cloudflare", label: "CF", configured: true, source: "env" },
  { id: "geminigen", label: "GG", configured: true, source: "env" },
]);
assert.equal(both.configured, true);
assert.equal(resolveDefaultProvider(both.providers), "geminigen");
assert.equal(both.defaultProvider, "geminigen");

assert.ok(isImageGenProviderId("cloudflare"));
assert.ok(isImageGenProviderId("geminigen"));
assert.equal(geminigenDefaultModel(), "nano-banana");
assert.equal(cloudflareConfigured({ url: "https://x.dev", apiKey: "secret" }), true);
assert.equal(geminigenConfigured({ apiKey: "secret" }), true);
assert.match(imageGenSetupHint(), /Cloudflare/);

console.log("check-image-generation: OK");
