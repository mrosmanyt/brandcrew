"use client";

import { useEffect, useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMarketingAuth } from "@/components/marketing/use-signed-in";
import {
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";
import {
  GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY,
  shouldShowGuestAssistantDownloadPrompt,
} from "@/lib/guest-assistant-download-prompt";

function readDownloaded(): boolean {
  try {
    return localStorage.getItem(GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDownloaded() {
  try {
    localStorage.setItem(GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * Blocking modal on the guest chat landing (`/`).
 * Re-shown on every tab refresh until the guest uses Download.
 * Signed-in users are skipped; packaged Electron/Tauri shells are skipped.
 */
export function CinemAiAssistantDownloadPrompt() {
  const { signedIn } = useMarketingAuth();
  const [authReady, setAuthReady] = useState(false);
  const [open, setOpen] = useState(false);
  const downloadHref = cinemAiAssistantDownloadHref();

  useEffect(() => {
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const offer = shouldShowGuestAssistantDownloadPrompt({
      downloaded: readDownloaded(),
      signedIn,
      userAgent: navigator.userAgent || "",
    });
    setOpen(offer);
  }, [authReady, signedIn]);

  function onDownload() {
    persistDownloaded();
    setOpen(false);
  }

  function onNotNow() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : undefined)}>
      <DialogContent className="max-w-md gap-5 sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" aria-hidden />
          </div>
          <DialogTitle className="font-heading text-2xl tracking-tight">
            {CINEM_AI_ASSISTANT_NAME}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] leading-relaxed">
            Your personal AI assistant on Windows — voice, vision, agents, and supervised desktop
            control with the same CINEM Pro account. Included in the desktop installer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            size="lg"
            className="w-full"
            nativeButton={false}
            render={
              <a
                href={downloadHref}
                download={CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onDownload}
              />
            }
          >
            <Download className="size-4" />
            Download now
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={onNotNow}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
