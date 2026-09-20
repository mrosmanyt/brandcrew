import { Copy, Gift, Check, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { openExternal } from "@/lib/desktop-shell";
import { cinemCloudOrigin, readSession, withFreshAccess } from "@/lib/cinemCloud";
import { notify } from "@/store/useToastStore";

type InvitePayload = {
  inviteUrl?: string | null;
  inviteCode?: string | null;
  referralBonusMonths?: number;
  inviterRedemptions?: number;
  inviterCap?: number;
  perk?: string;
};

/** Share invite link. Existing bonus months still show; new grants are stopped. */
export default function InviteSharePanel() {
  const [data, setData] = useState<InvitePayload | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const session = readSession();
    if (!session?.accessToken && !session?.refreshToken) return;
    try {
      await withFreshAccess(async (accessToken) => {
        const res = await fetch(`${cinemCloudOrigin()}/api/user/invite`, {
          headers: { Authorization: `Bearer ${accessToken}`, "X-Cinem-Client": "assistant" },
        });
        const json = (await res.json()) as InvitePayload;
        setData(json);
      });
    } catch {
      /* not signed in */
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
      notify("success", "Invite link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("error", "Could not copy link.");
    }
  }

  if (!readSession()?.accessToken && !readSession()?.refreshToken) {
    return (
      <p className="text-xs text-neon-dim">Sign in to share your invite link.</p>
    );
  }

  return (
    <div className="space-y-2 rounded border border-neon/15 bg-abyss/40 p-3 text-xs">
      <p className="flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
        <Gift className="size-3.5" /> INVITE A FRIEND
      </p>
      <p className="text-neon-dim">{data?.perk ?? "Loading invite perk…"}</p>
      {data?.inviteUrl ? (
        <>
          <p className="break-all text-ice/90">{data.inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
              onClick={() => void copyInvite()}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              Copy invite link
            </button>
            <button
              type="button"
              className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
              onClick={() => void openExternal(data.inviteUrl!)}
            >
              <ExternalLink className="size-3" /> Preview signup
            </button>
          </div>
        </>
      ) : null}
      {typeof data?.referralBonusMonths === "number" ? (
        <p className="text-neon-dim/80">
          Your bonus months: {data.referralBonusMonths} · Successful invites: {data.inviterRedemptions ?? 0}
          {data.inviterCap ? ` / ${data.inviterCap}` : ""}
        </p>
      ) : null}
    </div>
  );
}
