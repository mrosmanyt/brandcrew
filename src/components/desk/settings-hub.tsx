"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { InviteTeam } from "@/components/desk/invite-team";
import { ExtensionStatusChip } from "@/components/desk/extension-status";
import { CLIENT_ISOLATION_FACTS } from "@/lib/client-workspaces";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  jobDeskHref,
  settingsDeskCategories,
  type SettingsDeskLink,
} from "@/lib/desk-settings";
import { ConsoleNavLink } from "@/components/desk/console-nav-link";
import { SupporterBadge } from "@/components/support/supporter-badge";
import { assertStrongPassword } from "@/lib/password-rules";
import { displayAgentName } from "@/lib/constants";
import { formatSupportCents } from "@/lib/support";
import type { AgentDTO, JobDTO } from "@/lib/job-types";
import { jobStatusLabel } from "@/lib/live-progress";
import { cn } from "@/lib/utils";

type AccountUser = {
  id: string;
  email: string;
  name: string;
  hasPassword?: boolean;
  googleLinked?: boolean;
  isAdmin?: boolean;
  supporter?: boolean;
  supporterTotalCents?: number;
  analyticsOptIn?: boolean;
};

export function SettingsHub({
  workspaceId,
  workspaceName,
  workspaceKind = "agency",
  clientName = "",
  user,
  initialJobs,
  agents,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaceKind?: "agency" | "client";
  clientName?: string;
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
  const [clientLabel, setClientLabel] = useState(clientName);
  const [deskKind, setDeskKind] = useState<"agency" | "client">(workspaceKind);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(Boolean(user.analyticsOptIn));
  const [busy, setBusy] = useState<string | null>(null);
  const categories = settingsDeskCategories(workspaceId);

  const hasPassword = user.hasPassword !== false;

  async function patchAccount(body: Record<string, string | boolean>) {
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
    const weak = assertStrongPassword(newPassword, email);
    if (weak) {
      toast.error(weak);
      return;
    }
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
      body: JSON.stringify({
        name: workspaceTitle,
        kind: deskKind,
        clientName: deskKind === "client" ? clientLabel : "",
      }),
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

  return (
    <div className="desk-page max-w-3xl">
      <p className="page-kicker">Account</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Settings</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Account and workspace. Marketplace, Client desks, Calendar, Ops, Trust,
        and On-device Chrome live here in categories — the sidebar stays on
        Mission Control, API Console, Usage, Plans, and Support.
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-3.5 text-muted-foreground" />
          Account
          {user.supporter ? <SupporterBadge /> : null}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {user.googleLinked
            ? hasPassword
              ? "Signed in with Google. Email or password changes still need your current password."
              : "Signed in with Google. You can set a password if you also want email sign-in."
            : "Changes that touch email or password need your current password."}
        </p>
        {user.supporter ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Supporter perk: priority note when you write in — we see this badge on
            your account
            {user.supporterTotalCents
              ? ` · ${formatSupportCents(user.supporterTotalCents)} total`
              : ""}
            . Shukriya.
          </p>
        ) : null}
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

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Product analytics</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Off by default. When on, CINEM may count Support topics for this account in Admin Insights.
          Guest chat always records anonymous topic counts (no id, no message text). Applies to CINEM
          Pro desk and Cinem AI Assistant on this CINEM account.{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
          .
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={analyticsOptIn}
            disabled={busy === "analytics"}
            onChange={(e) => {
              const next = e.target.checked;
              setBusy("analytics");
              void (async () => {
                try {
                  const updated = await patchAccount({ analyticsOptIn: next });
                  setAnalyticsOptIn(Boolean(updated.analyticsOptIn));
                  toast.success(next ? "Analytics opted in." : "Analytics opted out.");
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not update analytics preference.",
                  );
                } finally {
                  setBusy(null);
                }
              })();
            }}
          />
          <span>
            <span className="font-medium">Share product analytics</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              Keyword tags and counts only. We do not store Support message bodies or emails in
              Insights.
            </span>
          </span>
        </label>
      </section>

      <div className="mt-6">
        <InviteTeam workspaceId={workspaceId} />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Workspace</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Name this desk, then open Client desks, Trust & audit, or Brand Kit —
          those left the primary sidebar.
        </p>
        <form onSubmit={saveWorkspace} className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Workspace name">
              <Input
                value={workspaceTitle}
                onChange={(e) => setWorkspaceTitle(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy === "workspace"}>
              Save workspace
            </Button>
          </div>
          <Field label="Desk type">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={deskKind}
              onChange={(e) => setDeskKind(e.target.value === "client" ? "client" : "agency")}
            >
              <option value="agency">Agency house desk</option>
              <option value="client">Client workspace</option>
            </select>
          </Field>
          {deskKind === "client" ? (
            <Field label="Client name">
              <Input
                value={clientLabel}
                onChange={(e) => setClientLabel(e.target.value)}
                placeholder="Acme Corp"
              />
            </Field>
          ) : null}
        </form>
        <ul className="mt-4 space-y-1.5 text-xs leading-5 text-muted-foreground">
          {CLIENT_ISOLATION_FACTS.map((row) => (
            <li key={row.key}>
              <span className="font-medium text-foreground">{row.label}.</span> {row.detail}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Use server API keys — set{" "}
          <code className="rounded bg-muted px-1 py-0.5">OPENAI_API_KEY</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5">ANTHROPIC_API_KEY</code>, or{" "}
          <code className="rounded bg-muted px-1 py-0.5">GEMINI_API_KEY</code>{" "}
          on the host. This desk does not accept a personal key in the browser.
        </p>
        {categories
          .filter((category) => category.id === "workspace")
          .map((category) => (
            <ul key={category.id} className="mt-4 grid gap-2">
              {category.links.map((link) => (
                <li key={`${category.id}-${link.href}`}>
                  <SettingsLinkRow workspaceId={workspaceId} link={link} />
                </li>
              ))}
            </ul>
          ))}
      </section>

      {categories
        .filter((category) => category.id !== "workspace")
        .map((category) => (
        <section
          key={category.id}
          className="mt-6 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-medium">{category.title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{category.hint}</p>
          <ul className="mt-4 grid gap-2">
            {category.links.map((link) => (
              <li key={`${category.id}-${link.href}`}>
                <SettingsLinkRow workspaceId={workspaceId} link={link} />
              </li>
            ))}
            {category.id === "desk-tools" ? (
              <li>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Chrome extension</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      Same badge as the old sidebar pill. Install and pair Chrome so
                      jobs can click and type on this machine.
                    </span>
                  </span>
                  <ExtensionStatusChip workspaceId={workspaceId} />
                </div>
              </li>
            ) : null}
          </ul>
        </section>
      ))}

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

      {user.isAdmin === true ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium">More</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link href="/admin" className="flex flex-col rounded-lg px-2 py-2 hover:bg-muted/40">
                <span className="text-sm">Internal Admin HQ</span>
                <span className="text-xs text-muted-foreground">
                  CINEM staff only. Server-gated by ADMIN_EMAILS — not a customer page.
                </span>
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      <div className="mt-8">
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

function SettingsLinkRow({
  workspaceId,
  link,
}: {
  workspaceId: string;
  link: SettingsDeskLink;
}) {
  const className =
    "flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm hover:bg-muted/40";
  const inner = (
    <>
      <span className="min-w-0">
        <span className="block font-medium">{link.label}</span>
        <span className="block text-xs text-muted-foreground">{link.hint}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">Open →</span>
    </>
  );
  if (link.external) {
    return (
      <ConsoleNavLink workspaceId={workspaceId} className={className}>
        {inner}
      </ConsoleNavLink>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {inner}
    </Link>
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
