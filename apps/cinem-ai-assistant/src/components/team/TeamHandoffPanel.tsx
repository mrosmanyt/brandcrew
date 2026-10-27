import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Loader2, Search, PenLine, Share2, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { chatLLM } from "@/lib/llm";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";

const TEAM = [
  { id: "research", name: "Research", icon: Search, agentId: "world" },
  { id: "editor", name: "Editor", icon: PenLine, agentId: "editor" },
  { id: "poster", name: "Poster", icon: Share2, agentId: "social" },
] as const;

export default function TeamHandoffPanel() {
  const open = useAppStore((s) => s.teamHandoffOpen);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState("");

  if (!open) return null;

  const runHandoff = async () => {
    if (!brief.trim()) return;
    const settings = useSettingsStore.getState();
    if (!settings.geminiKey.trim()) {
      notify("error", "Gemini key required for team handoff.");
      return;
    }
    setBusy(true);
    try {
      const text = await chatLLM(
        `Desk handoff brief from the user:\n${brief}\n\nSplit work across Research (ATLAS), Editor (NOVA), and Poster (MAYA). Output markdown sections: ## Research, ## Editor, ## Poster with concrete next steps.`,
        settings,
        { system: "You coordinate a creator desk team. Be specific and actionable.", maxTokens: 800 },
      );
      setHandoff(text.trim());
      for (const t of TEAM) {
        useAppStore.getState().setAgentStatus(t.agentId, "processing");
      }
      useAppStore.getState().addMessage({ role: "assistant", text: `**Team handoff**\n\n${text}` });
      setTimeout(() => {
        for (const t of TEAM) useAppStore.getState().setAgentStatus(t.agentId, "active");
      }, 3000);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Handoff failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="glass fixed bottom-28 left-1/2 z-50 w-[min(520px,92vw)] -translate-x-1/2 p-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
            <ArrowRightLeft className="size-3.5" /> TEAM HANDOFF
          </span>
          <button type="button" onClick={() => useAppStore.setState({ teamHandoffOpen: false })}>
            <X className="size-4 text-neon-dim" />
          </button>
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="What should Research, Editor, and Poster tackle?"
          className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none"
        />
        <button
          type="button"
          onClick={() => void runHandoff()}
          disabled={busy}
          className="mt-2 flex w-full items-center justify-center gap-2 border border-neon/40 py-2 text-xs tracking-widest text-neon disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          RUN HANDOFF
        </button>
        {handoff ? (
          <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[0.7rem] text-ice/90">{handoff}</pre>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

export function openTeamHandoff() {
  useAppStore.setState({ teamHandoffOpen: true });
}
