"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Eraser,
  ImageIcon,
  Images,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  IMAGE_PROMPT_MAX,
  imageGenSupportsVariation,
  type ImageGenProviderId,
} from "@/lib/image-generation-pure";
import type { StudioPresetPackData } from "@/lib/photo-studio-presets";

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

/** One-tap edits that run through the same variation pipeline as a typed instruction. */
const QUICK_EDITS: { id: string; label: string; prompt: string }[] = [
  {
    id: "remove-background",
    label: "Remove background",
    prompt:
      "Remove the background completely and replace it with a clean, plain white background. Keep the main subject exactly the same — same face, features, colours, clothing and details — sharp, fully recognisable, with clean natural edges around the subject.",
  },
  {
    id: "enhance",
    label: "Clean up & enhance",
    prompt:
      "Clean up and enhance this image: remove noise, compression artefacts and visual distractions, fix the lighting and colour balance, sharpen the details, and give it a polished professional finish. Keep the subject, the composition and any person's identity exactly the same.",
  },
];

function backgroundChangePrompt(place: string): string {
  return `Replace the background with ${place}. Keep the main subject exactly the same — same face, features, colours, clothing and details — sharp and fully recognisable, with lighting that matches the new background so the result looks like one real photograph.`;
}

function providerLabel(status: ImageGenStatus | null, id: string): string {
  return status?.providers.find((p) => p.id === id)?.label ?? id;
}

/**
 * Image Studio: a dedicated, image-only studio. One big prompt box →
 * generate → everything lands in your gallery. Open any image to
 * download/share it or keep editing it (background remove/change,
 * clean-up, style variants, or a typed instruction) — all through the
 * real /api/image/generate pipeline, the same one the Photo Studio uses.
 * Nothing here is mocked: without a configured provider the studio says
 * so and disables generation instead of faking results.
 */
