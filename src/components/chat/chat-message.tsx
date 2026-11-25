"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RotateCcw,
  Square,
  Volume2,
} from "lucide-react";
import { researchReportMarkdown } from "@/lib/deep-research";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ComposerAttachment } from "@/lib/composer";
import { formatByteSize } from "@/lib/composer-media";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./chat-markdown";

export type ChatUiMessage = {
  id: string | null;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  provider?: string | null;
  displayName?: string | null;
  streaming?: boolean;
  /** Deep-research progress label while a report is being built. */
  status?: string;
  attachments?: ComposerAttachment[];
  sources?: { title: string; url: string }[];
};

/** Numbered source list under a reply that used web search. */
export function ChatSources({
  sources,
}: {
  sources: { title: string; url: string }[];
}) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sources
      </p>
      <ol className="mt-1.5 space-y-1">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`} className="text-sm leading-6">
            <span className="text-muted-foreground">[{index + 1}]</span>{" "}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {source.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function attachmentImageSrc(file: ComposerAttachment): string | null {
  if (file.previewUrl) return file.previewUrl;
  if (file.kind === "image" && file.data) {
    return `data:${file.mime || "image/jpeg"};base64,${file.data}`;
  }
  return null;
}

/** Photos as thumbnails, everything else as a named file chip. */
export function ChatAttachments({ files }: { files: ComposerAttachment[] }) {
  const usable = files.filter((file) => !file.error);
  if (!usable.length) return null;
  return (
    <div className="mb-2 flex flex-wrap justify-end gap-2">
      {usable.map((file, index) => {
        const src = attachmentImageSrc(file);
        if (src) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${file.name}-${index}`}
              src={src}
              alt={file.name}
              className="max-h-48 w-auto max-w-full rounded-2xl border border-border object-cover"
            />
          );
        }
        return (
          <span
            key={`${file.name}-${index}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
          >
            <FileText className="size-4 shrink-0" />
            <span className="max-w-44 truncate font-medium text-foreground">
              {file.name}
            </span>
            {formatByteSize(file.size)}
          </span>
        );
      })}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Markdown → plain words worth hearing (code fences become "code block"). */
function plainTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block. ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1400);
}

/**
 * Listen button: asks the server to speak the reply (OpenAI TTS). When
 * voice is not configured the server says so and the note shows inline —
 * the button never pretends to play.
 */
function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [note, setNote] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setState("idle");
  };

  useEffect(() => stop, []);

  const toggle = async () => {
    if (state === "playing" || state === "loading") {
      stop();
      return;
    }
    setNote(null);
    setState("loading");
    try {
      const response = await fetch("/api/chat/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainTextForSpeech(text) }),
      });
      if (!response.ok) {
        let message = "Voice playback failed. Try again.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Keep the generic message.
        }
        setNote(message);
        setState("idle");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stop();
      audio.onerror = () => {
        setNote("Voice playback failed. Try again.");
        stop();
      };
      await audio.play();
      setState("playing");
    } catch {
      setNote("Voice playback failed. Try again.");
      setState("idle");
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={state === "playing" ? "Stop listening" : "Listen to reply"}
        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={() => void toggle()}
      >
        {state === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state === "playing" ? (
          <Square className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </button>
      {note ? (
        <span className="text-xs text-amber-600 dark:text-amber-400">{note}</span>
      ) : null}
    </span>
  );
}

/** Session-storage key the print view reads its report payload from. */
export const RESEARCH_PRINT_STORAGE_KEY = "cinem-research-print";

/**
 * Export actions for a sourced assistant reply (deep-research reports):
 * a markdown download generated client-side from the stored message, and
 * a print/PDF-friendly view of the same content + source list.
 */
function ReportExportButtons({
  content,
  sources,
}: {
  content: string;
  sources: { title: string; url: string }[];
}) {
  const downloadMarkdown = () => {
    const markdown = researchReportMarkdown({ content, sources });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "deep-research-report.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openPrintView = () => {
    try {
      window.sessionStorage.setItem(
        RESEARCH_PRINT_STORAGE_KEY,
        JSON.stringify({ content, sources }),
      );
    } catch {
      // Storage unavailable (private mode) — the print view will say so.
    }
    window.open("/chat/print", "_blank", "noopener");
  };
  return (
    <>
      <button
        type="button"
        aria-label="Download report as markdown"
        title="Download as markdown"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={downloadMarkdown}
      >
        <Download className="size-4" />
        .md
      </button>
      <button
        type="button"
        aria-label="Open print and PDF view"
        title="Print / save as PDF"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={openPrintView}
      >
        <Printer className="size-4" />
        Print / PDF
      </button>
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy message"
      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

export function ChatMessageItem({
  message,
  isLastAssistant,
  isLastUser,
  busy,
  onRegenerate,
  onEdit,
}: {
  message: ChatUiMessage;
  isLastAssistant: boolean;
  isLastUser: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onEdit: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (message.role === "user") {
    return (
      <li className="group flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%]">
          {editing ? (
            <div className="w-[min(34rem,80vw)] rounded-2xl border border-border bg-card p-2 shadow-sm">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                autoFocus
                className="border-0 shadow-none focus-visible:ring-0"
              />
              <div className="mt-1 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!draft.trim() || busy}
                  onClick={() => {
                    setEditing(false);
                    onEdit(draft.trim());
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.attachments?.length ? (
                <ChatAttachments files={message.attachments} />
              ) : null}
              {message.content ? (
                <div className="whitespace-pre-wrap rounded-3xl bg-muted px-4 py-2.5 text-[15px] leading-7">
                  {message.content}
                </div>
              ) : null}
              <div className="mt-1 flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                <CopyButton text={message.content} />
                {isLastUser && !busy ? (
                  <button
                    type="button"
                    aria-label="Edit message"
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setDraft(message.content);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="group">
      <div className="min-w-0">
        {message.streaming && message.status ? (
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" />
            <span className="truncate text-sm">{message.status}</span>
          </div>
        ) : null}
        {message.content ? (
          <ChatMarkdown content={message.content} />
        ) : message.streaming && !message.status ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-foreground/60" />
            <span className="text-sm">Thinking…</span>
          </div>
        ) : null}
        {message.streaming && message.content ? (
          <span className="mt-1 inline-block h-4 w-2 animate-pulse bg-foreground/70" />
        ) : null}
        {message.sources?.length ? (
          <ChatSources sources={message.sources} />
        ) : null}
        {!message.streaming && message.content ? (
          <div className="mt-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <CopyButton text={message.content} />
            <SpeakButton text={message.content} />
            {message.sources?.length ? (
              <ReportExportButtons
                content={message.content}
                sources={message.sources}
              />
            ) : null}
            {isLastAssistant && !busy ? (
              <button
                type="button"
                aria-label="Regenerate reply"
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={onRegenerate}
              >
                <RotateCcw className="size-4" />
              </button>
            ) : null}
            {message.displayName ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {message.displayName}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function ChatErrorNotice({
  message,
  notConfigured,
  notice,
  onRetry,
}: {
  message: string;
  notConfigured?: boolean;
  /** Calm neutral notice (e.g. microphone help) instead of a failure banner. */
  notice?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      className={cn(
        "mx-auto mb-4 w-full max-w-3xl rounded-2xl border px-4 py-3 text-sm",
        notConfigured
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : notice
            ? "border-border bg-muted text-foreground"
            : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
      role={notice ? "status" : "alert"}
    >
      <p className="font-medium">
        {notConfigured
          ? "Model not configured"
          : notice
            ? "Microphone"
            : "Something went wrong"}
      </p>
      <p className="mt-0.5 leading-6 opacity-90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 font-medium underline underline-offset-2"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
