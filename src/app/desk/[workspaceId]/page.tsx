import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingChecklist } from "@/components/desk/onboarding-checklist";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { parseBrandKit } from "@/lib/brand-kit";
import { workspaceChecklist } from "@/lib/checklist";
import { AGENT_META, AGENT_ROLES, PLANS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      artifacts: { orderBy: { createdAt: "desc" } },
      tasks: true,
      calendarItems: true,
    },
  });
  if (!workspace) redirect("/desk");

  const kit = parseBrandKit(workspace.brandKit);
  const plan = PLANS[(workspace.plan as keyof typeof PLANS) || "demo"] ?? PLANS.demo;
  const approved = workspace.artifacts.filter((a) => a.status === "approved").length;
  const checklist = workspaceChecklist(workspace);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <h1 className="font-heading mt-1 text-3xl tracking-tight">{workspace.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {kit.audience ||
            "Add an audience in the Brand Kit so the agents have a customer to write for."}
        </p>
      </div>

      <OnboardingChecklist workspaceId={workspace.id} checklist={checklist} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Plan" value={plan.name} />
        <Stat
          label="Tokens"
          value={`${workspace.tokenUsed.toLocaleString()} / ${workspace.tokenBudget.toLocaleString()}`}
        />
        <Stat label="Approved" value={String(approved)} />
      </div>

      <div>
        <h2 className="font-heading text-2xl">Agents</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {AGENT_ROLES.map((role) => {
            const meta = AGENT_META[role];
            const artifact = workspace.artifacts.find((a) => a.agentRole === role);
            return (
              <article key={role} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {meta.artifact}
                    </p>
                    <h3 className="font-heading mt-0.5 text-lg">{meta.label}</h3>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {artifact?.status ?? "empty"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{meta.blurb}</p>
                <div className="mt-3">
                  <Button size="sm" render={<Link href={`/desk/${workspaceId}/${role}`} />}>
                    {artifact ? `Open ${meta.label}` : meta.generateLabel}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="underline underline-offset-3" href={`/desk/${workspaceId}/brand-kit`}>
          Brand Kit
        </Link>
        <Link className="underline underline-offset-3" href={`/desk/${workspaceId}/calendar`}>
          {workspace.calendarItems.length} calendar posts
        </Link>
        <Link className="underline underline-offset-3" href={`/desk/${workspaceId}/ops`}>
          {workspace.tasks.length} ops tasks
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
