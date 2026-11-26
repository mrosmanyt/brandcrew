"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type InvitePayload = {
  inviteUrl?: string;
  imagePerk?: string;
  imageCredits?: {
    dailyFreeLimit: number;
    dailyFreeLeft: number;
    bonusCredits: number;
    bonusImages: number;
    referralEarnedCredits: number;
    referralGrantedInvites: number;
    referralInviterCap: number;
    referralCapReached: boolean;
    referralPendingUnlock: boolean;
  };
};

/**
 * Chat Settings section for Package 3: the user's free daily images,
 * referral-earned bonus image credits, and their shareable invite link.
 * Reads the same /api/user/invite payload as the desk ReferralPanel.
 * Renders nothing until the payload arrives so the panel never shows
 * placeholder numbers.
 */
export function InviteCreditsSection() {
  const [data, setData] = useState<InvitePayload | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/invite");
      if (!res.ok) return;
      setData((await res.json()) as InvitePayload);
    } catch {
      /* offline — leave the section empty */
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

  const credits = data?.imageCredits;
  if (!credits) return null;

  return (
    <section className="mt-8">
      <h3 className="text-sm font-medium">Image credits &amp; invites</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Everyone gets {credits.dailyFreeLimit} free images a day. Invite a
        friend — when they create their first image, you both earn image
        credits.
      </p>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Free images today: {credits.dailyFreeLeft} of {credits.dailyFreeLimit}{" "}
        left · Bonus image credits: {credits.bonusCredits.toLocaleString()}{" "}
        (covers {credits.bonusImages}{" "}
        {credits.bonusImages === 1 ? "image" : "images"}) · Earned from
        referrals: {credits.referralEarnedCredits.toLocaleString()} credits
        from {credits.referralGrantedInvites} / {credits.referralInviterCap}{" "}
        friends{credits.referralCapReached ? " (cap reached)" : ""}
      </p>
      {credits.referralPendingUnlock ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          You were invited — create your first image to unlock your referral
          image credits.
        </p>
      ) : null}
      {data?.inviteUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="break-all rounded-md bg-muted px-2 py-1 text-xs">
            {data.inviteUrl}
          </code>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void copyInvite()}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
