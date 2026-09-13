/**
 * Cinem AI Assistant agent framework — shared contracts (Phase 4).
 * Each agent lives in its own file under src/lib/agents/ and exports an
 * AgentImpl. The Orchestrator looks implementations up in the registry
 * (index.ts) after routing and runs them with live thought-step streaming.
 */
import type { Settings } from "@/store/useSettingsStore";

export interface AgentRunContext {
  /** The raw user request being handled. */
  request: string;
  /** Current app settings (LLM keys, models, …). */
  settings: Settings;
  /** Streams one line into the visible Thought Process block. */
  step: (text: string) => void;
}

export interface AgentResult {
  /** The agent's final analysis/answer, already in Cinem AI Assistant's voice. */
  findings: string;
}

/** A concrete capability an agent can execute (usually a Rust command). */
export interface AgentTool {
  name: string;
  description: string;
  /** Returns tool output as text/JSON-string; throws on failure. */
  execute: (ctx: AgentRunContext) => Promise<string>;
}

export interface AgentImpl {
  /** Must match the agent id in src/data/agents.ts */
  id: string;
  /** Strong persona prompt used for analysis and the final answer. */
  systemPrompt: string;
  tools: AgentTool[];
  run: (ctx: AgentRunContext) => Promise<AgentResult>;
}

/** Helper — runs a tool defensively, returning its error as data so the
 *  LLM can still reason about partial scans. */
export async function safeExec(tool: AgentTool, ctx: AgentRunContext): Promise<string> {
  try {
    return await tool.execute(ctx);
  } catch (e) {
    return `[${tool.name} unavailable: ${e instanceof Error ? e.message : e}]`;
  }
}
