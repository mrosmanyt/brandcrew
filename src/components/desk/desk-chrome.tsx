import Link from "next/link";
import { DeskThemeToggle } from "@/components/desk/theme-toggle";
import { NotificationBell, type NeedsYouItem } from "@/components/desk/notification-bell";

export function DeskChromeHeader({
  workspaceId,
  tokensLeft,
  tokenBudget,
  jobsLeft,
  plan,
  needsYou,
}: {
  workspaceId: string;
  tokensLeft: number;
  tokenBudget: number;
  jobsLeft: number;
  plan: string;
  needsYou: NeedsYouItem[];
}) {
  return (
    <header className="hidden h-11 shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-4 md:flex">
      <Link
        href={`/desk/${workspaceId}/usage`}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        {tokensLeft.toLocaleString()} / {tokenBudget.toLocaleString()} tokens · {jobsLeft}{" "}
        jobs/hr cap · {plan}
      </Link>
      <NotificationBell workspaceId={workspaceId} initialItems={needsYou} />
      <DeskThemeToggle />
    </header>
  );
}
