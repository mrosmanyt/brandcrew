"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  GOOGLE_ID_TOKEN_PATH,
  googleAuthErrorMessage,
  googleLoginStartHref,
  type GoogleLoginIntent,
} from "@/lib/google-auth-shared";

// The retired Electron shell exposed this preload bridge for its Google
// sign-in hand-off. The web product never sets it; the declaration stays
// local so the (now unreachable) desktop branch below keeps type-checking.
// Minimal Google Identity Services surface used by the on-page Google
// button (no official TS types ship with the GSI client script).
type GisCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GisCredentialResponse) => void;
        nonce?: string;
        auto_select?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          shape?: "rectangular" | "pill" | "circle" | "square";
          logo_alignment?: "left" | "center";
          width?: number;
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    brandcrewDesktop?: {
      desktop?: boolean;
      startCinemSignIn?: () => Promise<unknown>;
    };
    google?: GoogleIdentityServices;
  }
}

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

let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiScriptPromise = null;
        reject(new Error("Could not load Google sign-in."));
      };
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

function randomNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Classic full-page Google sign-in (Supabase OAuth redirect flow). */
function GoogleRedirectButton({ href }: { href: string }) {
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
    </div>
  );
}

/**
 * On-page Google sign-in via Google Identity Services. Google's own button
 * and account chooser run on our origin under our OAuth client, so users
 * never see the Supabase project domain. The ID token is exchanged for a
 * Supabase session by POST /api/auth/google/id-token. Any failure of the
 * GIS load or the token exchange falls back to the classic full-page flow,
 * so sign-in can never be fully broken by this path.
 */
function GoogleGisSignIn({
  clientId,
  intent,
  next,
  invite,
  refCode,
}: {
  clientId: string;
  intent: GoogleLoginIntent;
  next?: string | null;
  invite?: string | null;
  refCode?: string | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nonceRef = useRef<string | null>(null);
  if (nonceRef.current === null) nonceRef.current = randomNonce();
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackHref = googleLoginStartHref({ intent, next, invite, ref: refCode });

  async function onCredential(response: GisCredentialResponse) {
    if (!response.credential) {
      window.location.assign(fallbackHref);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(GOOGLE_ID_TOKEN_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          nonce: nonceRef.current,
          intent,
          next: next || undefined,
          invite: invite || undefined,
          ref: refCode || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        path?: string;
        error?: string;
        code?: string;
      } | null;
      if (res.ok && data?.path) {
        router.push(data.path);
        router.refresh();
        return;
      }
      // Token exchange failed (or the endpoint is unavailable): fall back
      // to the classic full-page flow instead of stranding the user.
      if (!data || data.code === "id_token_failed" || res.status >= 500) {
        window.location.assign(fallbackHref);
        return;
      }
      setError(data.error || "Google sign-in failed. Try again.");
      setBusy(false);
    } catch {
      window.location.assign(fallbackHref);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const rawNonce = nonceRef.current ?? randomNonce();
        nonceRef.current = rawNonce;
        // Supabase's documented pattern: Google receives the SHA-256 hash
        // of the nonce; the raw nonce goes to signInWithIdToken.
        const hashedNonce = await sha256Hex(rawNonce);
        await loadGoogleIdentityServices();
        const id = window.google?.accounts?.id;
        const el = containerRef.current;
        if (!id || !el) throw new Error("Google sign-in is unavailable.");
        id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          auto_select: false,
          callback: (response) => {
            void onCredential(response);
          },
        });
        const width = Math.min(400, Math.max(240, el.clientWidth || 320));
        id.renderButton(el, {
          theme: "outline",
          size: "large",
          text: intent === "signup" ? "signup_with" : "continue_with",
          shape: "rectangular",
          width,
        });
        if (!cancelled) setPhase("ready");
      } catch {
        if (!cancelled) setPhase("failed");
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
    // One-time init per mount; the auth-form props are stable for its life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "failed") {
    return <GoogleRedirectButton href={fallbackHref} />;
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="flex min-h-10 items-center justify-center"
        style={busy ? { pointerEvents: "none", opacity: 0.6 } : undefined}
      />
      {phase === "loading" ? (
        <p className="text-center text-xs text-muted-foreground">
          Loading Google sign-in…
        </p>
      ) : null}
      {busy ? (
        <p className="text-center text-xs text-muted-foreground">Signing in…</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-center text-xs text-muted-foreground">
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href={fallbackHref}
        >
          Use the full-page Google sign-in
        </a>
      </p>
    </div>
  );
}

type GoogleStatus = {
  ready: boolean;
  clientId?: string;
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
    const timer = window.setTimeout(() => setDesktop(isCinemDesktopShell()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (desktop) return;
    let cancelled = false;
    fetch("/api/auth/google?format=json")
      .then((res) => res.json())
      .then((data: GoogleStatus) => {
        if (!cancelled) {
          setStatus({
            ready: Boolean(data.ready),
            clientId:
              typeof data.clientId === "string" && data.clientId
                ? data.clientId
                : undefined,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ ready: false });
      });
    return () => {
      cancelled = true;
    };
  }, [desktop]);

  if (desktop) return <DesktopCinemSignIn />;

  if (!status?.ready) {
    return (
      <p className="text-sm text-muted-foreground">
        {status ? "Google sign-in coming soon" : "\u00a0"}
      </p>
    );
  }

  if (status.clientId) {
    return (
      <GoogleGisSignIn
        clientId={status.clientId}
        intent={intent}
        next={next}
        invite={invite}
        refCode={refCode}
      />
    );
  }

  const href = googleLoginStartHref({ intent, next, invite, ref: refCode });

  return <GoogleRedirectButton href={href} />;
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
