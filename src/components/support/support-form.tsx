"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BillingProvider } from "@/lib/billing-ui";
import { supportCheckoutLabel } from "@/lib/billing-ui";
import {
  formatSupportUsd,
  parseSupportAmountUsd,
  SUPPORT_CHIPS_USD,
  SUPPORT_MAX_USD,
  SUPPORT_MIN_USD,
  supportAmountError,
  supportHeadline,
} from "@/lib/support";

export function SupportForm({
  workspaceId,
  provider,
  compact = false,
  defaultAmount = 20,
}: {
  workspaceId?: string | null;
  provider: BillingProvider;
  compact?: boolean;
  defaultAmount?: number;
}) {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [busy, setBusy] = useState(false);
  const parsed = parseSupportAmountUsd(amount);

  async function submit() {
    const error = supportAmountError(amount);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          ...(workspaceId ? { workspaceId } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string | null;
        mock?: boolean;
        supporter?: boolean;
      };
      if (!res.ok) {
        toast.error(data.error || "Support checkout failed.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.success(
        data.supporter
          ? `Shukriya — ${supportHeadline()} is marked on this account (mock billing).`
          : "Shukriya — mock Support recorded. Sign in to keep a Supporter badge.",
      );
    } catch {
      toast.error("Support checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap gap-2">
        {SUPPORT_CHIPS_USD.map((chip) => (
          <Button
            key={chip}
            type="button"
            size="sm"
            variant={parsed === chip ? "default" : "outline"}
            onClick={() => setAmount(String(chip))}
          >
            {formatSupportUsd(chip)}
          </Button>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="support-amount">Custom amount (USD)</Label>
        <Input
          id="support-amount"
          inputMode="decimal"
          min={SUPPORT_MIN_USD}
          max={SUPPORT_MAX_USD}
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={parsed === null}
        />
        <p className="text-xs text-muted-foreground">
          {formatSupportUsd(SUPPORT_MIN_USD)}–{formatSupportUsd(SUPPORT_MAX_USD)}. One-time, not a
          subscription.
        </p>
      </div>
      <Button type="button" disabled={busy || parsed === null} onClick={() => void submit()}>
        {busy ? "Working…" : supportCheckoutLabel(provider)}
      </Button>
    </div>
  );
}
