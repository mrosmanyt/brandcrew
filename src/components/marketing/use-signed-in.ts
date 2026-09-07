"use client";

import { useEffect, useState } from "react";

export type MarketingAuth = {
  signedIn: boolean;
  accountHref: string;
  deskHref: string;
};

const SIGNED_OUT: MarketingAuth = {
  signedIn: false,
  accountHref: "/login",
  deskHref: "/signup",
};

/**
 * Marketing/auth screens are static HTML. Session is httpOnly, so we ask
 * /api/auth/me after hydration. First paint matches the signed-out CTA.
 */
export function useMarketingAuth(): MarketingAuth {
  const [state, setState] = useState<MarketingAuth>(SIGNED_OUT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: unknown; workspaces?: Array<{ id: string }> }) => {
        if (cancelled) return;
        const signedIn = Boolean(data?.user);
        const workspaceId = data?.workspaces?.[0]?.id;
        setState(
          signedIn
            ? {
                signedIn: true,
                accountHref: workspaceId
                  ? `/desk/${workspaceId}/settings`
                  : "/desk",
                deskHref: workspaceId ? `/desk/${workspaceId}` : "/desk",
              }
            : SIGNED_OUT,
        );
      })
      .catch(() => {
        if (!cancelled) setState(SIGNED_OUT);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useSignedIn(): boolean {
  return useMarketingAuth().signedIn;
}
