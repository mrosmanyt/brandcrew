import Link from "next/link";
import { DeskThemeToggle } from "@/components/desk/theme-toggle";
import { creditsFromTokens, formatCreditsLine } from "@/lib/credits";
import { planDisplayName } from "@/lib/constants";
import { SupporterBadge } from "@/components/support/supporter-badge";

export function DeskChromeHeader({
  workspaceId,
  tokensLeft,
  tokenBudget,
  plan,
  supporter = false,
}: {
  workspaceId: string;
  tokensLeft: number;
  tokenBudget: number;
  plan: string;
  supporter?: boolean;
}) {
  const credits = creditsFromTokens(Math.max(0, tokenBudget - tokensLeft), tokenBudget);
  return (
    <header className="hidden h-11 shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-4 md:flex">
      {supporter ? (
        <Link href={`/desk/${workspaceId}/settings`} className="hover:opacity-80">
          <SupporterBadge />
        </Link>
      ) : null}
      <Link
        href={`/desk/${workspaceId}/usage`}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        {formatCreditsLine(credits)} · {planDisplayName(plan)}
      </Link>
      <DeskThemeToggle />
    </header>
  );
}
