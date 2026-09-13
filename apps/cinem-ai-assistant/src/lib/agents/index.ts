/**
 * Agent registry — maps agent ids (src/data/agents.ts) to implementations.
 * The Orchestrator runs every routed agent that has an entry here; agents
 * without one are answered by the generic Cinem AI Assistant persona until implemented.
 *
 * Phase 4 rollout order:
 *  1. security ✅   2. research   3. finance   4. personal   5. planner …
 */
import type { AgentImpl } from "@/lib/agents/types";
import { securityAgent } from "@/lib/agents/security";
import { emailAgent } from "@/lib/agents/email";
import { localAgent } from "@/lib/agents/local";

export const AGENT_IMPLS: Record<string, AgentImpl> = {
  [securityAgent.id]: securityAgent,
  [emailAgent.id]: emailAgent,
  [localAgent.id]: localAgent,
};

export const getAgentImpl = (id: string): AgentImpl | undefined => AGENT_IMPLS[id];
