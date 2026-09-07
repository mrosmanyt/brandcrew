/** Light Replit-like canvas for public pages. Desk stays on the dark tokens. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-canvas flex min-h-dvh flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
