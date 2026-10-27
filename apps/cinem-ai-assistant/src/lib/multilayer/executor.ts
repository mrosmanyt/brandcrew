/**
 * Multi-layer orchestrator executor — runs numbered steps one-by-one with progress updates.
 */
import { chatLLM } from "@/lib/llm";
import { getAgentImpl } from "@/lib/agents";
import { agentById } from "@/data/agents";
import { announceAgent, announceCEO } from "@/lib/announcer";
import { fetchWeather, formatWeatherReply, parseWeatherQuery } from "@/lib/weather";
import { runMultiModeSearch, parseMultiModeSearch } from "@/lib/multiModeSearch";
import { runResearchTask } from "@/lib/taskRunner";
import { resolveBrowserTarget } from "@/lib/quickActions";
import { openWebTask } from "@/lib/taskRunner";
import { isComputerUseEnabled } from "@/lib/computer-use/feature";
import { useComputerUseStore } from "@/store/useComputerUseStore";
import { useAppStore } from "@/store/useAppStore";
import { useMultilayerStore } from "@/store/useMultilayerStore";
import type { Settings } from "@/store/useSettingsStore";
import type { HistoryTurn } from "@/lib/memory";
import { postInstantAck } from "@/lib/instantAck";
import { addMemory } from "@/lib/longMemory";
import { mergePlan, parsePlanJson, planFromText } from "./planner";
import {
  createGoalRun,
  finalizeRun,
  goalMemoryText,
  saveActiveRun,
  updateRunStep,
} from "./memory";
import { formatFinalReport, formatProgressHud, formatStepReport } from "./reports";
import { isMultilayerRequest } from "./detect";
import { isMultilayerOrchestratorEnabled } from "./feature";
import type { OrchestratorRun, OrchestratorStep } from "./types";

const PLANNER_SYS = `You are Cinem AI Assistant's multi-layer planner.
Break compound user requests into 4-12 numbered steps. Each step must be atomic and executable.
Respond with ONLY JSON:
{"goal":"<one line>","subgoals":["..."],"steps":[{"title":"...","subgoal":"...","kind":"browser|research|weather|news|planner|computer_use|general","agent":"agent_id"}]}`;

export { isMultilayerRequest, isMultilayerOrchestratorEnabled };

async function executeStep(
  step: OrchestratorStep,
  settings: Settings,
  appendStep: (msg: string) => void,
): Promise<string> {
  const sub = step.subgoal;

  switch (step.kind) {
    case "weather": {
      const q = parseWeatherQuery(sub) || sub;
      appendStep(`Fetching weather for "${q}"…`);
      const data = await fetchWeather(q, settings);
      return formatWeatherReply(data);
    }
    case "news": {
      appendStep("Running news search…");
      const parsed = parseMultiModeSearch(`news ${sub}`) ?? { mode: "news" as const, query: sub };
      return runMultiModeSearch(parsed, settings);
    }
    case "browser": {
      const target = resolveBrowserTarget(sub) ?? resolveBrowserTarget(`open google ${sub}`);
      if (target) {
        openWebTask(target);
        return target.reply;
      }
      return `Opened browser context for: ${sub}`;
    }
    case "research": {
      appendStep(`Researching: "${sub}"…`);
      return runResearchTask(sub, settings);
    }
    case "computer_use": {
      if (!isComputerUseEnabled({ envEnabled: useComputerUseStore.getState().envEnabled })) {
        return "Computer-use step skipped — enable COMPUTER_USE_ENABLED=1 on Windows Electron.";
      }
      const impl = getAgentImpl("computer_use");
      if (!impl) return "Computer-use agent unavailable.";
      const result = await impl.run({
        request: sub,
        settings,
        step: appendStep,
      });
      return result.findings;
    }
    case "planner":
    case "general":
    default: {
      appendStep(`Generating plan for: "${step.title}"…`);
      return (
        await chatLLM(
          `User sub-goal: """${sub}"""
Write a concise, actionable deliverable (markdown, bullets OK). Be specific.`,
          settings,
          {
            system: `You are Cinem AI Assistant's ${step.agentId} specialist.`,
            temperature: 0.5,
            maxTokens: 1800,
          },
        )
      ).trim();
    }
  }
}

