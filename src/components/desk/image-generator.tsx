"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ImageGenProviderOption = {
  id: "cloudflare" | "geminigen";
  label: string;
  configured: boolean;
  source: "env" | "byok" | "none";
  models?: string[];
  defaultModel?: string;
};

type ImageGenStatus = {
  configured: boolean;
  setupHint: string;
  providers: ImageGenProviderOption[];
  defaultProvider: "cloudflare" | "geminigen" | null;
};

type ImageGenResponse = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  provider: "cloudflare" | "geminigen";
  source: "env" | "byok";
  model?: string;
  mediaUrl?: string;
};

export function ImageGeneratorPanel({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<ImageGenStatus | null>(null);
  const [provider, setProvider] = useState<"cloudflare" | "geminigen" | "">("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageGenResponse | null>(null);

  const readyProviders = useMemo(
    () => status?.providers.filter((p) => p.configured) ?? [],
    [status],
  );

  const activeProvider = useMemo(() => {
    if (provider && readyProviders.some((p) => p.id === provider)) return provider;
    return status?.defaultProvider ?? readyProviders[0]?.id ?? "";
  }, [provider, readyProviders, status?.defaultProvider]);

  const activeProviderMeta = readyProviders.find((p) => p.id === activeProvider);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/image/generate");
    if (!res.ok) {
      setStatus({
        configured: false,
        setupHint: "Sign in to generate images.",
        providers: [],
        defaultProvider: null,
      });
      return;
    }
    const data = (await res.json()) as ImageGenStatus;
    setStatus(data);
    if (!provider && data.defaultProvider) {
      setProvider(data.defaultProvider);
      const meta = data.providers.find((p) => p.id === data.defaultProvider);
      if (meta?.defaultModel) setModel(meta.defaultModel);
    }
  }, [provider]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (activeProviderMeta?.defaultModel && !model) {
      setModel(activeProviderMeta.defaultModel);
    }
  }, [activeProviderMeta, model]);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy || !activeProvider) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          provider: activeProvider,
          model: activeProvider === "geminigen" ? model || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Image generation failed.",
        );
      }
      setResult(data as ImageGenResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const dataUrl = result
    ? `data:${result.mimeType};base64,${result.imageBase64}`
    : null;

  const download = () => {
    if (!dataUrl || !result) return;
    const ext = result.mimeType.includes("png") ? "png" : "jpg";
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `cinem-image-${Date.now()}.${ext}`;
    a.click();
  };

  const showProviderPicker = readyProviders.length > 1;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <p className="page-kicker">Desk tools</p>
      <h1 className="font-heading mt-1 flex items-center gap-2 text-2xl tracking-tight">
        <ImageIcon className="size-6 text-primary" />
        Generate image
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Text-to-image via Cloudflare Workers AI or GeminiGen Nano Banana. Prompts are
        proxied server-side — API keys never reach the browser.
      </p>

      {status && !status.configured && (
        <div
          className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="status"
        >
          {status.setupHint}
        </div>
      )}

      <div className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        {showProviderPicker && (
          <label className="block space-y-2">
            <span className="text-sm font-medium">Provider</span>
            <select
              value={activeProvider}
              onChange={(e) => {
                const next = e.target.value as "cloudflare" | "geminigen";
                setProvider(next);
                const meta = readyProviders.find((p) => p.id === next);
                setModel(meta?.defaultModel || "");
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={busy}
            >
              {readyProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.source === "byok" ? " (your key)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {activeProvider === "geminigen" && activeProviderMeta?.models?.length && (
          <label className="block space-y-2">
            <span className="text-sm font-medium">Model</span>
            <select
              value={model || activeProviderMeta.defaultModel || "nano-banana"}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={busy}
            >
              {activeProviderMeta.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium">Prompt</span>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cinematic product shot of a coffee mug on marble…"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") void generate();
            }}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !prompt.trim() || !status?.configured || !activeProvider}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {busy ? "Generating…" : "Generate"}
          </Button>
          {dataUrl && (
            <Button type="button" variant="outline" onClick={download}>
              <Download className="size-4" />
              Download
            </Button>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {dataUrl && result && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {result.prompt}
              {" · "}
              {result.provider === "geminigen"
                ? `GeminiGen${result.model ? ` (${result.model})` : ""}`
                : "Cloudflare Workers AI"}
              {result.source === "byok" ? " · your key" : " · server key"}
            </p>
            <img
              src={dataUrl}
              alt={result.prompt}
              className="max-h-[480px] w-full rounded-lg border object-contain bg-muted/30"
            />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Workspace: {workspaceId}. Docs:{" "}
        <code className="rounded bg-muted px-1 py-0.5">docs/integrations/cloudflare-image-worker/</code>
        {" · "}
        <code className="rounded bg-muted px-1 py-0.5">docs/integrations/geminigen-image-api/</code>
      </p>
    </div>
  );
}
