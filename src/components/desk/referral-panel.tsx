"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type InvitePayload = {
  inviteUrl?: string;
  inviteCode?: string;
  referralBonusMonths?: number;
  inviterRedemptions?: number;
  inviterCap?: number;
  inviterCapReached?: boolean;
  perk?: string;
};

/** Surfaces the existing /api/user/invite referral backend in the desk. */
export function ReferralPanel() {
  const [data, setData] = useState<InvitePayload | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/invite");
      if (!res.ok) return;
      setData((await res.json()) as InvitePayload);
    } catch {
      /* offline — leave panel empty */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyInvite() {
    if (!data?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      toast.success("Invite link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Gift className="size-4" /> Invite a friend
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {data?.perk ?? "Share your link — you both get a free month when they sign up."}
      </p>
      {data?.inviteUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="break-all rounded-md bg-muted px-2 py-1 text-xs">
            {data.inviteUrl}
          </code>
          <Button type="button" size="sm" variant="secondary" onClick={() => void copyInvite()}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
      {typeof data?.referralBonusMonths === "number" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Bonus months earned: {data.referralBonusMonths} · Successful invites:{" "}
          {data.inviterRedemptions ?? 0}
          {data.inviterCap ? ` / ${data.inviterCap}` : ""}
          {data.inviterCapReached ? " (cap reached)" : ""}
        </p>
      ) : null}
    </section>
  );
}
