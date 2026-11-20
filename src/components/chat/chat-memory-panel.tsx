"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type MemoryFact = { id: string; fact: string; createdAt: string };

type MemoryData = { customInstructions: string; facts: MemoryFact[] };

/**
 * Memory panel: the user sees everything the assistant remembers about
 * them, can delete any fact, add facts by hand, and edit their custom
 * instructions. Nothing is remembered silently — this panel is the only
 * way facts get in.
 */
export function ChatMemoryPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [addingFact, setAddingFact] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chat/memory");
      if (!response.ok) throw new Error("load failed");
      const memory = (await response.json()) as MemoryData;
      setData(memory);
      setInstructions(memory.customInstructions);
    } catch {
      setError("Could not load your memory. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const saveInstructions = async () => {
    setSavingInstructions(true);
    setError(null);
    try {
      const response = await fetch("/api/chat/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customInstructions: instructions }),
      });
      if (!response.ok) throw new Error("save failed");
      setSavedTick(true);
      window.setTimeout(() => setSavedTick(false), 1600);
    } catch {
      setError("Could not save your instructions. Try again.");
    } finally {
      setSavingInstructions(false);
    }
  };

  const addFact = async () => {
    const fact = newFact.trim();
    if (!fact) return;
    setAddingFact(true);
    setError(null);
    try {
      const response = await fetch("/api/chat/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "add failed");
      }
      const created = (await response.json()) as { fact: MemoryFact };
      setData((current) =>
        current
          ? { ...current, facts: [...current.facts, created.fact] }
          : current,
      );
      setNewFact("");
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "add failed"
          ? err.message
          : "Could not save that fact. Try again.",
      );
    } finally {
      setAddingFact(false);
    }
  };

  const deleteFact = async (id: string) => {
    setData((current) =>
      current
        ? { ...current, facts: current.facts.filter((row) => row.id !== id) }
        : current,
    );
    try {
      const response = await fetch(`/api/chat/memory/facts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("delete failed");
    } catch {
      setError("Could not delete that fact. Reload to see the current list.");
      void load();
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close memory panel"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-[15px] font-semibold">Memory & instructions</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {error ? (
            <p className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {loading || !data ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading your memory…
            </p>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-medium">Custom instructions</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Tell CINEM Pro how you want it to answer — tone, language,
                  format, anything. Applied to every new reply.
                </p>
                <Textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="e.g. Answer in Roman Urdu. Keep replies short. I run a clothing shop in Lahore — use PKR for prices."
                  className="mt-2"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void saveInstructions()}
                    disabled={savingInstructions}
                  >
                    {savingInstructions ? "Saving…" : "Save instructions"}
                  </Button>
                  {savedTick ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Saved
                    </span>
                  ) : null}
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-sm font-medium">What CINEM Pro remembers</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Only facts you add here are remembered — nothing is saved
                  silently. Delete anything, any time.
                </p>
                {data.facts.length ? (
                  <ul className="mt-3 space-y-2">
                    {data.facts.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 leading-6">{row.fact}</span>
                        <button
                          type="button"
                          aria-label="Forget this fact"
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                          onClick={() => void deleteFact(row.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                    Nothing remembered yet.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    value={newFact}
                    onChange={(event) => setNewFact(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addFact();
                      }
                    }}
                    maxLength={500}
                    placeholder="e.g. My shop is in Lahore and I sell shoes"
                    aria-label="New fact to remember"
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => void addFact()}
                    disabled={addingFact || !newFact.trim()}
                  >
                    <Plus className="size-4" /> Remember
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
