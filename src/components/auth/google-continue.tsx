"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  googleAuthErrorMessage,
  googleLoginStartHref,
  type GoogleLoginIntent,
} from "@/lib/google-auth-shared";
import "@/lib/desktop-client";

function isCinemDesktopShell() {
  return Boolean(typeof window !== "undefined" && window.brandcrewDesktop?.desktop);
}

function DesktopCinemSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const startSignIn = window.brandcrewDesktop?.startCinemSignIn;
    if (!startSignIn) {
      setError("Desktop sign-in is unavailable. Update CINEM Pro and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await startSignIn();
      if (
        result &&
        typeof result === "object" &&
        "ok" in result &&
        result.ok === false
      ) {
        const message =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not start CINEM Pro sign-in.";
        setError(message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start CINEM Pro sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full gap-2 border-border bg-card text-foreground hover:bg-muted"
        disabled={busy}
        onClick={() => void start()}
      >
        {busy ? "Waiting for browser…" : "Sign in with CINEM Pro"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Opens your browser so Google can finish. Same account as AI Assistant — one
        sign-in unlocks both.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.09 15.23 0 12 0 7.31 0 3.23 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

type GoogleStatus = {
  ready: boolean;
  setupHint: string;
};

export function GoogleContinueButton({
  intent,
  next,
  invite,
  refCode,
}: {
  intent: GoogleLoginIntent;
  next?: string | null;
  invite?: string | null;
  refCode?: string | null;
}) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isCinemDesktopShell());
  }, []);

  useEffect(() => {
    if (desktop) return;
    let cancelled = false;
    fetch("/api/auth/google?format=json")
      .then((res) => res.json())
      .then((data: GoogleStatus & { error?: string }) => {
        if (!cancelled) {
          setStatus({
            ready: Boolean(data.ready),
            setupHint: data.setupHint || data.error || "",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            ready: false,
            setupHint:
              "Could not check Google sign-in. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [desktop]);

  if (desktop) return <DesktopCinemSignIn />;

  const href = googleLoginStartHref({ intent, next, invite, ref: refCode });

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="h-10 w-full gap-2 border-border bg-card text-foreground hover:bg-muted"
        nativeButton={false}
        render={<a href={href} />}
      >
        <GoogleMark />
        Continue with Google
      </Button>
      {status && !status.ready ? (
        <p className="text-xs leading-5 text-muted-foreground">{status.setupHint}</p>
      ) : null}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border" />
      </div>
      <p className="relative mx-auto w-fit bg-background px-3 text-xs text-muted-foreground">
        or continue with email
      </p>
    </div>
  );
}

export function AuthQueryError({
  error,
  hint,
}: {
  error?: string | null;
  hint?: string | null;
}) {
  const message = googleAuthErrorMessage(error ?? null, hint);
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
