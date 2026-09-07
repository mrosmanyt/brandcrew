"use client";

import { useMemo, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractPreviewHtml } from "@/lib/html-preview";
import type { ArtifactDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PreviewPanel({
  artifacts,
  className,
}: {
  artifacts: ArtifactDTO[];
  className?: string;
}) {
  const previewable = useMemo(
    () =>
      artifacts
        .map((artifact) => ({
          artifact,
          html: extractPreviewHtml(artifact.content),
        }))
        .filter((row) => row.html),
    [artifacts],
  );
  const [index, setIndex] = useState(0);
  const current = previewable[Math.min(index, Math.max(previewable.length - 1, 0))];

  if (!current) return null;

  return (
    <aside className={cn("flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MonitorSmartphone className="size-3.5" />
            Preview
          </p>
          <h2 className="truncate text-sm font-medium">{current.artifact.title}</h2>
        </div>
        {previewable.length > 1 ? (
          <div className="flex gap-1">
            {previewable.map((row, i) => (
              <button
                key={row.artifact.id}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "size-1.5 rounded-full",
                  i === index ? "bg-foreground" : "bg-muted-foreground/40",
                )}
                aria-label={`Preview ${row.artifact.title}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 px-3 pb-3">
        <iframe
          title={current.artifact.title}
          sandbox=""
          srcDoc={current.html || ""}
          className="h-full min-h-[18rem] w-full rounded-lg border border-border bg-white"
        />
      </div>
      <p className="px-3 pb-3 text-[11px] leading-4 text-muted-foreground">
        Local iframe preview. Nothing is published. No Replit login.
      </p>
    </aside>
  );
}

export function hasPreviewableArtifacts(artifacts: ArtifactDTO[]): boolean {
  return artifacts.some((artifact) => Boolean(extractPreviewHtml(artifact.content)));
}

export function OpenPreviewHint({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <Button size="xs" variant="ghost" onClick={onClick}>
      Preview
    </Button>
  );
}
