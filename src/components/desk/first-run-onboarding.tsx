"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingState } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function FirstRunOnboarding({
  state,
  busy,
  onDismiss,
  onCreateAgent,
  onRunJob,
  onApprove,
}: {
  state: OnboardingState;
  busy?: boolean;
  onDismiss: () => void;
  onCreateAgent: () => void;
  onRunJob: () => void;
  onApprove: () => void;
}) {
  const current = state.steps.find((step) => !step.done) ?? state.steps[2];

  return (
    <section className="mx-4 mt-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            First run
          </p>
          <h2 className="text-sm font-medium">Three steps, then the desk is yours</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {state.doneCount} / {state.total} · dismiss anytime
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss onboarding"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {state.steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border text-[11px]",
                step.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {step.done ? <Check className="size-3" /> : index + 1}
            </span>
            <span className={cn(step.done && "text-muted-foreground line-through")}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3">
        {current?.id === "agent" ? (
          <Button size="sm" onClick={onCreateAgent} disabled={busy}>
            Create New Agent
          </Button>
        ) : null}
        {current?.id === "job" ? (
          <Button size="sm" onClick={onRunJob} disabled={busy}>
            Run first job
          </Button>
        ) : null}
        {current?.id === "approve" ? (
          <Button size="sm" onClick={onApprove} disabled={busy}>
            Approve
          </Button>
        ) : null}
      </div>
    </section>
  );
}
