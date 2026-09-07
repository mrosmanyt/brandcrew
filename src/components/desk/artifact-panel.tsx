"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownBody } from "@/components/desk/markdown";
import { providerLabel } from "@/components/desk/provider-badges";
import type { ArtifactDTO } from "@/lib/types";

export function ArtifactPanel({
  artifact,
  onApprove,
  onRegenerate,
  busy,
}: {
  artifact: ArtifactDTO;
  onApprove: () => void;
  onRegenerate: () => void;
  busy?: boolean;
}) {
  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(artifact.content);
      toast.success("Markdown copied.");
    } catch {
      toast.error("Could not copy. Select the text instead.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-lg leading-tight">{artifact.title}</h3>
        <Badge variant={artifact.status === "approved" ? "default" : "secondary"}>
          {artifact.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Produced by {providerLabel(artifact.provider)}
        {artifact.model && artifact.model !== "demo" ? ` · ${artifact.model}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {artifact.status !== "approved" ? (
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <Check className="size-3.5" />
            Approve
          </Button>
        ) : (
          <p className="self-center text-xs text-muted-foreground">
            Approved. Ops has a Schedule/publish card; posts land on the calendar.
          </p>
        )}
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={busy}>
          <RefreshCw className="size-3.5" />
          Regenerate
        </Button>
        <Button size="sm" variant="outline" onClick={copyMarkdown}>
          <Copy className="size-3.5" />
          Copy Markdown
        </Button>
      </div>
      <MarkdownBody content={artifact.content} />
    </div>
  );
}
