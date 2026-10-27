"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { displayAgentName } from "@/lib/constants";
import type { AgentDTO } from "@/lib/job-types";

/**
 * Extracts text from a PDF/text file and hands it to an agent as a normal
 * job (summarize + suggest a filename). Runs the extraction server-side —
 * the file's bytes are uploaded here, nothing stays local to the browser.
 */
export function FileActionsPanel({
  workspaceId,
  agents,
}: {
  workspaceId: string;
  agents: AgentDTO[];
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !agentId) {
      toast.error("Pick an agent and a file.");
      return;
    }
    setBusy(true);
    setLastJobId(null);
    const form = new FormData();
    form.append("file", file);
    form.append("agentId", agentId);
    const res = await fetch(`/api/workspaces/${workspaceId}/file-actions`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not process that file.");
      return;
    }
    toast.success(
      data.truncated
        ? "Job started — file was long, only the first ~20k characters were used."
        : "Job started — check Mission Control for the summary.",
    );
    setLastJobId(data.jobId);
    setFile(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Summarize a file</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Upload a PDF or text file. It extracts on the server, then a normal
        job summarizes it and suggests a filename — same budget and review
        flow as any other job.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Agent</Label>
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
        </div>
        <div className="space-y-1.5">
          <Label>File (PDF, .txt, .md, .csv, .json — max 8MB)</Label>
          <input
            type="file"
            accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain"
            className="block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy || !file || !agentId}>
            {busy ? "Uploading…" : "Summarize"}
          </Button>
        </div>
      </form>
      {lastJobId ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Started job <code>{lastJobId}</code> — open Mission Control to review the draft.
        </p>
      ) : null}
    </section>
  );
}
