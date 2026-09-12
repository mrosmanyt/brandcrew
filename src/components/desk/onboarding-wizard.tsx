"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { ConnectorLogo } from "@/components/desk/connector-logo";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MODEL_ROUTING_GROUPS,
  modelRoutingLocked,
} from "@/lib/agent-modes";
import type { BrandKit } from "@/lib/brand-kit";
import { normalizeModelRouting, type LlmRoutingPreference, type LlmStatus } from "@/lib/llm-routing";
import {
  LINKEDIN_ONBOARDING_CONNECTOR,
  ONBOARDING_PLUGIN_ORDER,
  SETUP_WIZARD_STEP_COPY,
  SETUP_WIZARD_STEPS,
  WIZARD_FEATURED_AGENTS,
  onboardingIntegrationSlots,
  isPlaceholderWebsite,
  nextSetupWizardStep,
  parseSetupWizardStep,
  pluginOAuthNextPath,
  prevSetupWizardStep,
  type OnboardingPluginRow,
  type SetupWizardStepId,
} from "@/lib/setup-wizard";
import { emptyConnectMessage, pastedConnectSecret } from "@/lib/marketplace";
import { pluginOAuthErrorMessage } from "@/lib/plugin-oauth-errors";
import { cn } from "@/lib/utils";

