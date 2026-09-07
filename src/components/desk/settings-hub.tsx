"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bot,
  CreditCard,
  KeyRound,
  Mail,
  Plug,
  Store,
} from "lucide-react";
import { InviteTeam } from "@/components/desk/invite-team";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobDeskHref, settingsDeskLinks } from "@/lib/desk-settings";
import { displayAgentName } from "@/lib/constants";
import type { AgentDTO, JobDTO } from "@/lib/job-types";
import { jobStatusLabel } from "@/lib/live-progress";
import { cn } from "@/lib/utils";

type AccountUser = {
  id: string;
  email: string;
  name: string;
  hasPassword?: boolean;
  googleLinked?: boolean;
};

export function SettingsHub({
  workspaceId,
  workspaceName,
  user,
  initialJobs,
  agents,
}: {
  workspaceId: string;
  workspaceName: string;
  user: AccountUser;
  initialJobs: JobDTO[];
  agents: AgentDTO[];
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [workspaceTitle, setWorkspaceTitle] = useState(workspaceName);
  const [busy, setBusy] = useState<string | null>(null);
  const links = settingsDeskLinks(workspaceId);

  const hasPassword = user.hasPassword !== false;

  async function patchAccount(body: Record<string, string>) {
    const payload = { ...body };
    if (!payload.currentPassword) delete payload.currentPassword;
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not update account.");
    return data.user as AccountUser;
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    try {
      const next = await patchAccount({ currentPassword, email });
      setEmail(next.email);
      setCurrentPassword("");
      toast.success("Email updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change email.");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    try {
      await patchAccount({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setBusy(null);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy("name");
    try {
      const next = await patchAccount({ currentPassword, name });
      setName(next.name);
      setCurrentPassword("");
      toast.success("Name updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change name.");
    } finally {
      setBusy(null);
    }
  }

  async function saveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setBusy("workspace");
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceTitle }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error || "Could not rename workspace.");
      return;
    }
    toast.success("Workspace renamed.");
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const featured = [
    { href: `/desk/${workspaceId}/marketplace?tab=plugins`, label: "Plugins", icon: Plug },
    { href: `/desk/${workspaceId}/marketplace?tab=bots`, label: "Bots", icon: Bot },
    { href: `/desk/${workspaceId}/marketplace`, label: "Marketplace", icon: Store },
    { href: `/desk/${workspaceId}/billing`, label: "Plans", icon: CreditCard },
    { href: `/desk/${workspaceId}/usage`, label: "Usage", icon: BarChart3 },
  ];

  return (
    <div className="desk-page max-w-3xl">
      <p className="page-kicker">Account</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Settings</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Account, workspace, Marketplace, plans, and the job list that used to sit
        under the composer.
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-3.5 text-muted-foreground" />
          Account
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {user.googleLinked
            ? hasPassword
              ? "Signed in with Google. Email or password changes still need your current password."
              : "Signed in with Google. You can set a password if you also want email sign-in."
            : "Changes that touch email or password need your current password."}
        </p>
        <form onSubmit={saveName} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy === "name"}>
            Save name
          </Button>
        </form>
        <form onSubmit={saveEmail} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Change email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy === "email"}>
            Save email
          </Button>
        </form>
        <form onSubmit={savePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="New password">
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" disabled={busy === "password"}>
              <KeyRound className="size-3.5" />
              Change password
            </Button>
          </div>
        </form>
        {hasPassword ? (
          <div className="mt-4 max-w-sm">
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required for account changes"
              />
            </Field>
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        <InviteTeam workspaceId={workspaceId} />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Workspace</h2>
        <form onSubmit={saveWorkspace} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Workspace name">
            <Input
              value={workspaceTitle}
              onChange={(e) => setWorkspaceTitle(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy === "workspace"}>
            Rename
          </Button>
        </form>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Use server API keys — set{" "}
          <code className="rounded bg-muted px-1 py-0.5">OPENAI_API_KEY</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">ANTHROPIC_API_KEY</code>, or{" "}
          <code className="rounded bg-muted px-1 py-0.5">GEMINI_API_KEY</code>{" "}
          on the host. This desk does not accept a personal key in the browser.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium">Apps and billing</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {featured.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm hover:bg-muted/40"
              >
                <item.icon className="size-3.5 text-muted-foreground" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Jobs</h2>
          <span className="text-xs text-muted-foreground">
            {initialJobs.filter((job) => job.status !== "done").length} open
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Moved off the desk footer. Open a job to jump back to Mission Control.
        </p>
        {initialJobs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {initialJobs.map((job) => {
              const owner = agents.find((agent) => agent.id === job.agentId);
              return (
                <li key={job.id}>
                  <Link
                    href={jobDeskHref(workspaceId, job)}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-foreground"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{job.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {displayAgentName(owner?.name)} · {jobStatusLabel(job.status)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] capitalize text-muted-foreground",
                        job.status === "needs_you" && "text-amber-400",
                      )}
                    >
                      {jobStatusLabel(job.status)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium">More</h2>
        <ul className="mt-3 space-y-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex flex-col rounded-lg px-2 py-2 hover:bg-muted/40"
              >
                <span className="text-sm">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
