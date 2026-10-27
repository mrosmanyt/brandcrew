"use client";

import { Download, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  artifactMarkdown,
  downloadPdf,
  downloadTextFile,
  printArtifactHtml,
  safeDownloadName,
} from "@/lib/export-artifact";
import type { ArtifactDTO } from "@/lib/types";

export function ArtifactExportButtons({
  artifact,
  size = "sm",
}: {
  artifact: ArtifactDTO;
  size?: "xs" | "sm";
}) {
  const markdown = artifactMarkdown({
    title: artifact.title,
    content: artifact.content,
    type: artifact.type,
  });
  const filename = safeDownloadName(artifact.title);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Markdown copied.");
    } catch {
      toast.error("Could not copy. Select the text instead.");
    }
  }

  function downloadMd() {
    downloadTextFile(filename, markdown);
    toast.success("Markdown downloaded.");
  }

  function downloadSimplePdf() {
    downloadPdf(filename, artifact.title, artifact.content);
    toast.success("Simple PDF downloaded.");
  }

  function printPdf() {
    const opened = printArtifactHtml(artifact.title, markdown);
    if (!opened) {
      toast.error("Allow pop-ups to print or save as PDF.");
      return;
    }
    toast.message("Use the browser Print dialog → Save as PDF.");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} variant="outline" onClick={copy}>
        Copy Markdown
      </Button>
      <Button size={size} variant="outline" onClick={downloadMd}>
        <Download className="size-3.5" />
        Download .md
      </Button>
      <Button size={size} variant="outline" onClick={downloadSimplePdf}>
        <FileDown className="size-3.5" />
        Download PDF
      </Button>
      <Button size={size} variant="ghost" onClick={printPdf}>
        <Printer className="size-3.5" />
        Print / PDF
      </Button>
    </div>
  );
}
