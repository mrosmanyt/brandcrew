"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AuthDivider,
  AuthQueryError,
  GoogleContinueButton,
} from "@/components/auth/google-continue";
import { BrandMark } from "@/components/brand/logo";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get("next");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in.");
      return;
    }
    router.push(next || "/desk");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <GoogleContinueButton intent="login" next={next} />
      <AuthDivider />
      <form onSubmit={onSubmit} className="space-y-5">
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
    <MarketingShell>
      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <BrandMark />
          </Link>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/signup" />}>
            Create account
          </Button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-sm">
            <h1 className="font-heading text-3xl tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Open the CINEM Pro desk you already set up.
            </p>
            <div className="mt-8">
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
