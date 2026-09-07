"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { MarkdownBody } from "@/components/desk/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayAgentName } from "@/lib/constants";
import type { LiveProgressLine } from "@/lib/live-progress";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatBubble({
  message,
  agentName,
  agentId,
  agentRole,
  working,
}: {
  message: MessageDTO;
  agentName?: string;
  agentId?: string | null;
  agentRole?: string | null;
  working?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <article
      className={cn(
        "flex w-full gap-2.5",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <AgentAvatar
          id={agentId}
          name={agentName}
          role={agentRole}
          working={working}
          size="sm"
          className="mt-0.5"
        />
      ) : null}
      <div
        className={cn(
          "max-w-[min(40rem,86%)] rounded-2xl px-3.5 py-2 text-sm leading-6",
          isUser
            ? "rounded-br-md bg-secondary text-secondary-foreground"
            : "rounded-bl-md border border-border bg-card text-card-foreground",
        )}
      >
        <p className="text-[11px] leading-4 text-muted-foreground">
          {isUser ? "You" : displayAgentName(agentName)}
        </p>
        <div className={cn("mt-0.5", isUser ? "whitespace-pre-wrap" : "")}>
          {isUser ? (
            message.content
          ) : (
            <div className="[&_.prose-artifact]:text-sm [&_.prose-artifact_p]:my-0 [&_.prose-artifact_h1]:mt-0 [&_.prose-artifact_h1]:text-base">
              <MarkdownBody content={message.content} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProgressCard({ line }: { line: LiveProgressLine }) {
  const Icon =
    line.tone === "working"
      ? Loader2
      : line.tone === "wait"
        ? Sparkles
        : line.tone === "error"
          ? AlertCircle
          : line.tone === "success"
            ? CheckCircle2
            : Circle;
  return (
    <div className="flex justify-start pl-8">
      <div
        className={cn(
          "inline-flex max-w-[min(36rem,86%)] items-start gap-2 rounded-xl border px-2.5 py-1.5 text-xs leading-5",
          line.tone === "wait" &&
            "border-amber-500/30 bg-amber-500/8 text-amber-950 dark:text-amber-100",
          line.tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
          line.tone === "working" &&
            "border-sky-500/25 bg-sky-500/8 text-sky-950 dark:text-sky-100",
          (line.tone === "info" || line.tone === "success") &&
            "border-border bg-muted/40 text-muted-foreground",
        )}
      >
        <Icon
          className={cn(
            "mt-0.5 size-3.5 shrink-0",
            line.tone === "working" && "animate-spin",
          )}
        />
        <div className="min-w-0">
          <p className="text-foreground/90">{line.label}</p>
          {line.detail && line.detail !== line.label ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {line.detail.startsWith("×") ? `${line.detail} times` : line.detail}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ThreadDraftCard({
  artifact,
  busy,
  onApprove,
  onRegenerate,
}: {
  artifact: ArtifactDTO;
  busy?: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
}) {
  const excerpt = artifact.content.replace(/\s+/g, " ").trim().slice(0, 160);
  return (
    <div className="flex justify-start pl-8">
      <div className="w-full max-w-[min(40rem,86%)] rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{artifact.title}</p>
          <Badge variant={artifact.status === "approved" ? "default" : "secondary"}>
            {artifact.status}
          </Badge>
        </div>
        {excerpt ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {excerpt}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {artifact.status !== "approved" ? (
            <Button size="xs" onClick={onApprove} disabled={busy}>
              Approve
            </Button>
          ) : (
            <p className="self-center text-[11px] text-muted-foreground">Approved.</p>
          )}
          <Button size="xs" variant="outline" onClick={onRegenerate} disabled={busy}>
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
