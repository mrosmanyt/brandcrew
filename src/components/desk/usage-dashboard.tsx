"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InviteTeam } from "@/components/desk/invite-team";
import { ScheduleJobs } from "@/components/desk/schedule-jobs";
import { FileActionsPanel } from "@/components/desk/file-actions-panel";
import { UsageChart } from "@/components/desk/usage-chart";
import { usageLookbackLabel } from "@/lib/credits";
import { publicModelLabel } from "@/lib/model-catalog";
import type { AgentDTO } from "@/lib/job-types";
import type { UsageDayPoint } from "@/lib/usage-series";

type UsagePayload = {
  limits: {
    plan: string;
    planLabel?: string;
    tokenUsed: number;
    tokenBudget: number;
    tokensLeft: number;
    creditsUsed?: number;
    creditsBudget?: number;
    creditsLeft?: number;
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
  days?: number;
  series?: UsageDayPoint[];
  seriesNote?: string;
  byModel?: { model: string; tokens: number; credits: number; events: number }[];
  events: {
    id: string;
    tokens: number;
    credits?: number;
    model: string;
    agentRole: string;
    createdAt: string;
  }[];
};

export function UsageDashboard({
  workspaceId,
  agents,
}: {
  workspaceId: string;
  agents: AgentDTO[];
}) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsagePayload | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/usage?days=${days}`);
      if (!res.ok) return;
      setData(await res.json());
    })();
  }, [workspaceId, days]);

  const limits = data?.limits;

  return (
    <div className="desk-page max-w-3xl">
      <p className="page-kicker">Usage</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Workspace usage</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The desk bills in <strong>credits</strong> (tokens 1:1). Chart totals below are a
        rolling lookback. Remaining credits are this billing cycle. Free / Pro / Pro Plus /
        Ultra are capped — there is no unlimited plan. Owners and admins can change the
        plan; members and approvers see caps only.
      </p>

      <div className="mt-6">
        {data?.series ? (
          <UsageChart
            series={data.series}
            remaining={limits?.creditsLeft ?? limits?.tokensLeft ?? 0}
            budget={limits?.creditsBudget ?? limits?.tokenBudget ?? 0}
            used={limits?.creditsUsed ?? limits?.tokenUsed ?? 0}
            note={data.seriesNote}
            days={data.days ?? days}
            onDaysChange={setDays}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Loading usage…
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat
          label="Credits remaining this cycle"
          value={
            limits
              ? `${(limits.creditsLeft ?? limits.tokensLeft).toLocaleString()} / ${(limits.creditsBudget ?? limits.tokenBudget).toLocaleString()}`
              : "…"
          }
          hint={
            limits
              ? `${(limits.creditsUsed ?? limits.tokenUsed).toLocaleString()} credits used this billing cycle`
              : ""
          }
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
          hint={
            data?.estimateNote ||
            "Rough stub — not a provider bill. This cycle’s credit budget is the hard stop."
          }
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
          value={limits?.planLabel ?? limits?.plan ?? "…"}
          hint="Pro $20 · Pro Plus $79 · Ultra $200"
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

      {data?.byModel?.length ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">
            By model ({usageLookbackLabel(data.days ?? days)})
          </h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.byModel.slice(0, 8).map((row) => (
              <li key={row.model} className="flex justify-between gap-3 py-2">
                <span>{publicModelLabel(row.model)}</span>
                <span className="text-muted-foreground">
                  {row.credits.toLocaleString()} credits · {row.events} calls
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data?.events?.length ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Recent credit events</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.events.slice(0, 12).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>
                  {row.agentRole || "job"} · {publicModelLabel(row.model)}
                </span>
                <span className="text-muted-foreground">
                  {(row.credits ?? row.tokens).toLocaleString()} credits
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
      <div className="mt-6">
        <FileActionsPanel workspaceId={workspaceId} agents={agents} />
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
