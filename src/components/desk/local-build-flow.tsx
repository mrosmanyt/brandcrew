"use client";

import { useCallback, useState } from "react";
import { FolderOpen, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isDesktopClient } from "@/lib/desktop-client";
import type { BuildPromptIntent } from "@/lib/build-prompt";
import { playbookUsesLocalFiles } from "@/lib/build-gate";

export type LocalBuildOutcome = {
  ok: boolean;
  folder?: string;
  files?: string[];
  summary?: string;
  error?: string;
};

function kindFromIntent(intent: BuildPromptIntent): "website" | "app" | "deck" {
  if (intent.action === "build_app") return "app";
  if (intent.action === "build_deck") return "deck";
  return "website";
}

export function useLocalBuildFlow() {
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [pending, setPending] = useState<{
    intent: BuildPromptIntent;
    message: string;
    resolve: (value: LocalBuildOutcome | null) => void;
  } | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const maybeRunLocalBuild = useCallback(
    async (intent: BuildPromptIntent, message: string): Promise<LocalBuildOutcome | null> => {
      if (!isDesktopClient()) return null;
      if (!playbookUsesLocalFiles(intent.playbookKey)) return null;

      const bridge = window.brandcrewDesktop;
      if (!bridge?.pickProjectFolder || !bridge.requestBuildPermission || !bridge.runLocalBuild) {
        return null;
      }

      const perm = await bridge.getBuildPermission?.();
      let projectFolder = perm?.folder || folder;
      if (!perm?.granted || !projectFolder) {
        return new Promise((resolve) => {
          setPending({ intent, message, resolve });
          setPermissionOpen(true);
        });
      }

      setBusy(true);
      try {
        const result = await bridge.runLocalBuild({
          kind: kindFromIntent(intent),
          prompt: message.trim() || "New CINEM Pro project",
          folder: projectFolder,
        });
        return result;
      } finally {
        setBusy(false);
      }
    },
    [folder],
  );

  async function pickFolder() {
    const bridge = window.brandcrewDesktop;
    if (!bridge?.pickProjectFolder) return;
    const picked = await bridge.pickProjectFolder();
    if (picked.ok && picked.path) setFolder(picked.path);
  }

  async function allowAndBuild() {
    if (!pending) return;
    const bridge = window.brandcrewDesktop;
    if (!bridge?.requestBuildPermission || !bridge.runLocalBuild) {
      pending.resolve({ ok: false, error: "Desktop builder is unavailable." });
      setPermissionOpen(false);
      setPending(null);
      return;
    }
    let projectFolder = folder;
    if (!projectFolder) {
      const picked = await bridge.pickProjectFolder?.();
      if (!picked?.ok || !picked.path) return;
      projectFolder = picked.path;
      setFolder(projectFolder);
    }
    const allowed = await bridge.requestBuildPermission(projectFolder);
    if (!allowed.granted) return;
    setBusy(true);
    try {
      const result = await bridge.runLocalBuild({
        kind: kindFromIntent(pending.intent),
        prompt: pending.message.trim() || "New CINEM Pro project",
        folder: allowed.folder || projectFolder,
      });
      pending.resolve(result);
    } catch (error) {
      pending.resolve({
        ok: false,
        error: error instanceof Error ? error.message : "Local build failed.",
      });
    } finally {
      setBusy(false);
      setPermissionOpen(false);
      setPending(null);
    }
  }

  function cancelPermission() {
    pending?.resolve(null);
    setPending(null);
    setPermissionOpen(false);
  }

  const permissionDialog = (
    <Dialog open={permissionOpen} onOpenChange={(open) => !open && cancelPermission()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle>Allow local build access?</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            CINEM Pro will create folders and write project files on your computer in the
            folder you choose. Nothing is uploaded until you share it from the desk.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-muted-foreground">Project folder</p>
          <p className="truncate font-mono text-xs">{folder || "Not selected yet"}</p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" variant="outline" onClick={() => void pickFolder()} disabled={busy}>
            <FolderOpen className="size-4" />
            Choose folder…
          </Button>
          <Button type="button" onClick={() => void allowAndBuild()} disabled={busy || !folder}>
            Allow and build
          </Button>
          <Button type="button" variant="ghost" onClick={cancelPermission} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { maybeRunLocalBuild, permissionDialog, localBuildBusy: busy };
}
