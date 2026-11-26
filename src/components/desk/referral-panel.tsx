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
  imagePerk?: string;
  imageCredits?: {
    dailyFreeLimit: number;
    dailyFreeLeft: number;
    bonusCredits: number;
    bonusImages: number;
    referralGrantImages: number;
    referralEarnedCredits: number;
    referralGrantedInvites: number;
    referralInviterCap: number;
    referralCapReached: boolean;
    referralPendingUnlock: boolean;
  };
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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
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
      {data?.imageCredits ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {data.imagePerk ??
              "You both earn image credits when a friend you invite creates their first image."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Free images today: {data.imageCredits.dailyFreeLeft} of{" "}
            {data.imageCredits.dailyFreeLimit} left · Bonus image credits:{" "}
            {data.imageCredits.bonusCredits.toLocaleString()} (covers{" "}
            {data.imageCredits.bonusImages}{" "}
            {data.imageCredits.bonusImages === 1 ? "image" : "images"}) ·
            Referral image credits earned:{" "}
            {data.imageCredits.referralEarnedCredits.toLocaleString()} from{" "}
            {data.imageCredits.referralGrantedInvites} /{" "}
            {data.imageCredits.referralInviterCap} friends
            {data.imageCredits.referralCapReached ? " (cap reached)" : ""}
          </p>
          {data.imageCredits.referralPendingUnlock ? (
            <p className="mt-1 text-xs text-muted-foreground">
              You were invited — create your first image to unlock your
              referral image credits.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
