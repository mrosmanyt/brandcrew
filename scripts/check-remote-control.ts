/**
 * Pure-logic tests for remote phone control (pairing, parser, allowlist).
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const root = path.join(__dirname, "..");
const rc = path.join(root, "apps/cinem-ai-assistant/src/lib/remote-control");

async function load<T>(file: string): Promise<T> {
  return (await import(pathToFileURL(path.join(rc, file)).href)) as T;
}

async function main() {
  const pairing = await load<typeof import("../apps/cinem-ai-assistant/src/lib/remote-control/pairing")>("pairing.ts");
  const parser = await load<typeof import("../apps/cinem-ai-assistant/src/lib/remote-control/command-parser")>("command-parser.ts");
  const feature = await load<typeof import("../apps/cinem-ai-assistant/src/lib/remote-control/feature")>("feature.ts");

  const code = pairing.generatePairCode();
  assert.match(code, /^\d{6}$/);
  assert.equal(pairing.isAuthorizedTelegramChat("12345", 12345), true);
  assert.equal(pairing.isAuthorizedTelegramChat("12345", 99999), false);
  assert.equal(pairing.normalizePhoneE164("+1 (555) 123-4567"), "+15551234567");
  assert.equal(pairing.isFreshMessage(100, 95), true);
  assert.equal(pairing.isFreshMessage(80, 95), false);
  console.log("ok: pairing");

  assert.equal(parser.parseRemoteCommand("/help").kind, "builtin");
  assert.deepEqual(parser.splitCompoundCommand("a;b\nc"), ["a", "b", "c"]);
  assert.equal(parser.isCompoundCommand("one && two"), true);
  console.log("ok: command parser");

  assert.equal(feature.REMOTE_CONTROL_FLAG_KEY, "remote_phone_control");
  assert.equal(feature.isRemoteControlEnabled({ explicitOptIn: true }), true);
  console.log("ok: feature flag");

  const wa = readFileSync(path.join(root, "src/lib/whatsapp-cloud.ts"), "utf8");
  assert.match(wa, /verifyWebhookToken/);
  assert.match(wa, /enqueueAssistantRemoteCommand/);

  const router = readFileSync(path.join(root, "src/server/api/router.ts"), "utf8");
  assert.match(router, /whatsapp\/webhook/);

  const tg = readFileSync(path.join(root, "apps/cinem-ai-assistant/src/lib/telegram.ts"), "utf8");
  assert.match(tg, /executeRemoteText/);
  assert.match(tg, /generatePairCode/);

  console.log("check-remote-control: all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
