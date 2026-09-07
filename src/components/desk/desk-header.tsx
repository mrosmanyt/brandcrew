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
    <header className="flex h-11 items-center justify-between gap-4 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-3">
        <p className="truncate text-sm">{workspace.name}</p>
        <ProviderBadges llm={llm} />
      </div>
      <Link
        href={`/desk/${workspace.id}/billing`}
        className="flex min-w-[10rem] items-center gap-2 sm:max-w-xs"
        title="Token budget"
      >
        <span className={cn("text-[11px] text-muted-foreground", tight && "text-destructive")}>
          {workspace.tokenUsed.toLocaleString()} / {workspace.tokenBudget.toLocaleString()}
        </span>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full bg-foreground/70", tight && "bg-destructive")}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </Link>
    </header>
  );
}
