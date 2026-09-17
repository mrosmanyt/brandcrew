"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ImageGenStatus = {
  configured: boolean;
  source: "env" | "byok" | "none";
  setupHint: string;
};

type ImageGenResponse = {
  imageBase64: string;
  mimeType: "image/jpeg";
  prompt: string;
  source: "env" | "byok";
};

export function ImageGeneratorPanel({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<ImageGenStatus | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageGenResponse | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/image/generate");
    if (!res.ok) {
      setStatus({
        configured: false,
        source: "none",
        setupHint: "Sign in to generate images.",
      });
      return;
    }
    const data = (await res.json()) as ImageGenStatus;
    setStatus(data);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
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
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `cinem-image-${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <p className="page-kicker">Desk tools</p>
      <h1 className="font-heading mt-1 flex items-center gap-2 text-2xl tracking-tight">
        <ImageIcon className="size-6 text-primary" />
        Generate image
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Text-to-image via your Cloudflare Workers AI endpoint. Prompts are proxied
        server-side — the worker API key never reaches the browser.
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
            disabled={busy || !prompt.trim() || !status?.configured}
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
              Download JPG
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
              {result.source === "byok" ? " · your worker" : " · server worker"}
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
        Workspace: {workspaceId}. Self-host reference:{" "}
        <code className="rounded bg-muted px-1 py-0.5">
          docs/integrations/cloudflare-image-worker/
        </code>
      </p>
    </div>
  );
}
