import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command, CornerDownLeft, Sparkles, History } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { processCommand } from "@/lib/orchestrator";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/** Curated quick commands (always available, filtered by typing). */
const SUGGESTIONS = [
  "open google",
  "research latest AI news",
  "play lofi on youtube",
  "video edit karo",
  "scan my system for threats",
  "what's on my screen?",
  "turn on the camera",
  "morning briefing",
  "search latest tech news",
];

/**
 * Command Palette — Ctrl/Cmd+K cyberpunk spotlight.
 * Type → pick from suggestions + your recent commands → Enter runs it
 * through the full orchestrator (same as chat/voice).
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const messages = useAppStore((s) => s.messages);

  // Ctrl/Cmd+K toggle, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        sfx.open();
        setOpen((o) => !o);
        setQuery("");
        setSel(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  /** Recent unique user commands (newest first). */
  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = messages.length - 1; i >= 0 && out.length < 5; i--) {
      const m = messages[i];
      if (m.role !== "user") continue;
      const key = m.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(m.text);
      }
    }
    return out;
  }, [messages]);

  const q = query.trim().toLowerCase();
  const items = useMemo(() => {
    const rec = recents
      .filter((r) => !q || r.toLowerCase().includes(q))
      .map((text) => ({ text, kind: "recent" as const }));
    const sug = SUGGESTIONS.filter(
      (s) => (!q || s.toLowerCase().includes(q)) && !rec.some((r) => r.text.toLowerCase() === s),
    ).map((text) => ({ text, kind: "suggestion" as const }));
    return [...rec, ...sug].slice(0, 8);
  }, [q, recents]);

  const run = (text: string) => {
    const cmd = text.trim();
    if (!cmd) return;
    setOpen(false);
    sfx.done();
    void processCommand(cmd);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="w-[620px] max-w-[92vw] border border-neon/40 bg-abyss/95 shadow-[0_0_50px_rgba(var(--glow),0.25)] backdrop-blur-xl"
            style={{ clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input row */}
            <div className="flex items-center gap-3 border-b border-neon/15 px-4 py-3">
              <Command className="size-4 shrink-0 text-neon" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    sfx.tick();
                    setSel((s) => Math.min(s + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    sfx.tick();
                    setSel((s) => Math.max(s - 1, 0));
                  } else if (e.key === "Enter") {
                    run(items[sel]?.text ?? query);
                  }
                }}
                placeholder="Command Cinem AI Assistant… (open google · research … · play …)"
                className="min-w-0 flex-1 bg-transparent text-sm text-ice outline-none placeholder:text-neon-dim/50"
              />
              <span className="hidden shrink-0 items-center gap-1 font-display text-[0.5rem] tracking-[0.2em] text-neon-dim sm:flex">
                <CornerDownLeft className="size-3" /> RUN · ESC CLOSE
              </span>
            </div>

            {/* Results */}
            <ul className="max-h-[300px] overflow-y-auto p-1.5">
              {items.map((it, i) => (
                <li key={`${it.kind}-${it.text}`}>
                  <button
                    onClick={() => run(it.text)}
                    onMouseEnter={() => setSel(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      i === sel
                        ? "border-l-2 border-neon bg-neon/10 text-ice shadow-[inset_0_0_18px_rgba(var(--glow),0.08)]"
                        : "border-l-2 border-transparent text-ice/75",
                    )}
                  >
                    {it.kind === "recent" ? (
                      <History className="size-3.5 shrink-0 text-neon-dim" />
                    ) : (
                      <Sparkles className="size-3.5 shrink-0 text-neon" />
                    )}
                    <span className="truncate">{it.text}</span>
                    <span className="ml-auto shrink-0 font-display text-[0.5rem] tracking-[0.2em] text-neon-dim">
                      {it.kind === "recent" ? "RECENT" : "SUGGESTED"}
                    </span>
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="px-3 py-3 text-sm text-neon-dim">
                  Press Enter to send "{query}" to Cinem AI Assistant.
                </li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
