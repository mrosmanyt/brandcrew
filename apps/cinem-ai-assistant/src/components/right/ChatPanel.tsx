import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, CircleHelp, Settings2, SendHorizonal, BrainCircuit, Loader2, ChevronRight,
} from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import { useAppStore, type ChatMessage } from "@/store/useAppStore";
import { processCommand } from "@/lib/orchestrator";
import { isRtlText } from "@/lib/language";
import { cn } from "@/lib/utils";
import Markdown from "@/components/Markdown";

/** Orchestrator "brain" block — live thinking process (Stonic-style). */
function ThoughtBlock({ m }: { m: ChatMessage }) {
  return (
    <div
      className="border border-neon/25 bg-neon/[0.04] px-3 py-2"
      style={{
        clipPath:
          "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
      }}
    >
      <div className="flex items-center gap-2 font-display text-[0.6rem] font-bold tracking-[0.25em] text-neon">
        {m.pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <BrainCircuit className="size-3.5" />
        )}
        THOUGHT&nbsp;PROCESS
      </div>

      {/* Routed agent chips */}
      {!!m.routedAgents?.length && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {m.routedAgents.map((n) => (
            <span
              key={n}
              className="border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-display text-[0.55rem] tracking-wider text-ice"
            >
              {n.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Steps */}
      <ul className="mt-1.5 space-y-1">
        {m.steps?.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-1.5 text-xs text-ice/75"
          >
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-neon-dim" />
            {s}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** Right column — Chat panel, now wired to the Orchestrator (Phase 3). */
export default function ChatPanel() {
  const messages = useAppStore((s) => s.messages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    try {
      await processCommand(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassPanel
      title="Chat"
      actions={
        <>
          <Search className="size-3.5" />
          <CircleHelp className="size-3.5" />
          <Settings2 className="size-3.5" />
        </>
      }
      className="h-[46%] shrink-0"
      bodyClassName="flex flex-col gap-2 p-3"
    >
      {/* Message stream */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {m.kind === "thought" ? (
                <ThoughtBlock m={m} />
              ) : (
                <div
                  className={cn(
                    "max-w-[92%] border px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-auto border-neon/35 bg-neon/10 text-ice"
                      : "border-neon/15 bg-abyss/70 text-ice/85",
                    // Urdu/Arabic → RTL layout + Nastaliq font
                    isRtlText(m.text) && "rtl-text",
                  )}
                  style={{
                    clipPath:
                      "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  }}
                >
                  {m.role === "assistant" ? (
                    <Markdown>{m.text}</Markdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                  <p className="mt-0.5 text-right text-[0.6rem] tracking-widest text-neon-dim">
                    {m.time}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex shrink-0 items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder={busy ? "Cinem AI Assistant is thinking…" : "Command Cinem AI Assistant…"}
          disabled={busy}
          className="min-w-0 flex-1 border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice placeholder:text-neon-dim/60 outline-none transition-colors focus:border-neon/50 disabled:opacity-60"
        />
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="glass flex size-9 shrink-0 items-center justify-center text-neon transition-transform hover:scale-105 disabled:opacity-50"
          aria-label="Send"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
        </button>
      </div>
    </GlassPanel>
  );
}
