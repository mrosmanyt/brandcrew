/**
 * Contract + smoke checks for Cloudflare image generation integration.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  imageGenPublicStatus,
  imageGenSetupHint,
  isImageGenCommand,
  normalizeImagePrompt,
  parseImageGenPrompt,
} from "../src/lib/image-generation-pure";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, "utf8");
}

assert.ok(existsSync("src/lib/image-generation.ts"));
assert.ok(existsSync("src/server/api/image/generate.ts"));
assert.ok(existsSync("src/components/desk/image-generator.tsx"));
assert.ok(existsSync("docs/integrations/cloudflare-image-worker/worker.js"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/imageGeneration.ts"));

const router = read("src/server/api/router.ts");
assert.match(router, /"api", "image", "generate"/);

const env = read(".env.example");
assert.match(env, /CINEM_IMAGE_GEN_URL/);
assert.match(env, /CINEM_IMAGE_GEN_API_KEY/);

const orchestrator = read("apps/cinem-ai-assistant/src/lib/orchestrator.ts");
assert.match(orchestrator, /generateImageViaCloud/);
assert.match(orchestrator, /isImageGenCommand/);

const tools = read("apps/cinem-ai-assistant/src/lib/toolRegistry.ts");
assert.match(tools, /generate_image/);

assert.equal(parseImageGenPrompt("generate an image of a red sports car"), "a red sports car");
assert.ok(isImageGenCommand("create a picture of sunset over mountains"));

const long = "x".repeat(900);
assert.equal(normalizeImagePrompt(long).length, 800);

const unconfigured = imageGenPublicStatus({ envUrl: "", envKey: "" });
assert.equal(unconfigured.configured, false);
assert.match(unconfigured.setupHint, /CINEM_IMAGE_GEN_URL/);

const configured = imageGenPublicStatus({
  envUrl: "https://worker.example.dev",
  envKey: "secret",
});
assert.equal(configured.configured, true);
assert.equal(configured.source, "env");

const byok = imageGenPublicStatus({
  envUrl: "",
  envKey: "",
  byokUrl: "https://mine.workers.dev",
  byokKey: "mine",
});
assert.equal(byok.source, "byok");

assert.match(imageGenSetupHint(), /BYOK/);

console.log("check-image-generation: OK");
