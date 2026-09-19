/**
 * Computer-use agent — supervised Windows desktop automation (allowlist-first).
 */
import type { AgentImpl, AgentResult, AgentRunContext } from "@/lib/agents/types";
import { isComputerUseEnabled } from "@/lib/computer-use/feature";
import { useComputerUseStore } from "@/store/useComputerUseStore";

export const computerUseAgent: AgentImpl = {
  id: "computer_use",
  systemPrompt: `You are the Computer Use agent for Cinem AI Assistant.
You run supervised desktop sessions on Windows: allowlisted apps only (Explorer, browsers, ChatGPT desktop, Premiere if installed).
PowerShell requires explicit user confirmation. Sessions log every step and stop at max steps or on terminate.
You cannot claim to move a distinct AI cursor on Windows — the HUD shows AI DRIVING instead.`,
  tools: [],
  async run(ctx: AgentRunContext): Promise<AgentResult> {
    if (!isComputerUseEnabled({ envEnabled: useComputerUseStore.getState().envEnabled })) {
      return {
        findings:
          "Computer-use is disabled. Set COMPUTER_USE_ENABLED=1 or enable the dev flag in Settings on Windows Electron.",
      };
    }
    ctx.step("Starting supervised computer-use session…");
    const reply = await useComputerUseStore.getState().runPlannedTask(ctx.request);
    ctx.step("Session finished");
    return { findings: reply };
  },
};
