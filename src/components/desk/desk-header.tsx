import Link from "next/link";
import { ProviderBadges } from "@/components/desk/provider-badges";
import type { LlmStatus } from "@/lib/llm";
import type { WorkspaceDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeskHeader({
  workspace,
  llm,
}: {
  workspace: WorkspaceDTO;
  llm: LlmStatus;
}) {
  const usedPct = Math.min(
    100,
    Math.round((workspace.tokenUsed / Math.max(workspace.tokenBudget, 1)) * 100),
  );
  const tight = usedPct >= 90;

  return (
    <header className="flex h-12 flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{workspace.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <ProviderBadges llm={llm} />
        </div>
      </div>
      <Link
        href={`/desk/${workspace.id}/billing`}
        className="min-w-[12rem] flex-1 sm:max-w-xs"
        title="Token budget"
      >
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Budget</span>
          <span className={cn(tight && "text-destructive")}>
            {workspace.tokenUsed.toLocaleString()} /{" "}
            {workspace.tokenBudget.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full bg-primary", tight && "bg-destructive")}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </Link>
    </header>
  );
}
