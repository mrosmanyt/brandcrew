"use client";

import { useState } from "react";
import { Check, Copy, FileText, Pencil, RotateCcw } from "lucide-react";
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
  attachments?: ComposerAttachment[];
};

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
        {message.content ? (
          <ChatMarkdown content={message.content} />
        ) : message.streaming ? (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-foreground/60" />
            <span className="text-sm">Thinking…</span>
          </div>
        ) : null}
        {message.streaming && message.content ? (
          <span className="mt-1 inline-block h-4 w-2 animate-pulse bg-foreground/70" />
        ) : null}
        {!message.streaming && message.content ? (
          <div className="mt-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <CopyButton text={message.content} />
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
  onRetry,
}: {
  message: string;
  notConfigured?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      className={cn(
        "mx-auto mb-4 w-full max-w-3xl rounded-2xl border px-4 py-3 text-sm",
        notConfigured
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
      role="alert"
    >
      <p className="font-medium">
        {notConfigured ? "Model not configured" : "Something went wrong"}
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
