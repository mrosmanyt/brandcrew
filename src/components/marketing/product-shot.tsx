/** CSS chrome of Mission Control — labels match real product, not canned job copy. */
export function ProductShot() {
  return (
    <div className="product-frame overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="size-2 rounded-full bg-zinc-600" />
        <span className="size-2 rounded-full bg-zinc-600" />
        <span className="size-2 rounded-full bg-zinc-600" />
        <span className="ml-2 text-[11px] text-muted-foreground">
          Mission Control · CINEM Pro
        </span>
      </div>
      <div className="grid min-h-[22rem] bg-background md:grid-cols-[11.5rem_minmax(0,1fr)_12.5rem]">
        <div className="hidden border-r border-border md:block">
          <p className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Agents
          </p>
          <ShotAgent name="New Agent" role="Research" active />
          <ShotAgent name="New Agent" role="Writer" />
          <ShotAgent name="New Agent" role="Sales" />
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Research
            </p>
            <p className="text-sm font-medium tracking-tight">New Agent</p>
          </div>
          <div className="flex-1 space-y-2.5 px-4 py-3">
            <div className="ml-8 rounded-lg bg-secondary px-3 py-2 text-xs leading-5">
              Competitor scan of the Brand Kit site. Pause for approval.
            </div>
            <div className="mr-4 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
              Plan ready. browse → write_artifact → ask_user.
            </div>
          </div>
          <div className="border-t border-border p-3">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Give this agent a job…
            </div>
          </div>
        </div>
        <div className="hidden border-l border-border md:block">
          <p className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Live activity
          </p>
          <ol className="space-y-2.5 px-3 pb-3 text-[11px] text-muted-foreground">
            <li>plan · 4 steps</li>
            <li>read_brand_kit</li>
            <li>browser_navigate</li>
            <li className="text-foreground">ask_user · needs you</li>
          </ol>
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
          ? "mx-1.5 flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5"
          : "mx-1.5 flex items-center gap-2 rounded-md px-2 py-1.5"
      }
    >
      <span className="grid size-6 place-items-center rounded-full bg-secondary text-[10px] font-medium">
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs">{name}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{role}</span>
      </span>
    </div>
  );
}
