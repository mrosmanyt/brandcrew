"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Founding-member total slots — read live by the signup claim flow. */
export function FoundingForm({
  currentTotal,
  claimed,
}: {
  currentTotal: number;
  claimed: number;
}) {
  const router = useRouter();
  const [total, setTotal] = useState(String(currentTotal));
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = Number(total);
    if (!Number.isFinite(next) || next < claimed || next > 500) {
      toast.error(`Total must be between ${claimed} (already claimed) and 500.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_founding_slots", total: Math.floor(next) }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Save failed.");
      toast.success(`Founding spots total set to ${Math.floor(next)}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 px-5 py-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Total founding spots ({claimed} claimed)
        </span>
        <input
          type="number"
          min={claimed}
          max={500}
          value={total}
          onChange={(event) => setTotal(event.target.value)}
          className="w-36 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <p className="w-full text-xs text-muted-foreground">
        Takes effect immediately: new signups claim a spot only while spots
        remain. Lowering the total never removes a spot already claimed.
      </p>
    </form>
  );
}
