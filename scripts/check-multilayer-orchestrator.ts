/**
 * Smoke tests for multi-layer orchestrator pure logic (no LLM/desktop).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.join(__dirname, "..");
const ml = path.join(root, "apps/cinem-ai-assistant/src/lib/multilayer");

async function loadModule<T>(file: string): Promise<T> {
  return (await import(pathToFileURL(path.join(ml, file)).href)) as T;
}

async function main() {
  const detect = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/multilayer/detect")>(
    "detect.ts",
  );
  const planner = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/multilayer/planner")>(
    "planner.ts",
  );
  const memory = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/multilayer/memory")>(
    "memory.ts",
  );
  const reports = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/multilayer/reports")>(
    "reports.ts",
  );
  const feature = await loadModule<typeof import("../apps/cinem-ai-assistant/src/lib/multilayer/feature")>(
    "feature.ts",
  );

  const compound =
    "go to google, check weather in Lahore, research latest AI and tech news, build an event planner for my launch, and build a diet plan vegetarian 1800 kcal";
  assert.equal(detect.isMultilayerRequest(compound), true);
  assert.ok(detect.countLayerHints(compound) >= 3);
  assert.equal(detect.isMultilayerRequest("what is the weather"), false);
  console.log("ok: detect");

  const subgoals = planner.extractSubgoals(compound);
  assert.ok(subgoals.length >= 4);
  const steps = planner.buildStepsFromSubgoals(subgoals);
  assert.ok(steps.length >= 4);
  assert.equal(steps[0].index, 1);
  assert.ok(steps.every((s, i) => s.index === i + 1));
  console.log("ok: planner split");

  const parsed = planner.parsePlanJson(
    JSON.stringify({
      goal: "Test",
      steps: [
        { title: "Weather", subgoal: "weather Lahore", kind: "weather", agent: "world" },
        { title: "Research", subgoal: "research AI", kind: "research", agent: "research" },
      ],
    }),
    "fallback",
  );
  assert.ok(parsed && parsed.steps.length === 2);
  console.log("ok: parsePlanJson");

  const run = memory.createGoalRun(compound, subgoals, steps);
  assert.equal(run.status, "planning");
  assert.match(memory.goalMemoryText(run), /\[orchestrator\]/);
  assert.equal(run.steps.length, steps.length);
  const updated = memory.updateRunStep(run, 1, { status: "done", report: "Sunny" });
  assert.equal(updated.steps[0].status, "done");
  const final = memory.finalizeRun(updated, "# Done");
  assert.equal(final.status, "done");
  console.log("ok: memory");

  const report = reports.formatStepReport(updated.steps[0]);
  assert.match(report, /Step 1/);
  assert.match(reports.formatFinalReport(final), /Multi-layer run complete/);
  console.log("ok: reports");

  assert.equal(feature.multilayerEnvEnabled("1"), true);
  assert.equal(feature.MULTILAYER_FLAG_KEY, "multilayer_orchestrator");
  console.log("ok: feature");

  const orchestrator = readFileSync(
    path.join(root, "apps/cinem-ai-assistant/src/lib/orchestrator.ts"),
    "utf8",
  );
  assert.match(orchestrator, /runMultilayerOrchestrator/);
  assert.match(orchestrator, /isMultilayerRequest/);

  const playbook = readFileSync(
    path.join(root, "apps/cinem-ai-assistant/src/lib/computer-use/playbooks/chatgpt-premiere.ts"),
    "utf8",
  );
  assert.match(playbook, /chatGptPremierePlan/);

  const cuMain = readFileSync(path.join(root, "electron/computer-use.cjs"), "utf8");
  assert.match(cuMain, /ai-cursor-overlay/);

  console.log("check-multilayer-orchestrator: all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
