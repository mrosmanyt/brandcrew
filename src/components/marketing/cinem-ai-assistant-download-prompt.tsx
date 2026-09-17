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
import {
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";
import {
  GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY,
  shouldShowGuestAssistantDownloadPrompt,
} from "@/lib/guest-assistant-download-prompt";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismissed() {
  try {
    localStorage.setItem(GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * Blocking first-visit modal on the guest chat landing (`/`).
 * Reuses the unified Windows installer CTA — same href as /download and desk build gate.
 */
export function CinemAiAssistantDownloadPrompt() {
  const [open, setOpen] = useState(false);
  const downloadHref = cinemAiAssistantDownloadHref();

  useEffect(() => {
    const offer = shouldShowGuestAssistantDownloadPrompt({
      dismissed: readDismissed(),
      userAgent: navigator.userAgent || "",
    });
    setOpen(offer);
  }, []);

  function dismiss() {
    persistDismissed();
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    if (!next) dismiss();
    else setOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 sm:max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" aria-hidden />
          </div>
          <DialogTitle className="font-heading text-2xl tracking-tight">
            {CINEM_AI_ASSISTANT_NAME}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] leading-relaxed">
            Your personal AI assistant on Windows — voice, vision, and agents with the same CINEM
            Pro account. Included in the desktop installer.
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
                onClick={dismiss}
              />
            }
          >
            <Download className="size-4" />
            Download now
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={dismiss}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
