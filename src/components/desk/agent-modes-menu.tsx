"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Info, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AGENT_MODE_PLANS,
  AGENT_MODES_SHORTCUT,
  MODEL_ROUTING_GROUPS,
  MODEL_ROUTING_OPTIONS,
  SERVER_KEYS_COPY,
  modelRoutingLocked,
  planApplyAction,
  planModeCaption,
  planModeDescription,
  planModeName,
  planPowerLabel,
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

export function AgentModesMenu({
  workspaceId,
  plan,
  billingMock,
  llm,
  modelRouting,
  onPlanApplied,
  onRoutingApplied,
}: {
  workspaceId: string;
  plan: string;
  billingMock: boolean;
  llm: LlmStatus;
  modelRouting: string;
  onPlanApplied?: (next: { plan: PlanId; tokenBudget: number }) => void;
  onRoutingApplied?: (next: LlmRoutingPreference) => void;
}) {
  const router = useRouter();
  const currentPlan = normalizePlanId(plan);
  const routing = normalizeModelRouting(modelRouting);
  const plansHref = `/desk/${workspaceId}/billing`;
  const settingsHref = `/desk/${workspaceId}/settings`;

  async function applyPlan(next: PlanId) {
    try {
      const result = await applyWorkspacePlan({
        workspaceId,
        next,
        current: currentPlan,
        billingMock,
      });
      if (result.action === "noop") return;
      if (result.action === "open-plans") {
        toast.message("Open Plans to change a live subscription.");
        router.push(plansHref);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      onPlanApplied?.({
        plan: result.plan,
        tokenBudget: result.tokenBudget ?? PLANS[result.plan].tokenBudget,
      });
      toast.success(
        billingMock
          ? `Mock billing: workspace is now on ${planModeName(result.plan)}.`
          : `Plan updated to ${planModeName(result.plan)}.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change plan.");
      router.push(plansHref);
    }
  }

  async function applyRouting(next: LlmRoutingPreference) {
    if (modelRoutingLocked(next, llm)) {
      toast.message("Add that key on the server, then refresh.");
      return;
    }
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelRouting: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not save model routing.");
      return;
    }
    onRoutingApplied?.(normalizeModelRouting(data.workspace?.modelRouting ?? next));
    toast.success(
      next === "auto"
        ? "Using automatic model routing."
        : `Using ${MODEL_ROUTING_OPTIONS.find((row) => row.id === next)?.label ?? next}.`,
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 max-w-[9.5rem] items-center gap-1 rounded-full bg-composer-control px-2.5 text-[12px] font-medium text-composer-foreground hover:opacity-80"
        aria-label="Agent modes"
        title="Agent modes"
      >
        <span className="truncate">{planModeName(currentPlan)}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-80 min-w-80 p-0"
      >
        <div className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1">
          <p className="text-xs font-medium">Agent modes</p>
          <p className="text-[10px] tracking-wide text-muted-foreground">
            Cycle {AGENT_MODES_SHORTCUT}
          </p>
        </div>
        <ul className="px-1.5 pb-1">
          {AGENT_MODE_PLANS.map((id) => {
            const selected = id === currentPlan;
            const power = planPowerLabel(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selected && "text-chart-2",
                  )}
                  onClick={() => void applyPlan(id)}
                >
                  <span>
                    <span className="block font-medium">{PLANS[id].name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {planModeCaption(id)}
                    </span>
                  </span>
                  {power ? (
                    <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                      {power}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-3 pb-2 text-[11px] leading-5 text-muted-foreground">
          {planModeDescription(currentPlan)}
        </p>
        <DropdownMenuSeparator className="mx-0" />
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <p className="text-xs font-medium">Model</p>
          <span title={SERVER_KEYS_COPY}>
            <Info className="size-3 text-muted-foreground" />
          </span>
        </div>
        <ul className="px-1.5 pb-1">
          {MODEL_ROUTING_GROUPS.map((group) => (
            <li key={group.id}>
              {group.label ? (
                <p className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
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
                          "flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                          selected && !locked && "text-chart-2",
                          locked && "opacity-70",
                        )}
                        onClick={() => void applyRouting(option.id)}
                      >
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {locked ? "Add key on server" : option.hint}
                          </span>
                        </span>
                        {locked ? (
                          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
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