export function ImageStudio({
  userName,
  packs,
}: {
  userName: string;
  packs: StudioPresetPackData[];
}) {
  const [status, setStatus] = useState<ImageGenStatus | null>(null);
  const [provider, setProvider] = useState<ImageGenProviderId | "">("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState<SourcePhoto | null>(null);
  const [busy, setBusy] = useState<"generate" | "edit" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<StudioImage[]>([]);
  const [history, setHistory] = useState<StudioImage[]>([]);
  const [selected, setSelected] = useState<StudioImage | null>(null);
  const [editText, setEditText] = useState("");
  const [bgText, setBgText] = useState("");
  const [editError, setEditError] = useState("");
  const [shareStates, setShareStates] = useState<Record<string, ShareState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareUrlsRef = useRef<Map<string, string>>(new Map());

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

  const gallery = useMemo(() => {
    const seen = new Set<string>();
    const merged: StudioImage[] = [];
    for (const item of [...results, ...history]) {
      const dedupeKey = item.id ? `id-${item.id}` : item.key;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      merged.push(item);
    }
    return merged;
  }, [results, history]);

  // Style variants come from the same resolved preset packs as the
  // Photo Studio (core pack + any live seasonal packs).
  const styleVariants = useMemo(
    () =>
      packs
        .flatMap((pack) => pack.presets)
        .filter((p) => p.modes.includes("edit")),
    [packs],
  );

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

  const postGenerate = async (
    body: Record<string, unknown>,
  ): Promise<StudioImage> => {
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
    return toStudioImage(data as GenerateResponse);
  };

  const modelField = activeMeta?.models?.length ? model || undefined : undefined;

  /** Composer action: fresh generation, or an edit of the attached photo. */
  const runComposer = async () => {
    if (busy || !activeProvider || !status?.configured) return;
    const text = prompt.trim();
    if (!text) {
      setError(
        source
          ? "Describe the change you want first."
          : "Describe the image you want first.",
      );
      return;
    }
    if (source && !variationCapable) return;
    setError("");
    setBusy("generate");
    setElapsed(0);
    try {
      const item = await postGenerate(
        source
          ? {
              prompt: text,
              provider: activeProvider,
              model: modelField,
              variation: true,
              sourceImageBase64: source.base64,
              sourceMimeType: source.mimeType,
            }
          : {
              prompt: text,
              provider: activeProvider,
              model: modelField,
            },
      );
      setResults((current) => [item, ...current]);
      setPrompt("");
      setSource(null);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * The bytes behind a gallery image, for editing it. History rows carry
   * base64 directly; hosted results are fetched. If the browser cannot
   * read the hosted file (CORS), we say so plainly instead of failing
   * silently — the download-then-attach route always works.
   */
  const resolveSource = async (
    item: StudioImage,
  ): Promise<{ base64: string; mimeType: string }> => {
    if (item.imageBase64) {
      return { base64: item.imageBase64, mimeType: item.mimeType };
    }
    if (!item.src) {
      throw new Error(
        "This image has no readable source to edit. Attach it above with “Start from a photo” to edit it.",
      );
    }
    try {
      const res = await fetch(item.src);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      const comma = dataUrl.indexOf(",");
      return {
        base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
        mimeType: blob.type || item.mimeType,
      };
    } catch {
      throw new Error(
        "This image could not be loaded for editing in your browser. Download it, then attach it above with “Start from a photo” to edit it.",
      );
    }
  };

  /** Edit the image open in the detail view; the result becomes the new view. */
  const runEdit = async (editPrompt: string) => {
    if (!selected || busy || !activeProvider || !status?.configured) return;
    if (!variationCapable) return;
    const text = editPrompt.trim();
    if (!text) {
      setEditError("Describe the change, or pick one of the quick edits.");
      return;
    }
    setEditError("");
    setBusy("edit");
    setElapsed(0);
    try {
      const src = await resolveSource(selected);
      const item = await postGenerate({
        prompt: text,
        provider: activeProvider,
        model: modelField,
        variation: true,
        sourceImageBase64: src.base64,
        sourceMimeType: src.mimeType,
      });
      setResults((current) => [item, ...current]);
      setSelected(item);
      setEditText("");
      setBgText("");
      void loadHistory();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "That edit failed.");
    } finally {
      setBusy(null);
    }
  };

  const setShareState = (key: string, patch: ShareState) => {
    setShareStates((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  /** Create (or reuse) the public share URL for an image. */
  const ensureShareUrl = async (item: StudioImage): Promise<string | null> => {
    if (!item.id) {
      setShareState(item.key, {
        message:
          "A share link is not available for this image yet — it will be shareable from your gallery once it is saved there.",
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
      setShareState(item.key, { url, message: "Copy this share link:" });
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
   * Branded share card, same as the Photo Studio: the image on a canvas
   * with a "Made with CINEM Pro" band, exported as a PNG download. If the
   * canvas ends up tainted the export throws and we say so plainly.
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

  const canGenerate =
    Boolean(status?.configured) &&
    Boolean(activeProvider) &&
    !busy &&
    Boolean(prompt.trim()) &&
    (!source || variationCapable);

  const selectedShare = selected ? (shareStates[selected.key] ?? {}) : {};

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
            <Sparkles className="size-4" /> Image Studio
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Photo Studio presets
          </Link>
          <span className="text-sm text-muted-foreground">{userName}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {status && (
          <div className="flex flex-wrap gap-2" aria-label="Provider status">
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
            className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
            role="status"
          >
            <p className="font-medium">No image provider is configured yet.</p>
            <p className="mt-1 leading-6">{status.setupHint}</p>
          </div>
        )}

        {/* Composer — the one big prompt box, ChatGPT/Grok style. */}
        <section className="mt-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          {source ? (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {/* Local preview of the user's own upload. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source.dataUrl}
                alt="Photo you are editing"
                className="size-16 rounded-lg border object-cover"
              />
              <div className="min-w-0">
                <p className="max-w-64 truncate text-sm font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground">
                  You are editing this photo — describe the change below.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSource(null)}
                disabled={busy !== null}
              >
                <X className="size-3.5" />
                Remove photo
              </Button>
            </div>
          ) : null}

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              source
                ? "Describe the change — e.g. put me in front of the Eiffel Tower at sunset…"
                : "Describe the image you want — e.g. a small café in Lahore at golden hour, steam rising from chai cups…"
            }
            disabled={busy !== null}
            rows={3}
            maxLength={IMAGE_PROMPT_MAX}
            className="resize-none text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void runComposer();
            }}
          />

          {source && !variationCapable && status?.configured ? (
            <div
              className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
              role="status"
            >
              <p className="font-medium">
                {providerLabel(status, activeProvider)} can&apos;t edit photos.
              </p>
              <p className="mt-1 leading-6">
                Editing a photo needs a provider that accepts an uploaded
                image. Pick <strong>OpenAI Image</strong> or{" "}
                <strong>Gemini Image</strong> in the Provider menu below —
                the studio never switches providers for you silently.
                Describing a brand-new image works with any provider.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
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
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== null}
            >
              <Upload className="size-4" />
              {source ? "Change photo" : "Start from a photo"}
            </Button>

            <select
              value={activeProvider}
              onChange={(e) => pickProvider(e.target.value as ImageGenProviderId)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
              disabled={busy !== null || !status?.configured}
              aria-label="Provider"
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

            {activeMeta?.models?.length ? (
              <select
                value={model || activeMeta.defaultModel || ""}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
                disabled={busy !== null}
                aria-label="Model"
              >
                {activeMeta.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : null}

            <Button
              type="button"
              onClick={() => void runComposer()}
              disabled={!canGenerate}
              className="ml-auto"
            >
              {busy === "generate" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : source ? (
                <Wand2 className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {busy === "generate"
                ? "Creating…"
                : source
                  ? "Apply edit"
                  : "Generate"}
            </Button>
          </div>

          {busy === "generate" && (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              {providerLabel(status, activeProvider)} is working · {elapsed}s
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </section>

        {/* Gallery — everything the user has made, newest first. */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            <Images className="size-4" />
            Your gallery
          </h2>
          {gallery.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {gallery.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setEditText("");
                    setBgText("");
                    setEditError("");
                  }}
                  className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:ring-2 hover:ring-primary/40"
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
                  <span className="block truncate px-2.5 py-2 text-xs text-muted-foreground">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {status?.configured
                ? "Nothing here yet — describe your first image above and it will appear in your gallery."
                : "Once a provider is configured and you generate images, your gallery will live here."}
            </p>
          )}
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Each creation or edit costs 1,000 credits from your workspace
          budget. Share links are public — anyone with the link can view
          that image. Looking for one-tap photo restyles?{" "}
          <Link href="/studio" className="underline underline-offset-2 hover:text-foreground">
            Open the AI Photo Studio
          </Link>
          .
        </p>
      </main>

      {/* Detail + edit view for one gallery image. */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-left leading-6">
                  {selected.prompt}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {providerLabel(status, selected.provider)}
                  {selected.model ? ` · ${selected.model}` : ""}
                  {selected.createdAt
                    ? ` · ${new Date(selected.createdAt).toLocaleString()}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              {selected.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.src}
                  alt={selected.prompt}
                  className="max-h-[46dvh] w-full rounded-lg bg-muted/30 object-contain"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center rounded-lg bg-muted/30 text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => download(selected)}
                  disabled={!selected.src}
                >
                  <Download className="size-3.5" />
                  Download
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyShareLink(selected)}
                  disabled={selectedShare.busy}
                >
                  {selectedShare.busy ? (
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
                  onClick={() => void shareWhatsApp(selected)}
                  disabled={selectedShare.busy}
                >
                  <MessageCircle className="size-3.5" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void downloadShareCard(selected)}
                  disabled={!selected.src}
                >
                  <Share2 className="size-3.5" />
                  Share card
                </Button>
              </div>
              {selectedShare.message ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {selectedShare.message}
                </p>
              ) : null}
              {selectedShare.url ? (
                <p className="break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                  {selectedShare.url}
                </p>
              ) : null}

              <div className="border-t border-border pt-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Wand2 className="size-4" /> Edit this image
                </h3>

                {!variationCapable && status?.configured ? (
                  <div
                    className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                    role="status"
                  >
                    <p className="font-medium">
                      {providerLabel(status, activeProvider)} can&apos;t edit
                      images.
                    </p>
                    <p className="mt-1 leading-6">
                      Editing needs a provider that accepts an uploaded
                      image. Close this view and pick{" "}
                      <strong>OpenAI Image</strong> or{" "}
                      <strong>Gemini Image</strong> in the Provider menu —
                      the studio never switches providers for you silently.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_EDITS.map((edit) => (
                        <Button
                          key={edit.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void runEdit(edit.prompt)}
                          disabled={busy !== null || !status?.configured}
                        >
                          {edit.id === "remove-background" ? (
                            <Eraser className="size-3.5" />
                          ) : (
                            <Sparkles className="size-3.5" />
                          )}
                          {edit.label}
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-52 flex-1 space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Change the background to…
                        </span>
                        <input
                          value={bgText}
                          onChange={(e) => setBgText(e.target.value)}
                          placeholder="e.g. a beach at sunset, a modern office…"
                          maxLength={200}
                          disabled={busy !== null}
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void runEdit(backgroundChangePrompt(bgText.trim()))}
                        disabled={busy !== null || !bgText.trim() || !status?.configured}
                      >
                        <ImageIcon className="size-3.5" />
                        Change background
                      </Button>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Style variants
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {styleVariants.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => void runEdit(preset.editPrompt)}
                            disabled={busy !== null || !status?.configured}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                              "border-border hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Or describe any change
                      </span>
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="e.g. make it night-time, add rain, turn the car red…"
                        disabled={busy !== null}
                        rows={2}
                        maxLength={IMAGE_PROMPT_MAX}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => void runEdit(editText)}
                        disabled={busy !== null || !editText.trim() || !status?.configured}
                      >
                        {busy === "edit" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Wand2 className="size-4" />
                        )}
                        {busy === "edit" ? "Editing…" : "Apply edit"}
                      </Button>
                      {busy === "edit" && (
                        <p className="text-sm text-muted-foreground" role="status">
                          {providerLabel(status, activeProvider)} is working ·{" "}
                          {elapsed}s
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {editError && (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    {editError}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
