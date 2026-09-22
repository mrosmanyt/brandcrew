"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { displayAgentName } from "@/lib/constants";
import { FEATURED_JOB_TEMPLATES } from "@/lib/job-templates";
import type { AgentDTO } from "@/lib/job-types";
import { SCHEDULE_CADENCES } from "@/lib/schedule-cadence";

type ScheduleRow = {
  id: string;
  title: string;
  cadenceLabel: string;
  nextRunAt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  isOverdue?: boolean;
};

const CUSTOM_INTERVAL_VALUE = "custom";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function ScheduleJobs({
  workspaceId,
  agents,
}: {
  workspaceId: string;
  agents: AgentDTO[];
}) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [note, setNote] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(FEATURED_JOB_TEMPLATES[0]?.id ?? "");
  const [cadence, setCadence] = useState<string>("weekly_monday");
  const [intervalDays, setIntervalDays] = useState(2);
  const [timezone, setTimezone] = useState(() => browserTimezone());
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/schedules`);
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.schedules ?? []);
    if (data.note) setNote(data.note);
  }

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  useEffect(() => {
    if (!agentId && agents[0]) setAgentId(agents[0].id);
  }, [agents, agentId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const template = FEATURED_JOB_TEMPLATES.find((row) => row.id === templateId);
    if (!agentId || !template) {
      toast.error("Pick an agent and a playbook.");
      return;
    }
    setBusy(true);
    const effectiveCadence =
      cadence === CUSTOM_INTERVAL_VALUE ? `interval:${Math.max(1, intervalDays)}` : cadence;
    const res = await fetch(`/api/workspaces/${workspaceId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        title: template.title,
        message: template.message,
        playbookKey: template.playbookKey,
        cadence: effectiveCadence,
        timezone,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not save that schedule.");
      return;
    }
    toast.success("Schedule saved. It runs when the desk loads or daily cron fires.");
    await refresh();
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch(`/api/workspaces/${workspaceId}/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      toast.error("Could not update schedule.");
      return;
    }
    await refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/schedules/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not delete schedule.");
      return;
    }
    await refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Scheduled jobs</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Example: every Monday LinkedIn week. Times are 09:00 in the schedule&apos;s timezone.{" "}
        {note ||
          "Serverless hosts are not always-on — we check when you open the desk, plus an optional daily cron."}
      </p>
      <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Agent">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            {agents.length === 0 ? <option value="">Create an agent first</option> : null}
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {displayAgentName(agent.name)}
                {agent.role ? ` · ${agent.role}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Playbook">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {FEATURED_JOB_TEMPLATES.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cadence">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            {SCHEDULE_CADENCES.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
            <option value={CUSTOM_INTERVAL_VALUE}>Every N days…</option>
          </select>
        </Field>
        {cadence === CUSTOM_INTERVAL_VALUE ? (
          <Field label="Repeat every N days">
            <input
              type="number"
              min={1}
              max={365}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value) || 1)}
            />
          </Field>
        ) : null}
        <Field label="Timezone">
          <input
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Asia/Karachi"
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy || !agentId}>
            {busy ? "Saving…" : "Schedule"}
          </Button>
        </div>
      </form>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No schedules yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="text-sm">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.cadenceLabel} ({row.timezone || "UTC"}) · next{" "}
                  {new Date(row.nextRunAt).toLocaleString()}
                  {row.enabled ? "" : " · paused"}
                  {row.isOverdue ? " · overdue — open the desk or hit /api/cron/jobs" : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => toggle(row.id, !row.enabled)}
                >
                  {row.enabled ? "Pause" : "Resume"}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => remove(row.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
