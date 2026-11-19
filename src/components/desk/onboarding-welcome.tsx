"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * First-run welcome. The desk-era multi-step setup wizard (agent pick from
 * Marketplace bots, plugin OAuth, Brand Kit voice/style, agent model routing)
 * retired with the agent desk; what remains is naming the workspace and
 * marking setup done, then landing on Chat.
 */
export function OnboardingWelcome({
  workspaceId,
  workspaceName,
  userName,
}: {
  workspaceId: string;
  workspaceName: string;
  userName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspaceName);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    try {
      const trimmed = name.trim();
      const body: Record<string, unknown> = { setupWizardDone: true };
      if (trimmed && trimmed !== workspaceName) body.name = trimmed;
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not finish setup.");
      router.push("/chat");
      router.refresh();
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not finish setup.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-16">
      <p className="page-kicker">Welcome</p>
      <h1 className="font-heading mt-2 text-3xl tracking-tight">
        {userName ? `Welcome, ${userName}.` : "Welcome to CINEM Pro."}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        CINEM Pro is chat and image generation: ask any model, keep every
        conversation, and generate images — all metered in credits against
        your workspace. Name the workspace, then start chatting.
      </p>

      <form
        className="mt-8 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void finish();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-workspace-name">Workspace name</Label>
          <Input
            id="onboarding-workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My workspace"
          />
        </div>
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? "Opening chat…" : "Continue to chat"}
          </Button>
        </div>
      </form>
    </main>
  );
}