export function OnboardingWizard({
  workspaceId,
  workspaceName,
  initialKit,
  initialStep,
  initialModelRouting,
  initialPlugins,
  oauthConnected,
  oauthError,
  oauthPlugin,
  llm,
  userName,
}: {
  workspaceId: string;
  workspaceName: string;
  initialKit: BrandKit;
  initialStep?: string | null;
  initialModelRouting: string;
  initialPlugins: OnboardingPluginRow[];
  oauthConnected?: string | null;
  oauthError?: string | null;
  oauthPlugin?: string | null;
  llm: LlmStatus;
  userName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<SetupWizardStepId>(parseSetupWizardStep(initialStep));
  const [name, setName] = useState(workspaceName);
  const [kit, setKit] = useState<BrandKit>(initialKit);
  const [sampleDraft, setSampleDraft] = useState(initialKit.samplePosts.join("\n\n"));
  const [forbiddenDraft, setForbiddenDraft] = useState(initialKit.forbiddenWords.join(", "));
  const [website, setWebsite] = useState(
    isPlaceholderWebsite(initialKit.website ?? "") ? "" : (initialKit.website ?? ""),
  );
  const [agentId, setAgentId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [routing, setRouting] = useState<LlmRoutingPreference>(
    normalizeModelRouting(initialModelRouting),
  );
  const [plugins, setPlugins] = useState<OnboardingPluginRow[]>(initialPlugins);
  const [busy, setBusy] = useState(false);
  const [connectPlugin, setConnectPlugin] = useState<OnboardingPluginRow | null>(null);
  const [apiKey, setApiKey] = useState("");
  const keyInputRef = useRef<HTMLInputElement>(null);

  const copy = SETUP_WIZARD_STEP_COPY[step];
  const stepIndex = SETUP_WIZARD_STEPS.indexOf(step);
  const deskHref = `/desk/${workspaceId}${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`;
  const oauthNotice = oauthConnected
    ? `${oauthConnected} connected.`
    : oauthError
      ? pluginOAuthErrorMessage(oauthError, oauthPlugin)
      : null;

  async function refreshPlugins() {
    const res = await fetch(`/api/workspaces/${workspaceId}/marketplace`);
    if (!res.ok) return;
    const data = await res.json();
    setPlugins(sortOnboardingPlugins(data.plugins ?? []));
    const agents = Array.isArray(data.agents) ? data.agents : [];
    const existing = agents.find((row: { templateId?: string | null }) => row.templateId === templateId);
    if (existing?.id) setAgentId(existing.id);
  }

  const kitPayload = useMemo((): BrandKit => {
    return {
      ...kit,
      website,
      samplePosts: sampleDraft
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      forbiddenWords: forbiddenDraft
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }, [kit, website, sampleDraft, forbiddenDraft]);

  async function saveKit(nextKit: BrandKit) {
    const res = await fetch(`/api/workspaces/${workspaceId}/brand-kit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextKit),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save Brand Kit.");
    setKit(nextKit);
  }

  async function saveWorkspacePatch(body: Record<string, unknown>) {
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not update workspace.");
    return data;
  }

  async function markDoneAndGo() {
    setBusy(true);
    try {
      await saveWorkspacePatch({ setupWizardDone: true });
      router.push(deskHref);
      router.refresh();
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not open Mission Control.");
    }
  }

  async function createSelectedAgent() {
    if (!templateId) throw new Error("Pick an agent to continue.");
    const res = await fetch(`/api/workspaces/${workspaceId}/marketplace/bots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add that agent.");
    if (data.agent?.id) setAgentId(data.agent.id);
  }

  async function goNext() {
    setBusy(true);
    try {
      if (step === "agent") await createSelectedAgent();
      if (step === "website") await saveKit({ ...kitPayload, website: website.trim() });
      if (step === "workspace") {
        const trimmed = name.trim();
        if (!trimmed) throw new Error("Enter a workspace name.");
        await saveWorkspacePatch({ name: trimmed });
      }
      if (step === "voice") await saveKit(kitPayload);
      if (step === "style") await saveKit(kitPayload);
      if (step === "model") await saveWorkspacePatch({ modelRouting: routing });
      const next = nextSetupWizardStep(step);
      if (!next) {
        await saveKit(kitPayload);
        await saveWorkspacePatch({ setupWizardDone: true, modelRouting: routing });
        router.push(deskHref);
        router.refresh();
        return;
      }
      setStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  async function skipWebsite() {
    setBusy(true);
    try {
      setWebsite("");
      await saveKit({ ...kitPayload, website: "" });
      const next = nextSetupWizardStep("website");
      if (next) setStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not skip website.");
    } finally {
      setBusy(false);
    }
  }

  function startConnect(plugin: OnboardingPluginRow) {
    if (plugin.auth === "oauth") {
      if (!plugin.connection?.oauthReady) {
        toast.error(
          plugin.connection?.setupHint || "OAuth is not configured. Connect stays disconnected.",
        );
        return;
      }
      const next = pluginOAuthNextPath(workspaceId);
      const start = `/api/workspaces/${workspaceId}/plugins/${plugin.id}/oauth/start?next=${encodeURIComponent(next)}`;
      // API route 302s to the provider — not a Next.js page navigation.
      window.location.assign(new URL(start, window.location.origin).toString());
      return;
    }
    setApiKey("");
    setConnectPlugin(plugin);
  }

  async function connectKey(useEnv: boolean) {
    if (!connectPlugin) return;
    const pasted = pastedConnectSecret(apiKey, keyInputRef.current?.value);
    if (!useEnv && !pasted) {
      toast.error(emptyConnectMessage(connectPlugin));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/plugins/${connectPlugin.id}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: useEnv ? undefined : pasted,
            useEnv,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Not connected.");
        return;
      }
      if (!data.connection?.connected) {
        toast.error("Connect did not persist. Still disconnected.");
        return;
      }
      setPlugins((prev) =>
        prev.map((plugin) =>
          plugin.id === connectPlugin.id ? { ...plugin, connected: true } : plugin,
        ),
      );
      toast.success(`${connectPlugin.name} connected.`);
      setConnectPlugin(null);
      setApiKey("");
      await refreshPlugins();
    } catch {
      toast.error("Could not reach Connect. Still disconnected.");
    } finally {
      setBusy(false);
    }
  }

  const canNext =
    step !== "agent" || Boolean(templateId);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 py-10">
      <BrandMark />
      <p className="page-kicker mt-10">Onboarding</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {stepIndex + 1} / {SETUP_WIZARD_STEPS.length}
        {userName ? ` · Hi ${userName.split(" ")[0]}` : ""}
      </p>
      <div className="mt-3 flex gap-1" aria-hidden>
        {SETUP_WIZARD_STEPS.map((id, index) => (
          <span
            key={id}
            className={cn(
              "h-1 flex-1 rounded-full",
              index <= stepIndex ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>

      <div key={step} className="wizard-pane mt-8 rounded-2xl border border-border bg-card p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {copy.kicker}
        </p>
        <h1 className="font-heading mt-2 text-2xl tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.hint}</p>
        {oauthNotice && step === "integrations" ? (
          <p
            className={cn(
              "mt-3 text-sm leading-6",
              oauthConnected ? "text-primary" : "text-destructive",
            )}
          >
            {oauthNotice}
          </p>
        ) : null}

        {step === "agent" ? (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {WIZARD_FEATURED_AGENTS.map((bot) => {
              const selected = templateId === bot.id;
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => setTemplateId(bot.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-foreground bg-muted/40"
                      : "border-border hover:border-foreground/40 hover:bg-muted/20",
                  )}
                >
                  <AgentAvatar id={bot.id} name={bot.name} role={bot.role} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{bot.role}</span>
                      {selected ? <Check className="size-3.5 shrink-0" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {bot.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === "website" ? (
          <div className="mt-6 space-y-2">
            <Label htmlFor="wizard-website">Website</Label>
            <Input
              id="wizard-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
            />
          </div>
        ) : null}

        {step === "integrations" ? (
          <div className="mt-6 space-y-2">
            {onboardingIntegrationSlots(plugins).map((slot) =>
              slot.kind === "linkedin" ? (
                <IntegrationCard
                  key="linkedin"
                  pluginId="linkedin"
                  name={LINKEDIN_ONBOARDING_CONNECTOR.name}
                  description={LINKEDIN_ONBOARDING_CONNECTOR.description}
                  connected={false}
                  actionLabel="Content jobs only"
                  disabled
                />
              ) : (
                <IntegrationCard
                  key={slot.plugin.id}
                  pluginId={slot.plugin.id}
                  name={slot.plugin.name}
                  description={slot.plugin.description}
                  connected={slot.plugin.connected}
                  actionLabel={slot.plugin.connected ? "Connected" : "Connect"}
                  hint={slot.plugin.connection?.setupHint}
                  busy={busy}
                  onClick={() => startConnect(slot.plugin)}
                />
              ),
            )}
          </div>
        ) : null}

        {step === "workspace" ? (
          <div className="mt-6 space-y-2">
            <Label htmlFor="wizard-name">Name</Label>
            <Input
              id="wizard-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        ) : null}

        {step === "voice" ? (
          <div className="mt-6 space-y-4">
            <Field label="Voice">
              <Textarea
                rows={4}
                value={kit.voice}
                onChange={(e) => setKit({ ...kit, voice: e.target.value })}
              />
            </Field>
            <Field label="Audience">
              <Textarea
                rows={3}
                value={kit.audience}
                onChange={(e) => setKit({ ...kit, audience: e.target.value })}
              />
            </Field>
            <Field label="Offer">
              <Textarea
                rows={3}
                value={kit.offer}
                onChange={(e) => setKit({ ...kit, offer: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {step === "style" ? (
          <div className="mt-6 space-y-4">
            <Field label="Sample posts" hint="Separate examples with a blank line.">
              <Textarea
                rows={6}
                value={sampleDraft}
                onChange={(e) => setSampleDraft(e.target.value)}
              />
            </Field>
            <Field label="Forbidden words" hint="Comma-separated.">
              <Input
                value={forbiddenDraft}
                onChange={(e) => setForbiddenDraft(e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {step === "model" ? (
          <div className="mt-6 space-y-4">
            {MODEL_ROUTING_GROUPS.map((group) => (
              <section key={group.id}>
                {group.label ? (
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    {group.label}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.options.map((option) => {
                    const locked = modelRoutingLocked(option.id, llm);
                    const selected = option.id === routing;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={locked}
                        onClick={() => setRouting(option.id)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left",
                          selected
                            ? "border-foreground bg-muted/40"
                            : "border-border hover:border-foreground/40",
                          locked && "opacity-60",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{option.label}</span>
                          {locked ? (
                            <Lock className="size-3.5 text-muted-foreground" />
                          ) : selected ? (
                            <Check className="size-3.5" />
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {locked ? "Add key on server" : option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <p className="text-[11px] leading-5 text-muted-foreground">
              Named choices can share a cheaper engine behind the scenes. Model keys stay on the
              server.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {prevSetupWizardStep(step) ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setStep(prevSetupWizardStep(step)!)}
            >
              <ChevronLeft className="size-3.5" />
              Back
            </Button>
          ) : null}
          {step === "website" ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void skipWebsite()}>
              Skip
            </Button>
          ) : null}
          {step === "integrations" ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep("workspace")}>
              Continue without connecting
            </Button>
          ) : null}
          <Button
            type="button"
            className="ml-auto"
            disabled={busy || !canNext}
            onClick={() => void goNext()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {nextSetupWizardStep(step) ? "Next" : "Save & open desk"}
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          disabled={busy}
          onClick={() => void markDoneAndGo()}
        >
          Skip to Mission Control
        </button>
      </div>

      <Dialog
        open={Boolean(connectPlugin)}
        onOpenChange={(open) => !open && setConnectPlugin(null)}
      >
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void connectKey(false);
            }}
          >
          <DialogHeader>
            <DialogTitle>Connect {connectPlugin?.name}</DialogTitle>
            <DialogDescription>
              {connectPlugin?.connection?.setupHint ||
                "Secrets stay on the server. Empty Connect stays disconnected."}
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={keyInputRef}
            type="password"
            autoComplete="off"
            placeholder={connectPlugin?.secretLabel || "API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
          />
          <DialogFooter className="sm:flex-col sm:items-stretch">
            {connectPlugin?.connection?.envReady ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void connectKey(true)}
              >
                Use server {connectPlugin.envKeys[0]}
              </Button>
            ) : null}
            <Button type="submit" disabled={busy}>
              Connect
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sortOnboardingPlugins(rows: OnboardingPluginRow[]) {
  const rank = new Map<string, number>(ONBOARDING_PLUGIN_ORDER.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => {
    const left = rank.get(a.id) ?? 99;
    const right = rank.get(b.id) ?? 99;
    return left - right;
  });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

function IntegrationCard({
  pluginId,
  name,
  description,
  connected,
  actionLabel,
  hint,
  disabled,
  busy,
  onClick,
}: {
  pluginId: string;
  name: string;
  description: string;
  connected: boolean;
  actionLabel: string;
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
}) {
  return (
    <article className="flex items-start gap-3 rounded-xl border border-border px-3 py-3">
      <ConnectorLogo pluginId={pluginId} name={name} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{name}</p>
          {connected ? (
            <span className="text-[11px] uppercase tracking-[0.12em] text-primary">Connected</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        {hint && !connected ? (
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p>
        ) : null}
        <Button
          className="mt-2"
          size="sm"
          variant={disabled || connected ? "secondary" : "outline"}
          disabled={disabled || busy || connected}
          onClick={onClick}
        >
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}
