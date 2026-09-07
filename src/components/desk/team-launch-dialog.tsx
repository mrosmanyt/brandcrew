"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import type { ProposedAgent } from "@/lib/team-launch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TeamLaunchDialog({
  open,
  onOpenChange,
  proposal,
  busy,
  onApprove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: ProposedAgent[];
  busy: boolean;
  onApprove: (agents: ProposedAgent[], startOnboardingJobs: boolean) => void;
}) {
  const [rows, setRows] = useState(proposal);
  const [startJobs, setStartJobs] = useState(false);
  const included = useMemo(
    () => rows.filter((row) => row.included !== false),
    [rows],
  );

  useEffect(() => {
    if (open) {
      setRows(proposal.map((row) => ({ ...row, name: row.name || DEFAULT_AGENT_NAME })));
      setStartJobs(false);
    }
  }, [open, proposal]);

  function syncOpen(next: boolean) {
    if (next) {
      setRows(proposal.map((row) => ({ ...row, name: DEFAULT_AGENT_NAME })));
      setStartJobs(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={syncOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Launch a full business team</DialogTitle>
          <DialogDescription>
            Creates real agents in this workspace. Display names stay “New Agent”
            until you rename them. This does not invent job results.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <li
              key={row.templateId || row.role}
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={row.included !== false}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, included: e.target.checked } : item,
                      ),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                    className="h-7 font-medium"
                    aria-label={`${row.role} display name`}
                  />
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.role} · {row.blurb}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={startJobs}
            onChange={(e) => setStartJobs(e.target.checked)}
          />
          <span>
            After create, start one real research job (fetch the Brand Kit website).
            Off by default — installing agents is not fake output.
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => syncOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || included.length < 1}
            onClick={() => onApprove(rows, startJobs)}
          >
            Approve & create {included.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
