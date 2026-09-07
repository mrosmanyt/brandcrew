/** CSS chrome of Mission Control — labels match the real desk, not canned job copy. */
export function ProductShot() {
  return (
    <div className="product-frame overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="ml-2 text-[11px] text-muted-foreground">
          Mission Control · CINEM Pro
        </span>
      </div>
      <div className="grid min-h-[22rem] bg-background md:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="hidden border-r border-border md:block">
          <div className="flex items-center justify-between px-3 py-3">
            <p className="text-xs font-medium text-muted-foreground">Agents</p>
            <span className="text-[11px] text-muted-foreground">New</span>
          </div>
          <ShotAgent name="New Agent" role="Research" active />
          <ShotAgent name="New Agent" role="Writer" />
          <ShotAgent name="New Agent" role="Sales" />
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-medium">New Agent</p>
            <p className="text-xs text-muted-foreground">Research</p>
          </div>
          <div className="flex-1 space-y-3 px-5 py-5">
            <div className="ml-10 rounded-2xl bg-secondary px-3.5 py-2.5 text-sm leading-6">
              Competitor scan of the Brand Kit site. Pause for approval.
            </div>
            <div className="mr-6 rounded-2xl border border-border px-3.5 py-2.5 text-sm leading-6 text-muted-foreground">
              Plan ready. browse → write_artifact → ask_user.
            </div>
          </div>
          <div className="border-t border-border px-5 py-3">
            <div className="rounded-2xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground">
              Give this agent a job…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShotAgent({
  name,
  role,
  active,
}: {
  name: string;
  role: string;
  active?: boolean;
}) {
  return (
    <div
      className={
        active
          ? "mx-2 flex items-center gap-2.5 rounded-lg bg-secondary px-2 py-2"
          : "mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2"
      }
    >
      <span className="grid size-7 place-items-center rounded-full bg-secondary text-[11px] font-medium">
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{role}</span>
      </span>
    </div>
  );
}
