"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create the account.");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="landing-glow pointer-events-none absolute inset-0" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/">
          <BrandMark />
        </Link>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
          Sign in
        </Button>
      </header>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card/80 p-6 backdrop-blur">
          <p className="page-kicker">Get started</p>
          <h1 className="font-heading mt-2 text-2xl">Start a desk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We create a demo workspace with the Northline Studio Brand Kit so you
            can open Mission Control, create agents, and give a real job.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Your name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
