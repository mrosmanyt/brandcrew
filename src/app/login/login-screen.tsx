"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AuthDivider,
  AuthQueryError,
  GoogleContinueButton,
} from "@/components/auth/google-continue";
import { HoneypotField } from "@/components/auth/honeypot-field";
import { BrandMark } from "@/components/brand/logo";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authHrefWithNext, checkoutPlanFromNextPath } from "@/lib/billing-ui";
import { PLANS } from "@/lib/constants";
import { validateLoginInput } from "@/lib/form-guard";
import { HONEYPOT_FIELD } from "@/lib/site";
import { safeNextPath } from "@/lib/google-auth-shared";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get("next");
  const checkoutPlan = checkoutPlanFromNextPath(next);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateLoginInput(email, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, [HONEYPOT_FIELD]: honeypot }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in.");
      return;
    }
    router.push(safeNextPath(next, "/desk"));
    router.refresh();
  }

  return (
    <MarketingShell>
      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <BrandMark />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={authHrefWithNext("/signup", next)} />}
          >
            Create account
          </Button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-sm">
            <h1 className="font-heading text-3xl tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Open the CINEM Pro desk you already set up.
            </p>
            {checkoutPlan ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                After you sign in, we open desk billing for {PLANS[checkoutPlan].name}.
                Checkout uses Whop when configured.
              </p>
            ) : null}
            <div className="mt-8 space-y-5">
              <GoogleContinueButton intent="login" next={next} />
              <AuthDivider />
              <form onSubmit={onSubmit} className="relative space-y-5">
                <HoneypotField value={honeypot} onChange={setHoneypot} />
                <Field label="Email">
                  <Input
                    className="h-10 bg-white"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Password">
                  <Input
                    className="h-10 bg-white"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                <AuthQueryError error={params.get("error")} hint={params.get("hint")} />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function LoginScreen() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
