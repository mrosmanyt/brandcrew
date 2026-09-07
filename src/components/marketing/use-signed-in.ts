"use client";

import { useEffect, useState } from "react";

/**
 * Marketing/auth screens are static HTML. Session is httpOnly, so we ask
 * /api/auth/me after hydration. First paint matches the signed-out CTA.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: unknown }) => {
        if (!cancelled) setSignedIn(Boolean(data?.user));
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return signedIn;
}
