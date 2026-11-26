"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  History,
  ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  imageGenSupportsVariation,
  type ImageGenProviderId,
} from "@/lib/image-generation-pure";
import {
  photoStudioPresetsForMode,
  type PhotoStudioMode,
} from "@/lib/photo-studio-presets";

const MAX_SOURCE_BYTES = 3.5 * 1024 * 1024;

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
  id?: string;
  key: string;
  prompt: string;
  provider: string;
  model?: string;
  mimeType: string;
  src: string;
  imageBase64?: string | null;
  createdAt?: string;
};

type GenerateResponse = {
  id?: string;
  imageBase64: string;
  mimeType: string;
  prompt: string;
  provider: ImageGenProviderId;
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

type ShareState = {
  busy?: boolean;
  url?: string;
  message?: string;
};

type SourcePhoto = {
  dataUrl: string;
  base64: string;
  mimeType: string;
  name: string;
};

function providerLabel(status: ImageGenStatus | null, id: string): string {
  return status?.providers.find((p) => p.id === id)?.label ?? id;
}

/**
 * AI Photo Studio: preset-driven image edits (uploaded photo → variation)
 * and fresh generations (prompt + style suffix), both through the real
 * /api/image/generate pipeline. Every result can be downloaded, shared via
 * a public CINEM Pro link, sent to WhatsApp, or exported as a branded
 * "Made with CINEM Pro" share card rendered locally on a canvas.
 */
export function PhotoStudio({ userName }: { userName: string }) {
  const [status, setStatus] = useState<ImageGenStatus | null>(null);
  const [provider, setProvider] = useState<ImageGenProviderId | "">("");
  const [model, setModel] = useState("");
  const [mode, setMode] = useState<PhotoStudioMode>("edit");
  const [presetId, setPresetId] = useState<string>("professional-headshot");
  const [source, setSource] = useState<SourcePhoto | null>(null);
  const [note, setNote] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<StudioImage[]>([]);
  const [history, setHistory] = useState<StudioImage[]>([]);
  const [shareStates, setShareStates] = useState<Record<string, ShareState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareUrlsRef = useRef<Map<string, string>>(new Map());

  const presets = useMemo(() => photoStudioPresetsForMode(mode), [mode]);
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];

  const activeProvider = useMemo(() => {
    if (provider && status?.providers.some((p) => p.id === provider && p.configured)) {
      return provider;
    }
    return status?.defaultProvider ?? "";
  }, [provider, status]);

  const activeMeta = status?.providers.find((p) => p.id === activeProvider);
  const variationCapable = activeProvider
    ? imageGenSupportsVariation(activeProvider)
    : false;
  const variationBlocked = mode === "edit" && Boolean(activeProvider) && !variationCapable;

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
        id: item.id,
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

  // Keep the selected preset valid when the mode switches.
  const switchMode = (next: PhotoStudioMode) => {
    setMode(next);
    const nextPresets = photoStudioPresetsForMode(next);
    if (!nextPresets.some((p) => p.id === presetId)) {
      setPresetId(nextPresets[0]?.id ?? "");
    }
  };

  const pickProvider = (next: ImageGenProviderId) => {
    setProvider(next);
    const meta = status?.providers.find((p) => p.id === next);
    setModel(meta?.defaultModel || "");
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image. Pick a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("That photo is too large — the limit is 3.5 MB. Try a smaller copy.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const comma = dataUrl.indexOf(",");
      setSource({
        dataUrl,
        base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
        mimeType: file.type || "image/png",
        name: file.name,
      });
    };
    reader.onerror = () => setError("Could not read that photo. Try another file.");
    reader.readAsDataURL(file);
  };

  const toStudioImage = (data: GenerateResponse): StudioImage => ({
    id: data.id,
    key: data.id
      ? `result-${data.id}`
      : `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: data.prompt,
    provider: data.provider,
    model: data.model,
    mimeType: data.mimeType,
    src: data.mediaUrl || `data:${data.mimeType};base64,${data.imageBase64}`,
    imageBase64: data.imageBase64,
  });

  const run = async () => {
    if (busy || !activeProvider || !preset || !status?.configured) return;
    setError("");
    let body: Record<string, unknown>;
    if (mode === "edit") {
      if (!source) {
        setError("Upload a photo first, then pick a style.");
        return;
      }
      if (variationBlocked) return;
      const extra = note.trim();
      body = {
        prompt: extra
          ? `${preset.editPrompt} Additional note from the user: ${extra}`
          : preset.editPrompt,
        provider: activeProvider,
        model: activeMeta?.models?.length ? model || undefined : undefined,
        variation: true,
        sourceImageBase64: source.base64,
        sourceMimeType: source.mimeType,
      };
    } else {
      const text = prompt.trim();
      if (!text) {
        setError("Describe the image you want first.");
        return;
      }
      body = {
        prompt: `${text}${preset.generateSuffix}`,
        provider: activeProvider,
        model: activeMeta?.models?.length ? model || undefined : undefined,
      };
    }
    setBusy(true);
    setElapsed(0);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const setShareState = (key: string, patch: ShareState) => {
    setShareStates((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  /** Create (or reuse) the public share URL for a card's image. */
  const ensureShareUrl = async (item: StudioImage): Promise<string | null> => {
    if (!item.id) {
      setShareState(item.key, {
        message:
          "A share link is not available for this image yet — it will be shareable from History once it is saved there.",
      });
      return null;
    }
    const cached = shareUrlsRef.current.get(item.id);
    if (cached) return cached;
    setShareState(item.key, { busy: true, message: undefined });
    try {
      const res = await fetch("/api/image/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        path?: string;
        error?: string;
      };
      if (!res.ok || !data.path) {
        throw new Error(data.error || "Could not create a share link.");
      }
      const url = `${window.location.origin}${data.path}`;
      shareUrlsRef.current.set(item.id, url);
      setShareState(item.key, { busy: false, url });
      return url;
    } catch (e) {
      setShareState(item.key, {
        busy: false,
        message: e instanceof Error ? e.message : "Could not create a share link.",
      });
      return null;
    }
  };

  const copyShareLink = async (item: StudioImage) => {
    const url = await ensureShareUrl(item);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareState(item.key, { url, message: "Share link copied to your clipboard." });
    } catch {
      // Clipboard blocked (permissions/insecure context): show the URL so
      // the user can copy it by hand — never fail silently.
      setShareState(item.key, {
        url,
        message: "Copy this share link:",
      });
    }
  };

  const shareWhatsApp = async (item: StudioImage) => {
    const url = await ensureShareUrl(item);
    if (!url) return;
    const href = `https://wa.me/?text=${encodeURIComponent(
      `Made with CINEM Pro: ${url}`,
    )}`;
    window.open(href, "_blank", "noopener,noreferrer");
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

  /**
   * Branded share card: the image on a canvas with a night-coloured band
   * carrying the CINEM Pro credit, exported as a PNG download. Hosted
   * (mediaUrl) images are drawn with CORS requested; if the canvas ends up
   * tainted the export throws and we say so plainly instead of crashing.
   */
  const downloadShareCard = async (item: StudioImage) => {
    setShareState(item.key, { message: undefined });
    try {
      const img = new Image();
      if (/^https?:\/\//i.test(item.src)) img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("load failed"));
        img.src = item.src;
      });
      const maxWidth = 1080;
      const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
      const width = Math.max(1, Math.round((img.naturalWidth || maxWidth) * scale));
      const imageHeight = Math.max(
        1,
        Math.round((img.naturalHeight || width) * scale),
      );
      const bandHeight = Math.max(56, Math.round(width * 0.09));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = imageHeight + bandHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(img, 0, 0, width, imageHeight);
      ctx.fillStyle = "#1a1915";
      ctx.fillRect(0, imageHeight, width, bandHeight);
      ctx.fillStyle = "#f3ecd9";
      ctx.textBaseline = "middle";
      const titleSize = Math.round(bandHeight * 0.34);
      ctx.font = `600 ${titleSize}px system-ui, sans-serif`;
      ctx.fillText("Made with CINEM Pro", Math.round(width * 0.04), imageHeight + bandHeight / 2);
      const subSize = Math.round(bandHeight * 0.26);
      ctx.font = `400 ${subSize}px system-ui, sans-serif`;
      const sub = "app.cinem.tech";
      const subWidth = ctx.measureText(sub).width;
      ctx.fillText(
        sub,
        Math.max(Math.round(width * 0.04), width - subWidth - Math.round(width * 0.04)),
        imageHeight + bandHeight / 2,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("export failed");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cinem-pro-share-${(item.id || item.key).replace(/[^a-z0-9-]/gi, "")}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setShareState(item.key, {
        message:
          "The share card could not be created for this image in your browser. Use Download or Share link instead.",
      });
    }
  };

  const renderCard = (item: StudioImage) => {
    const share = shareStates[item.key] ?? {};
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyShareLink(item)}
              disabled={share.busy}
            >
              {share.busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              Share link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void shareWhatsApp(item)}
              disabled={share.busy}
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void downloadShareCard(item)}
              disabled={!item.src}
            >
              <Share2 className="size-3.5" />
              Share card
            </Button>
          </div>
          {share.message ? (
            <p className="text-xs text-muted-foreground" role="status">
              {share.message}
            </p>
          ) : null}
          {share.url ? (
            <p className="break-all rounded-md bg-muted px-2 py-1.5 text-xs">
              {share.url}
            </p>
          ) : null}
        </figcaption>
      </figure>
    );
  };

  const canRun =
    Boolean(status?.configured) &&
    Boolean(activeProvider) &&
    !busy &&
    !variationBlocked &&
    (mode === "edit" ? Boolean(source) : Boolean(prompt.trim()));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Chat
          </Link>
          <h1 className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4" /> AI Photo Studio
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/image-studio"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Image Studio
          </Link>
          <span className="text-sm text-muted-foreground">{userName}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Pick a style, then either restyle a photo you upload or describe a
          brand-new image. Every result can be downloaded, shared with a
          public link, sent to WhatsApp, or exported as a branded share card.
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

        <div className="mt-6 space-y-5 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Studio mode">
            <Button
              type="button"
              variant={mode === "edit" ? "default" : "outline"}
              onClick={() => switchMode("edit")}
            >
              <Wand2 className="size-4" />
              Restyle a photo
            </Button>
            <Button
              type="button"
              variant={mode === "generate" ? "default" : "outline"}
              onClick={() => switchMode("generate")}
            >
              <ImageIcon className="size-4" />
              Create from a description
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium">Style</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  aria-pressed={preset?.id === p.id}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition",
                    preset?.id === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {p.label}
                    {p.seasonal ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        Seasonal
                      </span>
                    ) : null}
                    {preset?.id === p.id ? <Check className="size-4" /> : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {p.blurb}
                  </span>
                </button>
              ))}
            </div>
          </div>

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

          {variationBlocked && (
            <div
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
              role="status"
            >
              <p className="font-medium">
                {providerLabel(status, activeProvider)} can&apos;t restyle photos.
              </p>
              <p className="mt-1 leading-6">
                Photo restyling needs a provider that accepts an uploaded
                image. Pick <strong>OpenAI Image</strong> or{" "}
                <strong>Gemini Image</strong> in the Provider menu above — the
                studio never switches providers for you silently. Describing a
                new image instead works with any provider.
              </p>
            </div>
          )}

          {mode === "edit" ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  pickFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {source ? (
                <div className="flex flex-wrap items-start gap-4">
                  {/* Local preview of the user's own upload. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={source.dataUrl}
                    alt="Your uploaded photo"
                    className="size-32 rounded-xl border object-cover"
                  />
                  <div className="space-y-2">
                    <p className="max-w-56 truncate text-sm">{source.name}</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-3.5" />
                        Change photo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSource(null)}
                      >
                        <X className="size-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Upload a photo (JPG, PNG or WebP, up to 3.5 MB)
                </Button>
              )}
              <label className="block space-y-2">
                <span className="text-sm font-medium">
                  Anything to add? <span className="text-muted-foreground">(optional)</span>
                </span>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. keep my glasses on, darker background…"
                  disabled={busy}
                  rows={2}
                  maxLength={120}
                />
              </label>
            </div>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm font-medium">Describe the image</span>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. a young cricketer celebrating a century at sunset…"
                disabled={busy}
                rows={3}
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
                }}
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void run()}
              disabled={!canRun}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {busy
                ? "Creating…"
                : mode === "edit"
                  ? `Restyle with ${preset?.label ?? "style"}`
                  : `Create ${preset?.label ?? "image"}`}
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
                ? "No images yet — create your first one above. Your generations will appear here."
                : "Once a provider is configured and you generate images, they will appear here."}
            </p>
          )}
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Each creation costs 1,000 credits from your workspace budget. Share
          links are public — anyone with the link can view that image.
        </p>
      </main>
    </div>
  );
}
