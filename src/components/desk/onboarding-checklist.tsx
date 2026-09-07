import Link from "next/link";
import { Check } from "lucide-react";
import type { ChecklistState } from "@/lib/checklist";
import { cn } from "@/lib/utils";

export function OnboardingChecklist({
  workspaceId,
  checklist,
}: {
  workspaceId: string;
  checklist: ChecklistState;
}) {
  if (checklist.doneCount === checklist.total) return null;

  const steps = [
    {
      done: checklist.brandKit,
      label: "Fill the Brand Kit",
      href: `/desk/${workspaceId}/brand-kit`,
    },
    {
      done: checklist.strategist,
      label: "Give Strategist a job",
      href: `/desk/${workspaceId}?agent=strategist`,
    },
    {
      done: checklist.writer,
      label: "Give Maya a LinkedIn-week job",
      href: `/desk/${workspaceId}?agent=writer`,
    },
    {
      done: checklist.approved,
      label: "Approve one artifact",
      href: `/desk/${workspaceId}?agent=writer`,
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-xl">First wow</h2>
        <p className="text-xs text-muted-foreground">
          {checklist.doneCount} / {checklist.total}
        </p>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-muted"
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full border",
                  step.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3" /> : null}
              </span>
              <span className={cn(step.done && "text-muted-foreground line-through")}>
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
