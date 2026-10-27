/**
 * Pure-logic tests for Chrome social playbooks (no Windows desktop).
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.join(__dirname, "..");
const sp = path.join(root, "apps/cinem-ai-assistant/src/lib/social-playbooks");

async function load<T>(file: string): Promise<T> {
  return (await import(pathToFileURL(path.join(sp, file)).href)) as T;
}

async function main() {
  const domains = await load<typeof import("../apps/cinem-ai-assistant/src/lib/social-playbooks/domains")>("domains.ts");
  const intents = await load<typeof import("../apps/cinem-ai-assistant/src/lib/social-playbooks/intents")>("intents.ts");
  const feature = await load<typeof import("../apps/cinem-ai-assistant/src/lib/social-playbooks/feature")>("feature.ts");
  const playbooks = await load<typeof import("../apps/cinem-ai-assistant/src/lib/social-playbooks/playbooks")>("playbooks.ts");
  const gate = await load<typeof import("../apps/cinem-ai-assistant/src/lib/social-playbooks/publish-gate")>("publish-gate.ts");

  assert.equal(domains.hostAllowedForPlatform("instagram", "https://www.instagram.com/"), true);
  assert.equal(domains.hostAllowedForPlatform("instagram", "https://evil.com/"), false);
  const bad = domains.assertSocialUrlAllowed("tiktok", "https://example.com");
  assert.equal(bad.ok, false);
  console.log("ok: domain allowlist");

  const intent = intents.matchSocialPlaybookIntent('post to instagram with caption "Hello world"');
  assert.ok(intent);
  assert.deepEqual(intent?.platforms, ["instagram"]);
  assert.equal(intent?.caption, "Hello world");
  assert.equal(intents.isSocialPlaybookCommand("what is the weather"), false);
  console.log("ok: intents");

  assert.equal(feature.SOCIAL_PLAYBOOKS_FLAG_KEY, "social_chrome_playbooks");
  assert.equal(feature.socialPlaybooksEnvEnabled("1"), true);
  assert.equal(feature.isSocialPlaybooksEnabled({ explicitOptIn: true }), true);
  console.log("ok: feature flag");

  assert.equal(playbooks.playbookKeys().length, 4);
  assert.match(playbooks.playbookForPlatform("youtube").fragileNote, /fragile/i);
  console.log("ok: playbooks");

  gate.preparePublish({ platform: "tiktok", caption: "hi", requestedAt: Date.now() });
  assert.ok(gate.getPendingPublish());
  assert.equal(gate.isPublishConfirmation("yes please"), true);
  gate.clearPendingPublish();
  console.log("ok: publish gate");

  console.log("check-social-playbooks: all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
