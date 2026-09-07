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
import { showcaseSignupHint } from "@/lib/integrations-showcase";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite") || "";
  const chipHint = showcaseSignupHint(params.get("chip"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        inviteToken: inviteToken || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create the account.");
      return;
    }
    if (data.workspaceId && data.joinedViaInvite) {
      router.push(`/desk/${data.workspaceId}`);
    } else {
      router.push("/onboarding");
    }
    router.refresh();
  }

  return (
    <MarketingShell>
      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <BrandMark />
          </Link>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-sm">
            <h1 className="font-heading text-3xl tracking-tight">Get started</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              We create a demo workspace with the Northline Studio Brand Kit so you
              can open Mission Control, create agents, and give a real job.
            </p>
            {inviteToken ? (
              <p className="mt-3 text-sm text-muted-foreground">
                You are joining a shared workspace. Use the invited email.
              </p>
            ) : null}
            {chipHint ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{chipHint}</p>
            ) : null}
            <div className="mt-8 space-y-5">
              <GoogleContinueButton intent="signup" invite={inviteToken || undefined} />
              <AuthDivider />
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label>Your name</Label>
                  <Input
                    className="h-10 bg-white"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    className="h-10 bg-white"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    className="h-10 bg-white"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <AuthQueryError error={params.get("error")} hint={params.get("hint")} />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}

export function SignupScreen() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
