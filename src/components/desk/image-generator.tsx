"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  History,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  imageGenSupportsVariation,
  type ImageGenProviderId,
} from "@/lib/image-generation-pure";

type ProviderOption = {
  id: ImageGenProviderId;
  label: string;
  configured: boolean;
  source: "env" | "byok" | "none";
  models?: string[];
  defaultModel?: string;
};

type ImageGenStatus = {
  configured: boolean;
  setupHint: string;
  providers: ProviderOption[];
  defaultProvider: ImageGenProviderId | null;
};

type StudioImage = {
  key: string;
  prompt: string;
  provider: string;
  model?: string;
  source?: "env" | "byok";
  mimeType: string;
  src: string;
  imageBase64?: string | null;
  createdAt?: string;
};

type GenerateResponse = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  provider: ImageGenProviderId;
  source: "env" | "byok";
  model?: string;
  mediaUrl?: string;
};

type HistoryItem = {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  mimeType: string;
  mediaUrl: string;
  imageBase64: string | null;
  createdAt: string;
};

function providerLabel(status: ImageGenStatus | null, id: string): string {
  return status?.providers.find((p) => p.id === id)?.label ?? id;
}

export function ImageGeneratorPanel({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<ImageGenStatus | null>(null);
  const [provider, setProvider] = useState<ImageGenProviderId | "">("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [variationKey, setVariationKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<StudioImage[]>([]);
  const [history, setHistory] = useState<StudioImage[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = useMemo(() => {
    if (provider && status?.providers.some((p) => p.id === provider && p.configured)) {
      return provider;
    }
    return status?.defaultProvider ?? "";
  }, [provider, status]);

  const activeMeta = status?.providers.find((p) => p.id === activeProvider);

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
    if (data.defaultProvider) {
      setProvider((current) => current || data.defaultProvider || "");
      const meta = data.providers.find((p) => p.id === data.defaultProvider);
      if (meta?.defaultModel) {
        setModel((current) => current || meta.defaultModel || "");
      }
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/image/history");
    if (!res.ok) return;
    const data = (await res.json()) as { items: HistoryItem[] };
    setHistory(
      (data.items ?? []).map((item) => ({
        key: `history-${item.id}`,
        prompt: item.prompt,
        provider: item.provider,
        model: item.model || undefined,
        mimeType: item.mimeType,
        src:
          item.mediaUrl ||
          (item.imageBase64
            ? `data:${item.mimeType};base64,${item.imageBase64}`
            : ""),
        imageBase64: item.imageBase64,
        createdAt: item.createdAt,
      })),
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus, loadHistory]);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  const pickProvider = (next: ImageGenProviderId) => {
    setProvider(next);
    const meta = status?.providers.find((p) => p.id === next);
    setModel(meta?.defaultModel || "");
  };

  const toStudioImage = (data: GenerateResponse): StudioImage => ({
    key: `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: data.prompt,
    provider: data.provider,
    model: data.model,
    source: data.source,
    mimeType: data.mimeType,
    src: data.mediaUrl || `data:${data.mimeType};base64,${data.imageBase64}`,
    imageBase64: data.imageBase64,
  });

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy || !activeProvider) return;
    setBusy(true);
    setElapsed(0);
    setError("");
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          provider: activeProvider,
          model: activeMeta?.models?.length ? model || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Image generation failed.",
        );
      }
      setResults((current) => [toStudioImage(data as GenerateResponse), ...current]);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const makeVariation = async (item: StudioImage) => {
    if (!item.imageBase64 || variationKey) return;
    setVariationKey(item.key);
    setError("");
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: item.prompt,
          provider: item.provider,
          model: item.model,
          variation: true,
          sourceImageBase64: item.imageBase64,
          sourceMimeType: item.mimeType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Variation failed.",
        );
      }
      setResults((current) => [toStudioImage(data as GenerateResponse), ...current]);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variation failed.");
    } finally {
      setVariationKey(null);
    }
  };

  const reusePrompt = (item: StudioImage) => {
    setPrompt(item.prompt);
    const meta = status?.providers.find((p) => p.id === item.provider);
    if (meta?.configured) {
      setProvider(meta.id);
      setModel(item.model || meta.defaultModel || "");
    }
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const download = (item: StudioImage) => {
    const ext = item.mimeType.includes("png")
      ? "png"
      : item.mimeType.includes("webp")
        ? "webp"
        : "jpg";
    const a = document.createElement("a");
    a.href = item.src;
    a.download = `cinem-image-${item.key.replace(/[^a-z0-9-]/gi, "")}.${ext}`;
    a.click();
  };

  const renderCard = (item: StudioImage) => {
    const canVary =
      imageGenSupportsVariation(item.provider as ImageGenProviderId) &&
      Boolean(item.imageBase64);
    return (
      <figure
        key={item.key}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        {item.src ? (
          // Runtime-generated data/provider URLs — next/image cannot optimize these.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={item.prompt}
            className="aspect-square w-full bg-muted/30 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">
            Preview unavailable
          </div>
        )}
        <figcaption className="space-y-2 p-3">
          <p className="line-clamp-2 text-sm leading-5">{item.prompt}</p>
          <p className="text-xs text-muted-foreground">
            {providerLabel(status, item.provider)}
            {item.model ? ` · ${item.model}` : ""}
            {item.source === "byok" ? " · your key" : item.source ? " · server key" : ""}
            {item.createdAt
              ? ` · ${new Date(item.createdAt).toLocaleDateString()}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => download(item)}
              disabled={!item.src}
            >
              <Download className="size-3.5" />
              Download
            </Button>
            {canVary && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void makeVariation(item)}
                disabled={variationKey !== null}
              >
                {variationKey === item.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                Variation
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => reusePrompt(item)}
            >
              <RefreshCw className="size-3.5" />
              Reuse prompt
            </Button>
          </div>
        </figcaption>
      </figure>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="page-kicker">Image studio</p>
      <h1 className="font-heading mt-1 flex items-center gap-2 text-2xl tracking-tight">
        <ImageIcon className="size-6 text-primary" />
        Generate image
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Text-to-image with native OpenAI and Gemini providers, plus the Cloudflare
        worker and GeminiGen paths. Prompts are proxied server-side — API keys
        never reach the browser.
      </p>

      {status && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Provider status">
          {status.providers.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            >
              <span
                className={`size-1.5 rounded-full ${
                  p.configured ? "bg-emerald-500" : "bg-zinc-400"
                }`}
              />
              {p.label}
              <span className="text-muted-foreground">
                {p.configured
                  ? p.source === "byok"
                    ? "· your key"
                    : "· server key"
                  : "· not configured"}
              </span>
            </span>
          ))}
        </div>
      )}

      {status && !status.configured && (
        <div
          className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">No image provider is configured yet.</p>
          <p className="mt-1 leading-6">{status.setupHint}</p>
        </div>
      )}

      <div className="mt-6 space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Provider</span>
            <select
              value={activeProvider}
              onChange={(e) => pickProvider(e.target.value as ImageGenProviderId)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={busy || !status?.configured}
            >
              {(status?.providers ?? []).map((p) => (
                <option key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label}
                  {p.configured
                    ? p.source === "byok"
                      ? " (your key)"
                      : ""
                    : " — not configured"}
                </option>
              ))}
            </select>
          </label>

          {activeMeta?.models?.length ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium">Model</span>
              <select
                value={model || activeMeta.defaultModel || ""}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                disabled={busy}
              >
                {activeMeta.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Prompt</span>
          <Textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cinematic product shot of a coffee mug on marble…"
            disabled={busy}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate();
            }}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
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
          {busy && (
            <p className="text-sm text-muted-foreground" role="status">
              {providerLabel(status, activeProvider)} is working · {elapsed}s
            </p>
          )}
        </div>

        {busy && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Latest results
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(renderCard)}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          <History className="size-4" />
          History
        </h2>
        {history.length > 0 ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map(renderCard)}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {status?.configured
              ? "No images yet — write a prompt above to create your first one. Your generations will appear here."
              : "Once a provider is configured and you generate images, they will appear here."}
          </p>
        )}
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        Workspace: {workspaceId}. Each generation costs 1,000 credits from the
        workspace budget. BYOK generations use your own provider key.
      </p>
    </div>
  );
}
