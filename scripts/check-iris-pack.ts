/**
 * Regression checks for IRIS-inspired UX pack (pure logic + wiring).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();
const irisDir = path.join(root, "apps/cinem-ai-assistant/src/lib/iris");

async function loadIris<T>(file: string): Promise<T> {
  const url = pathToFileURL(path.join(irisDir, file)).href;
  return (await import(url)) as T;
}

async function main() {
  const orb = await loadIris<typeof import("../apps/cinem-ai-assistant/src/lib/iris/orb-state")>(
    "orb-state.ts",
  );
  assert.equal(orb.resolveOrbState({ voiceStatus: "idle", thinking: false }), "idle");
  assert.equal(orb.resolveOrbState({ voiceStatus: "listening", thinking: false }), "listening");
  assert.equal(orb.resolveOrbState({ voiceStatus: "idle", thinking: true }), "thinking");
  assert.equal(orb.resolveOrbState({ voiceStatus: "speaking", thinking: false }), "speaking");
  assert.equal(
    orb.resolveOrbState({ voiceStatus: "idle", thinking: false, error: "mic fail" }),
    "error",
  );
  console.log("ok: orb-state");

  const persona = await loadIris<typeof import("../apps/cinem-ai-assistant/src/lib/iris/hinglish-persona")>(
    "hinglish-persona.ts",
  );
  assert.match(persona.wakeAckLine(true), /boss/i);
  assert.equal(persona.wakeAckLine(false), "Yes?");
  const spiced = persona.applyHinglishBossPersona("Playing your video now.");
  assert.ok(spiced.length > 10);
  assert.equal(persona.applySpeakPersona("Hello", { hinglishBossPersona: false }), "Hello");
  console.log("ok: hinglish-persona");

  const spatial = await loadIris<typeof import("../apps/cinem-ai-assistant/src/lib/iris/spatial-layout")>(
    "spatial-layout.ts",
  );
  const layout = spatial.parseSpatialLayoutCommand("WhatsApp left, Chrome right");
  assert.ok(layout);
  assert.equal(layout!.length, 2);
  assert.equal(layout![0].app, "whatsapp");
  assert.equal(layout![0].slot, "left");
  assert.equal(layout![1].app, "chrome");
  assert.equal(layout![1].slot, "right");
  assert.ok(spatial.isSpatialLayoutCommand("snap chrome right"));
  console.log("ok: spatial-layout");

  const autopilot = await import(
    "../apps/cinem-ai-assistant/src/lib/iris/web-autopilot-intents.ts"
  );
  assert.ok(autopilot.isWebAutopilotCommand("google search cats and open first result"));
  const cmd = autopilot.parseWebAutopilot("youtube search lofi and play first");
  assert.ok(cmd && cmd.kind === "youtube-play");
  console.log("ok: web-autopilot");

  const feature = await loadIris<typeof import("../apps/cinem-ai-assistant/src/lib/iris/feature")>(
    "feature.ts",
  );
  assert.equal(feature.irisEnvEnabled("1"), true);
  assert.equal(feature.IRIS_FLAG_KEY, "iris_pack");
  console.log("ok: feature");

  const hub = readFileSync(
    path.join(root, "apps/cinem-ai-assistant/src/components/center/IntelligenceHub.tsx"),
    "utf8",
  );
  assert.match(hub, /resolveOrbState/);
  assert.match(hub, /ERROR/);
  assert.doesNotMatch(hub, /SecondOrb|second orb/i);

  const orchestrator = readFileSync(
    path.join(root, "apps/cinem-ai-assistant/src/lib/orchestrator.ts"),
    "utf8",
  );
  assert.match(orchestrator, /executeSnapLayout/);
  assert.match(orchestrator, /runWebAutopilot/);

  assert.ok(existsSync(path.join(root, "docs/iris-pack.md")));
  assert.ok(existsSync(path.join(root, "apps/cinem-ai-assistant/src/components/iris/LiveTranscriptPanel.tsx")));

  console.log("check-iris-pack: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
