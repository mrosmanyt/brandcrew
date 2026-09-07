"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/logo";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

type InviteInfo = {
  email: string;
  workspaceName: string;
  workspaceId: string;
  expired: boolean;
  accepted: boolean;
};

export function InviteAcceptScreen({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [emailMatches, setEmailMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invite not found.");
        return;
      }
      setInfo(data.invite);
      setSignedIn(Boolean(data.signedIn));
      setEmailMatches(Boolean(data.emailMatches));
    })();
  }, [token]);

  async function accept() {
    setBusy(true);
    const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
      method: "POST",
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not accept that invite.");
      return;
    }
    router.push(`/desk/${data.workspace.id}`);
    router.refresh();
  }

  const signupHref = `/signup?invite=${encodeURIComponent(token)}${
    info?.email ? `&email=${encodeURIComponent(info.email)}` : ""
  }`;
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <MarketingShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-16">
        <BrandMark />
        <p className="page-kicker mt-10">Invite</p>
        <h1 className="font-heading mt-2 text-3xl tracking-tight">
          Join a shared desk
        </h1>
        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : !info ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading invite…</p>
        ) : info.expired || info.accepted ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This invite is no longer valid.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You were invited to <strong>{info.workspaceName}</strong> as{" "}
              <strong>{info.email}</strong>. Seat limits follow the workspace plan.
            </p>
            {signedIn && emailMatches ? (
              <Button className="mt-6" onClick={accept} disabled={busy}>
                {busy ? "Joining…" : "Accept invite"}
              </Button>
            ) : signedIn ? (
              <p className="mt-6 text-sm text-muted-foreground">
                You are signed in as a different email. Sign out, then sign in as{" "}
                {info.email}.
              </p>
            ) : (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href={signupHref} />}>
                  Create account
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href={loginHref} />}>
                  Sign in
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MarketingShell>
  );
}
