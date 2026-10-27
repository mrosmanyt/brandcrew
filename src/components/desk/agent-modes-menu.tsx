"use client";

import Link from "next/link";
import { ChevronDown, Info, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AGENT_MODES_SHORTCUT,
  MODEL_ROUTING_GROUPS,
  MODEL_ROUTING_OPTIONS,
  SERVER_KEYS_COPY,
  modelRoutingLabel,
  modelRoutingLocked,
  planApplyAction,
} from "@/lib/agent-modes";
import { PLANS, type PlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";
import {
  normalizeModelRouting,
  type LlmRoutingPreference,
  type LlmStatus,
} from "@/lib/llm-routing";
import { cn } from "@/lib/utils";

export async function applyWorkspacePlan(input: {
  workspaceId: string;
  next: PlanId;
  current: string;
  billingMock: boolean;
}): Promise<{
  action: ReturnType<typeof planApplyAction>;
  plan: PlanId;
  url?: string;
  tokenBudget?: number;
}> {
  const action = planApplyAction(input.next, input.current, input.billingMock);
  if (action === "noop" || action === "open-plans") {
    return { action, plan: normalizePlanId(input.current) };
  }
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId: input.workspaceId, plan: input.next }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Could not change plan.");
  }
  const plan = normalizePlanId(data.plan || input.next);
  return {
    action,
    url: typeof data.url === "string" ? data.url : undefined,
    plan,
    tokenBudget: Number(data.tokenBudget) || PLANS[plan].tokenBudget,
  };
}

export async function applyWorkspaceRouting(input: {
  workspaceId: string;
  next: LlmRoutingPreference;
  llm: LlmStatus;
}): Promise<LlmRoutingPreference> {
  if (modelRoutingLocked(input.next, input.llm)) {
    throw new Error("Add that key on the server, then refresh.");
  }
  const res = await fetch(`/api/workspaces/${input.workspaceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelRouting: input.next }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Could not save model routing.");
  }
  return normalizeModelRouting(data.workspace?.modelRouting ?? input.next);
}

export function AgentModesMenu({
  workspaceId,
  llm,
  modelRouting,
  onRoutingApplied,
}: {
  workspaceId: string;
  plan?: string;
  billingMock?: boolean;
  llm: LlmStatus;
  modelRouting: string;
  onPlanApplied?: (next: { plan: PlanId; tokenBudget: number }) => void;
  onRoutingApplied?: (next: LlmRoutingPreference) => void;
}) {
  const routing = normalizeModelRouting(modelRouting);
  const plansHref = `/desk/${workspaceId}/billing`;
  const settingsHref = `/desk/${workspaceId}/settings`;

  async function applyRouting(next: LlmRoutingPreference) {
    try {
      const saved = await applyWorkspaceRouting({ workspaceId, next, llm });
      onRoutingApplied?.(saved);
      toast.success(
        next === "auto"
          ? "Using automatic model routing."
          : `Using ${MODEL_ROUTING_OPTIONS.find((row) => row.id === next)?.label ?? next}.`,
      );
    } catch (error) {
      toast.message(
        error instanceof Error ? error.message : "Could not save model routing.",
      );
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 max-w-[10.5rem] items-center gap-1 rounded-full bg-composer-control px-2.5 text-[12px] font-medium text-composer-foreground hover:opacity-80"
        aria-label="Model"
        title="Model"
      >
        <span className="truncate">{modelRoutingLabel(routing)}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-72 min-w-72 p-0"
      >
        <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium">Model</p>
            <span title={SERVER_KEYS_COPY}>
              <Info className="size-3 text-muted-foreground" />
            </span>
          </div>
          <p className="text-[10px] tracking-wide text-muted-foreground">
            Cycle {AGENT_MODES_SHORTCUT}
          </p>
        </div>
        <ul className="px-1.5 pb-1">
          {MODEL_ROUTING_GROUPS.map((group) => (
            <li key={group.id}>
              {group.label ? (
                <p className="px-2 pt-1.5 pb-0.5 text-[10px] text-muted-foreground">
                  {group.label}
                </p>
              ) : null}
              <ul>
                {group.options.map((option) => {
                  const locked = modelRoutingLocked(option.id, llm);
                  const selected = option.id === routing;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-accent",
                          selected && !locked && "text-chart-2",
                          locked && "opacity-70",
                        )}
                        onClick={() => void applyRouting(option.id)}
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium leading-tight">
                            {option.label}
                          </span>
                          <span className="block text-[11px] leading-tight text-muted-foreground">
                            {locked ? "Add key on server" : option.hint}
                          </span>
                        </span>
                        {locked ? (
                          <Lock className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <DropdownMenuSeparator className="mx-0" />
        <div className="flex flex-col gap-1 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
          <p>{SERVER_KEYS_COPY}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href={settingsHref} className="underline hover:text-foreground">
              Use server API keys
            </Link>
            <Link href={plansHref} className="underline hover:text-foreground">
              Plans
            </Link>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
