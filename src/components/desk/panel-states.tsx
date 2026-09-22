/** Shared loading/empty visual pattern for desk list panels (macros, schedules, file actions, …). */
export function PanelLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-3 animate-pulse rounded-full bg-muted-foreground/40" aria-hidden />
      {label}
    </div>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm text-muted-foreground">{children}</p>;
}
