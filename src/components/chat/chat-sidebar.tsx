"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ChatConversationSummary = {
  id: string;
  title: string;
  modelId: string | null;
  updatedAt: string;
};

export function ChatSidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onRename,
  onDelete,
  footer,
}: {
  conversations: ChatConversationSummary[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  /** Pinned at the bottom of the sidebar (account block in the chat app). */
  footer?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = window.setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteId]);

  const visible = conversations.filter((row) =>
    row.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="outline">
          <Plus className="size-4" />
          New chat
        </Button>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="pl-8"
            aria-label="Search chats"
          />
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Conversations">
        {loading ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Loading chats…</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {conversations.length ? "No chats match your search." : "No chats yet. Start a new one."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((row) => {
              const active = row.id === activeId;
              const editing = row.id === editingId;
              return (
                <li key={row.id} className="group relative">
                  {editing ? (
                    <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
                      <Input
                        ref={editRef}
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            onRename(row.id, draftTitle.trim() || row.title);
                            setEditingId(null);
                          }
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                        aria-label="Conversation title"
                      />
                      <button
                        type="button"
                        aria-label="Save title"
                        className="rounded p-1 hover:bg-background"
                        onClick={() => {
                          onRename(row.id, draftTitle.trim() || row.title);
                          setEditingId(null);
                        }}
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel rename"
                        className="rounded p-1 hover:bg-background"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <MessageSquare className="size-4 shrink-0 opacity-60" />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left"
                        onClick={() => onSelect(row.id)}
                        title={row.title}
                      >
                        {row.title}
                      </button>
                      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                        <button
                          type="button"
                          aria-label={`Rename ${row.title}`}
                          className="rounded p-1 hover:bg-background"
                          onClick={() => {
                            setDraftTitle(row.title);
                            setEditingId(row.id);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={
                            confirmDeleteId === row.id
                              ? `Confirm delete ${row.title}`
                              : `Delete ${row.title}`
                          }
                          className={cn(
                            "rounded p-1 hover:bg-background",
                            confirmDeleteId === row.id && "font-medium text-destructive",
                          )}
                          onClick={() => {
                            if (confirmDeleteId === row.id) {
                              onDelete(row.id);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(row.id);
                            }
                          }}
                        >
                          {confirmDeleteId === row.id ? (
                            <span className="text-xs">Sure?</span>
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {footer ? (
        <div className="shrink-0 border-t border-border p-2">{footer}</div>
      ) : null}
    </div>
  );
}