async function planRun(text: string, settings: SettingsState, history: HistoryTurn[]): Promise<OrchestratorRun> {
  let parsed = planFromText(text);

  if (settings.geminiKey.trim()) {
    try {
      const raw = await chatLLM(
        `Break this compound request into executable steps (4-12). Cover every part.

Request: """${text}"""`,
        settings,
        { system: PLANNER_SYS, history, temperature: 0.35, maxTokens: 1400, json: true },
      );
      const llm = parsePlanJson(raw, text);
      if (llm && llm.steps.length >= 2) parsed = llm;
    } catch {
      /* heuristic fallback */
    }
  }

  const steps = mergePlan(parsed);
  const run = createGoalRun(text, parsed.subgoals, steps);
  await addMemory(goalMemoryText(run)).catch(() => undefined);
  saveActiveRun(run);
  return run;
}

/**
 * Full pipeline: memory → split → execute → report.
 */
export async function runMultilayerOrchestrator(
  text: string,
  thoughtId: string,
  history: HistoryTurn[],
  settings: Settings,
): Promise<string> {
  const app = useAppStore.getState();
  const ml = useMultilayerStore.getState();

  announceCEO();
  app.flashAgent("ceo");
  postInstantAck({ message: "Multi-layer task — storing goal and planning steps.", thoughtId, speak: false });
  app.appendStep(thoughtId, "📋 Multi-layer orchestrator engaged");
  app.appendStep(thoughtId, "💾 Storing goal + subgoals in durable memory…");

  let run = await planRun(text, settings, history);
  run = { ...run, status: "running" };
  saveActiveRun(run);
  ml.setRun(run);

  app.patchMessage(thoughtId, {
    routedAgents: ["Multi-layer", ...new Set(run.steps.map((s) => s.agentId))],
  });
  run.steps.forEach((s) => app.appendStep(thoughtId, `${s.index}. ${s.title} — ${s.agentId}`));

  for (const step of run.steps) {
    if (run.status !== "running") break;

    const agentDef = agentById(step.agentId);
    if (agentDef) {
      announceAgent(step.agentId);
      app.flashAgent(step.agentId);
      ml.setActiveHandoff(step.agentId, step.index);
    }

    app.appendStep(thoughtId, `▶ Step ${step.index}/${run.steps.length}: ${step.title}`);
    ml.setHudLine(formatProgressHud(run, step));

    run = updateRunStep(run, step.index, { status: "running", startedAt: Date.now() });
    saveActiveRun(run);
    ml.setRun(run);
    app.setAgentStatus(step.agentId, "processing");

    try {
      const report = await executeStep(step, settings, (msg) => app.appendStep(thoughtId, `   ${msg}`));
      run = updateRunStep(run, step.index, {
        status: "done",
        report,
        finishedAt: Date.now(),
      });
      app.appendStep(thoughtId, `✓ Step ${step.index} complete`);
      app.addMessage({ role: "assistant", text: formatStepReport(run.steps.find((s) => s.index === step.index)!) });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      run = updateRunStep(run, step.index, {
        status: "failed",
        report: err,
        finishedAt: Date.now(),
      });
      app.appendStep(thoughtId, `✗ Step ${step.index}: ${err}`);
    } finally {
      app.setAgentStatus(step.agentId, "active");
      ml.clearHandoff(step.agentId);
    }

    saveActiveRun(run);
    ml.setRun(run);
  }

  const finalReport = formatFinalReport(run);
  run = finalizeRun(run, finalReport);
  ml.setRun(run);
  ml.setHudLine("");

  app.appendStep(thoughtId, "📊 Final report ready");
  app.patchMessage(thoughtId, { pending: false });
  app.addMessage({ role: "assistant", text: finalReport });
  return finalReport;
}
