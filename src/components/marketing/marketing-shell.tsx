import { FunnelTrack } from "@/components/marketing/funnel-track";

/** Light Replit-like canvas for public pages. Desk follows the Light/Dark toggle. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-canvas flex min-h-dvh flex-col bg-background text-foreground">
      <FunnelTrack />
      {children}
    </div>
  );
}
