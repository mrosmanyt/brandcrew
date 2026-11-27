"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  History,
  Loader2,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canvasDownloadName,
  canvasSeedFromMessage,
} from "@/lib/chat-canvas-pure";
import { ChatErrorNotice } from "./chat-message";

export type CanvasDTO = {
  id: string;
  conversationId: string;
  title: string;
  kind: string;
  language: string;
  content: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type CanvasVersionDTO = {
  id: string;
  version: number;
  kind: string;
  instruction: string;
  model: string;
  provider: string;
  tokens: number;
  createdAt: string;
};

export type CanvasSeedRequest = { content: string; nonce: number };
export type ActiveCanvasSummary = { id: string; title: string } | null;

type PanelNotice = { message: string; notConfigured: boolean };

const VERSION_KIND_LABELS: Record<string, string> = {
  create: "Created",
  user: "Your edit",
  ai: "AI edit",
  restore: "Restore",
};

async function readPanelError(response: Response): Promise<PanelNotice> {
  try {
    const data = (await response.json()) as { error?: string; code?: string };
    return {
      message: data.error || "The request failed. Try again.",
      notConfigured: data.code === "model_not_configured",
    };
  } catch {
    return { message: "The request failed. Try again.", notConfigured: false };
  }
}

/**
 * Canvas panel beside the chat thread. The document/code lives here:
 * the user types directly, saves create versions, and AI changes arrive
 * as targeted block edits (never a full rewrite) either from the
 * instruction box below or from the chat composer while "Chat edits
 * canvas" is on. Everything persists server-side per conversation.
 */
export function ChatCanvasPanel({
  conversationId,
  modelId,
  seed,
  reloadNonce,
  editMode,
  onToggleEditMode,
  onActiveCanvasChange,
  onClose,
  onThreadChanged,
}: {
  conversationId: string | null;
  modelId: string;
  seed: CanvasSeedRequest | null;
  reloadNonce: number;
  editMode: boolean;
  onToggleEditMode: (next: boolean) => void;
  onActiveCanvasChange: (canvas: ActiveCanvasSummary) => void;
  onClose: () => void;
  onThreadChanged: () => void;
}) {
  const [canvases, setCanvases] = useState<CanvasDTO[]>([]);
  const [canvas, setCanvas] = useState<CanvasDTO | null>(null);
  const [versions, setVersions] = useState<CanvasVersionDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [loading, setLoading] = useState(() => Boolean(conversationId));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<PanelNotice | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newKind, setNewKind] = useState<"document" | "code">("document");
  const [newTitle, setNewTitle] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [creating, setCreating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const consumedSeedRef = useRef(0);
  const lastReloadNonceRef = useRef(reloadNonce);

  const dirty =
    canvas !== null &&
    (draft !== canvas.content || draftTitle.trim() !== canvas.title);

  const loadDetail = useCallback(
    async (canvasId: string) => {
      try {
        const response = await fetch(`/api/chat/canvas/${canvasId}`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          canvas: CanvasDTO;
          versions: CanvasVersionDTO[];
        };
        setCanvas(data.canvas);
        setVersions(data.versions);
        setDraft(data.canvas.content);
        setDraftTitle(data.canvas.title);
        onActiveCanvasChange({ id: data.canvas.id, title: data.canvas.title });
      } catch {
        // Keep the current canvas on screen; a later action retries.
      }
    },
    [onActiveCanvasChange],
  );

  const fetchCanvasList = useCallback(
    async (convId: string): Promise<CanvasDTO[]> => {
      try {
        const response = await fetch(
          `/api/chat/canvas?conversationId=${encodeURIComponent(convId)}`,
        );
        if (!response.ok) return [];
        const data = (await response.json()) as { canvases: CanvasDTO[] };
        return data.canvases;
      } catch {
        // Empty list state shows; creating still works.
        return [];
      }
    },
    [],
  );

  const refreshList = useCallback(
    async (convId: string) => {
      setCanvases(await fetchCanvasList(convId));
    },
    [fetchCanvasList],
  );

  // The parent keys this panel by conversation, so mounting means a
  // fresh conversation: load its canvases and open the most recent one.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    void (async () => {
      const rows = await fetchCanvasList(conversationId);
      if (cancelled) return;
      setCanvases(rows);
      setLoading(false);
      if (rows.length) await loadDetail(rows[0].id);
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only for this conversation (parent remounts on switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // A composer-routed AI edit landed: refresh the open canvas.
  useEffect(() => {
    if (reloadNonce === lastReloadNonceRef.current) return;
    lastReloadNonceRef.current = reloadNonce;
    void (async () => {
      if (canvas) await loadDetail(canvas.id);
      if (conversationId) await refreshList(conversationId);
    })();
    // Only the nonce drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadNonce]);

  const createCanvas = useCallback(
    async (input: {
      title?: string;
      kind: "document" | "code";
      language?: string;
      content?: string;
    }): Promise<CanvasDTO | null> => {
      if (!conversationId) return null;
      try {
        const response = await fetch("/api/chat/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, ...input }),
        });
        if (!response.ok) {
          setNotice(await readPanelError(response));
          return null;
        }
        const data = (await response.json()) as { canvas: CanvasDTO };
        return data.canvas;
      } catch {
        setNotice({
          message: "Could not create the canvas. Try again.",
          notConfigured: false,
        });
        return null;
      }
    },
    [conversationId],
  );

  // "Open in canvas" from a chat message: seed a new canvas from it.
  useEffect(() => {
    if (!seed || !conversationId || seed.nonce === consumedSeedRef.current) {
      return;
    }
    consumedSeedRef.current = seed.nonce;
    const seeded = canvasSeedFromMessage(seed.content);
    void (async () => {
      const created = await createCanvas({
        title: seeded.title,
        kind: seeded.kind,
        language: seeded.language,
        content: seeded.content,
      });
      if (created) {
        await refreshList(conversationId);
        await loadDetail(created.id);
      }
    })();
  }, [seed, conversationId, createCanvas, refreshList, loadDetail]);

  const saveNow = useCallback(async () => {
    if (!canvas || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/chat/canvas/${canvas.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, content: draft }),
      });
      if (!response.ok) {
        setNotice(await readPanelError(response));
        return;
      }
      await loadDetail(canvas.id);
      if (conversationId) void refreshList(conversationId);
    } catch {
      setNotice({ message: "Saving failed. Try again.", notConfigured: false });
    } finally {
      setSaving(false);
    }
  }, [canvas, saving, draft, draftTitle, loadDetail, refreshList, conversationId]);

  // Autosave a beat after typing stops (creates a version per save).
  useEffect(() => {
    if (!dirty || !canvas) return;
    const timer = window.setTimeout(() => void saveNow(), 1500);
    return () => window.clearTimeout(timer);
  }, [dirty, canvas, draft, draftTitle, saveNow]);

  const restoreVersion = async (version: CanvasVersionDTO) => {
    if (!canvas || version.version === canvas.currentVersion) return;
    try {
      const response = await fetch(`/api/chat/canvas/${canvas.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });
      if (!response.ok) {
        setNotice(await readPanelError(response));
        return;
      }
      await loadDetail(canvas.id);
      setAiNote(`Restored version ${version.version}.`);
    } catch {
      setNotice({ message: "Restore failed. Try again.", notConfigured: false });
    }
  };

  const deleteCanvas = async () => {
    if (!canvas) return;
    const deletedId = canvas.id;
    try {
      await fetch(`/api/chat/canvas/${deletedId}`, { method: "DELETE" });
    } catch {
      // List refresh below reflects the server state either way.
    }
    setCanvas(null);
    setVersions([]);
    onActiveCanvasChange(null);
    if (conversationId) {
      const remaining = canvases.filter((row) => row.id !== deletedId);
      setCanvases(remaining);
      if (remaining.length) void loadDetail(remaining[0].id);
    }
  };

  const submitNewCanvas = async () => {
    setCreating(true);
    const created = await createCanvas({
      title: newTitle.trim() || undefined,
      kind: newKind,
      language: newKind === "code" ? newLanguage.trim() : undefined,
      content: "",
    });
    setCreating(false);
    if (created && conversationId) {
      setShowNewForm(false);
      setNewTitle("");
      setNewLanguage("");
      await refreshList(conversationId);
      await loadDetail(created.id);
    }
  };

  const applyAiEdit = async () => {
    const instruction = aiInstruction.trim();
    if (!instruction || !canvas || aiBusy) return;
    setAiBusy(true);
    setNotice(null);
    setAiNote(null);
    try {
      const response = await fetch(`/api/chat/canvas/${canvas.id}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, modelId }),
      });
      const data = (await response.json().catch(() => null)) as {
        status?: string;
        refusal?: string;
        summary?: string;
        appliedCount?: number;
        skippedCount?: number;
        version?: number;
        error?: string;
        code?: string;
      } | null;
      if (!response.ok) {
        setNotice({
          message: data?.error || "The AI edit failed. Try again.",
          notConfigured: data?.code === "model_not_configured",
        });
        return;
      }
      if (data?.status === "refused") {
        setAiNote(data.refusal ?? "That request was refused.");
        setAiInstruction("");
        onThreadChanged();
        return;
      }
      const parts = [
        data?.summary ? `${data.summary}` : "Canvas updated.",
        `(${data?.appliedCount ?? 0} edit${data?.appliedCount === 1 ? "" : "s"} applied${
          data?.skippedCount
            ? `, ${data.skippedCount} skipped — could not be matched`
            : ""
        } · version ${data?.version ?? ""})`,
      ];
      setAiNote(parts.join(" "));
      setAiInstruction("");
      await loadDetail(canvas.id);
      if (conversationId) void refreshList(conversationId);
      onThreadChanged();
    } catch {
      setNotice({
        message: "The AI edit failed. Check your connection and try again.",
        notConfigured: false,
      });
    } finally {
      setAiBusy(false);
    }
  };

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // Clipboard unavailable (permissions); download still works.
    }
  };

  const downloadContent = () => {
    if (!canvas) return;
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = canvasDownloadName(
      draftTitle || canvas.title,
      canvas.kind,
      canvas.language,
    );
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section
      aria-label="Canvas"
      className="fixed inset-0 z-40 flex flex-col bg-background lg:static lg:z-auto lg:w-[540px] lg:shrink-0 lg:border-l lg:border-border xl:w-[620px]"
    >
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border px-3">
        <NotebookPen className="size-4 shrink-0 text-muted-foreground" />
        {canvas ? (
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={() => {
              if (dirty) void saveNow();
            }}
            aria-label="Canvas title"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            Canvas
          </span>
        )}
        {canvas ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            v{canvas.currentVersion}
            {canvas.kind === "code"
              ? ` · ${canvas.language || "code"}`
              : " · doc"}
          </span>
        ) : null}
        {canvas ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Version history"
                title="Version history"
              >
                <History className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Version history</DropdownMenuLabel>
                  {versions.map((version) => (
                    <DropdownMenuItem
                      key={version.id}
                      disabled={version.version === canvas.currentVersion}
                      onClick={() => void restoreVersion(version)}
                    >
                      <span className="flex-1">
                        <span className="block font-medium">
                          Version {version.version} ·{" "}
                          {VERSION_KIND_LABELS[version.kind] ?? version.kind}
                          {version.version === canvas.currentVersion
                            ? " (current)"
                            : ""}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {version.instruction ||
                            new Date(version.createdAt).toLocaleString()}
                        </span>
                      </span>
                      {version.version === canvas.currentVersion ? (
                        <Check className="size-4" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              aria-label="Copy canvas content"
              title="Copy"
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => void copyContent()}
            >
              <Copy className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Download canvas"
              title="Download"
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={downloadContent}
            >
              <Download className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Delete canvas"
              title="Delete canvas"
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void deleteCanvas()}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="Close canvas"
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex max-w-56 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted"
            aria-label="Switch canvas"
          >
            <span className="truncate">
              {canvas ? canvas.title : "No canvas yet"}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Canvases in this chat</DropdownMenuLabel>
              {canvases.map((row) => (
                <DropdownMenuItem
                  key={row.id}
                  onClick={() => void loadDetail(row.id)}
                >
                  <span className="flex-1 truncate">{row.title}</span>
                  {canvas?.id === row.id ? <Check className="size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowNewForm(true)}
              disabled={!conversationId}
            >
              <Plus className="size-4" />
              New canvas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1" />
        <button
          type="button"
          disabled={!canvas}
          onClick={() => onToggleEditMode(!editMode)}
          className={
            editMode
              ? "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground transition hover:opacity-90 disabled:opacity-50"
              : "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          }
          title="When on, messages you send in chat apply as targeted edits to this canvas instead of a normal reply"
        >
          <Sparkles className="size-3.5" />
          Chat edits canvas: {editMode ? "on" : "off"}
        </button>
      </div>

      {notice ? (
        <div className="shrink-0 px-3 pt-3">
          <ChatErrorNotice
            message={notice.message}
            notConfigured={notice.notConfigured}
          />
        </div>
      ) : null}

      {!conversationId ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            Canvas attaches to a conversation. Send a first message in this
            chat, then open the canvas again.
          </p>
        </div>
      ) : showNewForm ? (
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <h2 className="font-heading text-lg">New canvas</h2>
          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Title
          </label>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Untitled canvas"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Type
          </label>
          <div className="mt-1.5 flex gap-2">
            {(["document", "code"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setNewKind(kind)}
                className={
                  newKind === kind
                    ? "rounded-full bg-secondary px-3.5 py-1.5 text-sm font-medium text-secondary-foreground"
                    : "rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted"
                }
              >
                {kind === "document" ? "Document" : "Code"}
              </button>
            ))}
          </div>
          {newKind === "code" ? (
            <>
              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Language
              </label>
              <input
                value={newLanguage}
                onChange={(event) => setNewLanguage(event.target.value)}
                placeholder="python, tsx, html…"
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </>
          ) : null}
          <div className="mt-6 flex gap-2">
            <Button onClick={() => void submitNewCanvas()} disabled={creating}>
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create canvas
            </Button>
            <Button variant="ghost" onClick={() => setShowNewForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : loading && !canvas ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !canvas ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <NotebookPen className="size-8 text-muted-foreground" />
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
            Work on a document or code side by side with this chat. You type
            directly; the AI makes small targeted edits — never a full
            rewrite — and every version is kept.
          </p>
          <Button className="mt-5" onClick={() => setShowNewForm(true)}>
            <Plus className="size-4" />
            New canvas
          </Button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Canvas content"
              placeholder={
                canvas.kind === "code"
                  ? "Write or paste code — or ask the AI below to draft it."
                  : "Write or paste your document — or ask the AI below to draft it."
              }
              className={
                canvas.kind === "code"
                  ? "h-full w-full resize-none rounded-none border-0 bg-transparent p-4 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0"
                  : "h-full w-full resize-none rounded-none border-0 bg-transparent p-4 text-sm leading-7 shadow-none focus-visible:ring-0"
              }
            />
          </div>
          <div className="shrink-0 border-t border-border px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex-1">
                {saving
                  ? "Saving…"
                  : dirty
                    ? "Unsaved changes"
                    : `Saved · version ${canvas.currentVersion}`}
              </span>
              {dirty ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void saveNow()}
                  disabled={saving}
                >
                  Save
                </Button>
              ) : null}
            </div>
            {aiNote ? (
              <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs leading-5">
                {aiNote}
              </p>
            ) : null}
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void applyAiEdit();
              }}
            >
              <input
                value={aiInstruction}
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder="Ask AI to edit — e.g. “make the intro shorter”"
                aria-label="AI edit instruction"
                className="min-w-0 flex-1 rounded-full border border-border bg-card px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="submit"
                size="sm"
                className="shrink-0 rounded-full"
                disabled={aiBusy || !aiInstruction.trim()}
              >
                {aiBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Apply AI edit
              </Button>
            </form>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
              AI edits change only the blocks that need it — your document is
              never regenerated wholesale.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
