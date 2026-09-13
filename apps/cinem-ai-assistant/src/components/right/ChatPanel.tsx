import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2, SendHorizonal, BrainCircuit, Loader2, ChevronRight, Mic, Square,
} from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import { useAppStore, type ChatMessage } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { processCommand } from "@/lib/orchestrator";
import { toggleVoiceCommand } from "@/lib/voice-command";
import { isRtlText } from "@/lib/language";
import { cn } from "@/lib/utils";
import Markdown from "@/components/Markdown";

function ThoughtBlock({ m }: { m: ChatMessage }) {
  return (
    <div className="mx-2 rounded-2xl border border-neon/20 bg-neon/[0.04] px-3 py-2">
      <div className="flex items-center gap-2 font-display text-[0.6rem] font-bold tracking-[0.25em] text-neon">
        {m.pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <BrainCircuit className="size-3.5" />
        )}
        THINKING
      </div>
      {!!m.routedAgents?.length && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {m.routedAgents.map((n) => (
            <span
              key={n}
              className="rounded-full border border-neon/30 bg-neon/10 px-2 py-0.5 font-display text-[0.55rem] tracking-wider text-ice"
            >
              {n}
            </span>
          ))}
        </div>
      )}
      <ul className="mt-1.5 space-y-1">
        {m.steps?.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-1.5 text-xs text-ice/70"
          >
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-neon-dim" />
            {s}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const user = m.role === "user";
  const system = m.role === "system";
  if (system) {
    return (
      <p className="px-3 text-center text-[0.68rem] tracking-wide text-neon-dim/80">{m.text}</p>
    );
  }
  return (
    <div className={cn("flex", user ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_0_16px_rgba(var(--glow),0.06)]",
          user
            ? "rounded-br-md bg-neon/15 text-ice"
            : "rounded-bl-md border border-neon/15 bg-abyss/80 text-ice/90",
          isRtlText(m.text) && "rtl-text",
        )}
      >
        {m.role === "assistant" ? (
          <Markdown>{m.text}</Markdown>
        ) : (
          <p className="whitespace-pre-wrap">{m.text}</p>
        )}
        <p className={cn("mt-1 text-[0.58rem] tracking-widest text-neon-dim/80", user ? "text-right" : "text-left")}>
          {m.time}
        </p>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const messages = useAppStore((s) => s.messages);
  const voiceStatus = useAppStore((s) => s.voiceStatus);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      inputRef.current?.focus();
    }
  };

  const listening = voiceStatus === "listening";
  const transcribing = voiceStatus === "transcribing";
  const micBusy = transcribing;

  return (
    <GlassPanel
      title="Chat"
      actions={
        <button
          type="button"
          onClick={() => useSettingsStore.getState().setOpen(true)}
          className="text-neon-dim transition-colors hover:text-neon"
          title="Settings — voice & model keys"
          aria-label="Open settings"
        >
          <Settings2 className="size-3.5" />
        </button>
      }
      className="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-2 p-2.5"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-0.5 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {m.kind === "thought" ? <ThoughtBlock m={m} /> : <Bubble m={m} />}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div
        className={cn(
          "flex shrink-0 items-end gap-1.5 rounded-2xl border bg-abyss/80 px-2 py-1.5 transition-colors",
          listening ? "border-neon/60 shadow-[0_0_16px_rgba(var(--glow),0.18)]" : "border-neon/20 focus-within:border-neon/45",
        )}
      >
        <button
          type="button"
          onClick={() => void toggleVoiceCommand()}
          disabled={micBusy || busy}
          className={cn(
            "mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border transition-all",
            listening
              ? "border-neon bg-neon/20 text-neon"
              : voiceStatus === "speaking"
                ? "border-amber-300/70 text-amber-200"
                : "border-neon/25 text-neon-dim hover:border-neon/55 hover:text-neon",
            (micBusy || busy) && "opacity-50",
          )}
          aria-label={listening ? "Stop listening" : "Start voice input"}
          title={listening ? "Stop & send voice" : "Speak to Cinem AI Assistant"}
        >
          {micBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : listening || voiceStatus === "speaking" ? (
            <Square className="size-3.5" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={
            busy
              ? "Cinem AI Assistant is thinking…"
              : listening
                ? "Listening… tap the mic to send"
                : "Message Cinem AI Assistant"
          }
          disabled={busy}
          className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm text-ice placeholder:text-neon-dim/55 outline-none disabled:opacity-60"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !draft.trim()}
          className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-neon/15 text-neon transition-transform hover:scale-105 disabled:opacity-40"
          aria-label="Send"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
        </button>
      </div>
    </GlassPanel>
  );
}
