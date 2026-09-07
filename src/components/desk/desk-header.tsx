import Link from "next/link";
import { ProviderBadges } from "@/components/desk/provider-badges";
import type { LlmStatus } from "@/lib/llm";
import type { LimitsDTO, WorkspaceDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeskHeader({
  workspace,
  llm,
  limits,
}: {
  workspace: WorkspaceDTO;
  llm: LlmStatus;
  limits?: LimitsDTO | null;
}) {
  const tokenUsed = limits?.tokenUsed ?? workspace.tokenUsed;
  const tokenBudget = limits?.tokenBudget ?? workspace.tokenBudget;
  const usedPct = Math.min(100, Math.round((tokenUsed / Math.max(tokenBudget, 1)) * 100));
  const tight = usedPct >= 90;
  const jobsTight =
    limits != null && limits.jobsLeftThisHour <= 0;
  const concurrentTight =
    limits != null && limits.concurrentLeft <= 0 && limits.concurrentJobs > 0;

  return (
    <header className="flex h-11 items-center justify-between gap-4 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-3">
        <p className="truncate text-sm">{workspace.name}</p>
        <ProviderBadges llm={llm} />
      </div>
      <Link
        href={`/desk/${workspace.id}/billing`}
        className="flex min-w-0 items-center gap-3 sm:max-w-md"
        title="Workspace limits"
      >
        <span className="hidden text-[11px] capitalize text-muted-foreground sm:inline">
          {limits?.paid ? limits.plan : "free"}
        </span>
        {limits ? (
          <span
            className={cn(
              "hidden text-[11px] text-muted-foreground md:inline",
              (jobsTight || concurrentTight) && "text-destructive",
            )}
          >
            {limits.jobsThisHour}/{limits.jobsPerHour} jobs/hr
            <span className="mx-1 text-border">·</span>
            {limits.concurrentJobs}/{limits.maxConcurrentJobs} live
          </span>
        ) : null}
        <span className="flex items-center gap-2">
          <span className={cn("text-[11px] text-muted-foreground", tight && "text-destructive")}>
            {tokenUsed.toLocaleString()} / {tokenBudget.toLocaleString()}
          </span>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full bg-foreground/70", tight && "bg-destructive")}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </span>
      </Link>
    </header>
  );
}
