import type { JobEventDTO, JobStep } from "@/lib/job-types";

/**
 * Session replay stores enough of a run for later review (approval/trust)
 * without live-view as the product headline. Packed from JobEvent + plan.
 */

export type PackedReplay = {
  jobId: string;
  title: string;
  playbookKey: string | null;
  status: string;
  steps: Array<{ id: string; tool: string; label: string; status: string; result?: string }>;
  events: Array<{ type: string; message: string; stepId: string | null; createdAt: string }>;
  sources: string[];
  cost: {
    llmCalls: number;
    llmSkipped: number;
    cacheHits: number;
    cacheMisses: number;
  };
  perception: "dom" | "vision_fallback";
};

export type JobCostStats = {
  llmCalls: number;
  llmSkipped: number;
  cacheHits: number;
  cacheMisses: number;
  perception?: "dom" | "vision_fallback";
};

export function emptyCostStats(): JobCostStats {
  return { llmCalls: 0, llmSkipped: 0, cacheHits: 0, cacheMisses: 0, perception: "dom" };
}

export function bumpCost(stats: JobCostStats | undefined, patch: Partial<JobCostStats>): JobCostStats {
  const base = stats ?? emptyCostStats();
  return {
    llmCalls: base.llmCalls + (patch.llmCalls ?? 0),
    llmSkipped: base.llmSkipped + (patch.llmSkipped ?? 0),
    cacheHits: base.cacheHits + (patch.cacheHits ?? 0),
    cacheMisses: base.cacheMisses + (patch.cacheMisses ?? 0),
    perception: patch.perception ?? base.perception ?? "dom",
  };
}

export function packSessionReplay(input: {
  jobId: string;
  title: string;
  playbookKey?: string | null;
  status: string;
  steps: JobStep[];
  events: Array<Pick<JobEventDTO, "type" | "message" | "stepId" | "createdAt"> | { type: string; message: string; stepId?: string | null; createdAt: string }>;
  pages?: Array<{ url?: string }>;
  cost?: JobCostStats;
}): PackedReplay {
  const sources = [...new Set((input.pages || []).map((page) => page.url || "").filter(Boolean))].slice(0, 12);
  const cost = input.cost ?? emptyCostStats();
  return {
    jobId: input.jobId,
    title: input.title,
    playbookKey: input.playbookKey ?? null,
    status: input.status,
    steps: input.steps.map((step) => ({
      id: step.id,
      tool: step.tool,
      label: step.label,
      status: step.status,
      result: step.result?.slice(0, 280),
    })),
    events: input.events.slice(-80).map((event) => ({
      type: event.type,
      message: event.message.slice(0, 280),
      stepId: event.stepId ?? null,
      createdAt: event.createdAt,
    })),
    sources,
    cost: {
      llmCalls: cost.llmCalls,
      llmSkipped: cost.llmSkipped,
      cacheHits: cost.cacheHits,
      cacheMisses: cost.cacheMisses,
    },
    perception: cost.perception === "vision_fallback" ? "vision_fallback" : "dom",
  };
}

export function parsePackedReplay(raw: string | null | undefined): PackedReplay | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PackedReplay;
    return parsed && parsed.jobId ? parsed : null;
  } catch {
    return null;
  }
}
