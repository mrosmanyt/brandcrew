"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function CompanionPairInner() {
  const params = useSearchParams();
  const code = params.get("code") || "";
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    setBusy(true);
    void fetch("/api/companion/pair", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairCode: code }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not pair.");
        setStatus("Paired — send research or reminder commands from your phone.");
      })
      .catch((error) =>
        setStatus(error instanceof Error ? error.message : "Sign in with the same account first."),
      )
      .finally(() => setBusy(false));
  }, [code]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Mobile companion pairing</h1>
      <p className="text-sm text-muted-foreground">
        Pair your phone to trigger desk research and reminders. Sign in with the same CINEM Pro account
        you use in Cinem AI Assistant on desktop.
      </p>
      {code ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Code <strong>{code}</strong>: {busy ? "Claiming…" : status || "Waiting…"}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open the pair link from Settings → Remote → Mobile companion on the desktop assistant.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          nativeButton={false}
          render={<Link href={`/login?next=${encodeURIComponent(`/companion/pair${code ? `?code=${code}` : ""}`)}`} />}
        >
          Sign in
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/desk?companion=1" />}>
          Open desk
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        From phone after pairing: POST <code>/api/companion/command</code> with header{" "}
        <code>X-Companion-Token</code> and action <code>research</code> or <code>reminder</code>.
      </p>
    </main>
  );
}

export default function CompanionPairPage() {
  return (
    <Suspense fallback={<main className="px-6 py-16 text-sm text-muted-foreground">Loading…</main>}>
      <CompanionPairInner />
    </Suspense>
  );
}
