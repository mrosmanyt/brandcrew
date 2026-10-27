"use client";

import Link from "next/link";
import { Download, Monitor } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DESKTOP_BUILD_REQUIRED_MESSAGE } from "@/lib/build-gate";
import { cinemAiAssistantDownloadHref } from "@/lib/cinem-ai-assistant";

export function DesktopBuildRequiredDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const downloadHref = cinemAiAssistantDownloadHref();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <Monitor className="size-5 text-foreground" />
          </div>
          <DialogTitle>Desktop app required</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {DESKTOP_BUILD_REQUIRED_MESSAGE}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Websites, landing pages, and multi-page sites</li>
          <li>Mobile apps, mini apps, and bots</li>
          <li>Design systems, slides, and build-style content packs</li>
        </ul>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button nativeButton={false} render={<Link href={downloadHref} target="_blank" rel="noopener noreferrer" />}>
            <Download className="size-4" />
            Download CINEM Pro for Windows
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/download" />}>
            All download options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
