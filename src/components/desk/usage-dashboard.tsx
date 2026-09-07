"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InviteTeam } from "@/components/desk/invite-team";
import { ScheduleJobs } from "@/components/desk/schedule-jobs";
import type { AgentDTO } from "@/lib/job-types";

type UsagePayload = {
  limits: {
    plan: string;
    tokenUsed: number;
    tokenBudget: number;
    tokensLeft: number;
    jobsThisHour: number;
    jobsPerHour: number;
    jobsLeftThisHour: number;
    concurrentJobs: number;
    maxConcurrentJobs: number;
    seats: number;
    seatUsed: number;
    seatsLeft: number;
  };
  jobs: number;
  approved: number;
  estimateUsd: number;
  estimateNote: string;
  events: { id: string; tokens: number; model: string; agentRole: string; createdAt: string }[];
};

export function UsageDashboard({
  workspaceId,
  agents,
}: {
  workspaceId: string;
  agents: AgentDTO[];
}) {
  const [data, setData] = useState<UsagePayload | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/usage`);
      if (!res.ok) return;
      setData(await res.json());
    })();
  }, [workspaceId]);

  const limits = data?.limits;

  return (
    <div className="desk-page max-w-3xl">
      <p className="page-kicker">Usage</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Workspace usage</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Tokens and jobs are capped by the current plan. Remaining counts update
        as jobs run.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat
          label="Tokens remaining"
          value={
            limits
              ? `${limits.tokensLeft.toLocaleString()} / ${limits.tokenBudget.toLocaleString()}`
              : "…"
          }
          hint={limits ? `${limits.tokenUsed.toLocaleString()} used this cycle` : ""}
        />
        <Stat
          label="Jobs this hour"
          value={
            limits
              ? `${limits.jobsThisHour} / ${limits.jobsPerHour}`
              : "…"
          }
          hint={limits ? `${limits.jobsLeftThisHour} left this hour` : ""}
        />
        <Stat
          label="Jobs (all time)"
          value={data ? String(data.jobs) : "…"}
          hint={data ? `${data.approved} artifacts approved` : ""}
        />
        <Stat
          label="Cost estimate (stub)"
          value={data ? `$${data.estimateUsd.toFixed(2)}` : "…"}
          hint={data?.estimateNote || ""}
        />
        <Stat
          label="Seats"
          value={
            limits ? `${limits.seatUsed} / ${limits.seats}` : "…"
          }
          hint={limits ? `${limits.seatsLeft} seat${limits.seatsLeft === 1 ? "" : "s"} left` : ""}
        />
        <Stat
          label="Plan"
          value={limits?.plan ?? "…"}
          hint="Starter $20 · Pro $79 · Ultra $200"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/desk/${workspaceId}/billing`} />}
        >
          Plans
        </Button>
      </div>

      {data?.events?.length ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Recent token events</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.events.slice(0, 12).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>
                  {row.agentRole || "job"} · {row.model}
                </span>
                <span className="text-muted-foreground">
                  {row.tokens.toLocaleString()} tok
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8">
        <InviteTeam workspaceId={workspaceId} />
      </div>
      <div className="mt-6">
        <ScheduleJobs workspaceId={workspaceId} agents={agents} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </article>
  );
}
