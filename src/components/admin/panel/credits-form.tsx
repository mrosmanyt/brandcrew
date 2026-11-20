"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Adjust a user's credit budget (workspace tokenBudget; credits wrap it
 * 1:1). Reason is required and lands in the admin audit log server-side.
 */
export function CreditsForm({
  userId,
  currentBudget,
  creditsUsed,
}: {
  userId: string;
  currentBudget: number;
  creditsUsed: number;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(currentBudget));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = Number(budget);
    if (!Number.isFinite(next) || next < 1_000 || next > 5_000_000) {
      toast.error("Budget must be between 1,000 and 5,000,000 credits.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Add a short reason — it is written to the activity log.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_credits",
          userId,
          newBudget: Math.floor(next),
          reason: reason.trim(),
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Adjustment failed.");
      toast.success(`Credit budget set to ${Math.floor(next).toLocaleString()}.`);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 px-5 py-4">
      <p className="text-xs leading-5 text-muted-foreground">
        Credits wrap this workspace&apos;s token budget 1:1. Used so far:{" "}
        {creditsUsed.toLocaleString()}. Changing the budget never changes the
        plan — plans stay with Whop.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          New credit budget
        </span>
        <input
          type="number"
          min={1_000}
          max={5_000_000}
          step={1_000}
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Reason (logged)
        </span>
        <input
          type="text"
          maxLength={240}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Goodwill top-up after outage"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
      >
        {busy ? "Saving…" : "Save credit budget"}
      </button>
    </form>
  );
}
