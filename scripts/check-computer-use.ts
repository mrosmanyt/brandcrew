/**
 * Smoke tests for computer-use pure logic (no Windows desktop required).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.join(__dirname, "..");
const cu = path.join(root, "apps/cinem-ai-assistant/src/lib/computer-use");

async function main() {
  async function loadModule<T>(file: string): Promise<T> {
    const url = pathToFileURL(path.join(cu, file)).href;
    return (await import(url)) as T;
  }

  const allowlist = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/computer-use/allowlist")>(
    "allowlist.ts",
  );
  const runner = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/computer-use/runner")>(
    "runner.ts",
  );
  const feature = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/computer-use/feature")>(
    "feature.ts",
  );
  const intents = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/computer-use/intents")>(
    "intents.ts",
  );

  assert.equal(allowlist.isAllowlistedApp("explorer"), true);
  assert.equal(allowlist.isAllowlistedApp("powershell"), false);
  const bad = allowlist.validateFocusApp("malware");
  assert.equal(bad.ok, false);
  const good = allowlist.validateFocusApp("chrome");
  assert.equal(good.ok, true);
  console.log("ok: allowlist");

  let session = runner.createSession("open explorer", 3);
  session = { ...session, status: "working" };
  const action = { kind: "focus_app" as const, app: "explorer" as const, label: "Focus Explorer" };
  assert.equal(runner.validateAction(action, session).ok, true);
  session = runner.appendStep(session, action, true, "focused");
  assert.equal(session.step, 1);
  session = runner.pauseOnMouseMove(session);
  assert.equal(session.status, "paused");
  session = runner.terminateSession(session, "test");
  assert.equal(session.status, "terminated");
  console.log("ok: runner");

  const plan = runner.planFromTask("focus chrome and open https://example.com");
  assert.ok(plan.some((a) => a.kind === "focus_app" && a.app === "chrome"));
  assert.ok(plan.some((a) => a.kind === "open_url"));
  console.log("ok: planFromTask");

  assert.equal(feature.computerUseEnvEnabled("1"), true);
  assert.equal(feature.computerUseEnvEnabled("false"), false);
  assert.equal(feature.COMPUTER_USE_FLAG_KEY, "computer_use_mvp");
  console.log("ok: feature flag");

  assert.equal(intents.isComputerUseCommand("control my desktop and open explorer"), true);
  assert.equal(intents.isComputerUseCommand("what is the weather"), false);

  const promptSrc = readFileSync(path.join(cu, "prompt-expansion.ts"), "utf8");
  assert.match(promptSrc, /isPromptExpansionRequest/);
  assert.match(promptSrc, /expandCreativePrompt/);
  console.log("ok: intents + prompt-expansion module present");

  assert.ok(existsSync(path.join(root, "electron/computer-use.cjs")));
  assert.ok(existsSync(path.join(root, "electron/computer-use-hud.html")));
  assert.ok(existsSync(path.join(root, "apps/cinem-ai-assistant/computer-use-server/index.js")));
  const mainSrc = readFileSync(path.join(root, "electron/main.cjs"), "utf8");
  assert.match(mainSrc, /computer-use\.cjs/);
  assert.match(mainSrc, /computerUse\.registerIpc/);
  const preload = readFileSync(path.join(root, "electron/assistant-preload.cjs"), "utf8");
  assert.match(preload, /computerUse:/);
  assert.match(preload, /safeInvoke/);
  assert.match(preload, /retryAssistant/);
  const cuMain = readFileSync(path.join(root, "electron/computer-use.cjs"), "utf8");
  assert.match(cuMain, /safeHandle/);
  assert.match(cuMain, /Computer use is disabled/);
  const orchestrator = readFileSync(
    path.join(root, "apps/cinem-ai-assistant/src/lib/orchestrator.ts"),
    "utf8",
  );
  assert.match(orchestrator, /isComputerUseCommand/);
  console.log("ok: electron wiring");

  console.log("check-computer-use: all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
