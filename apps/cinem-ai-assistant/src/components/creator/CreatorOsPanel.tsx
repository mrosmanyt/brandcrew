import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Loader2, X } from "lucide-react";
import { CREATOR_OS_TOOLS, runCreatorOsTool, type CreatorOsTool } from "@/lib/creatorOs";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAppStore } from "@/store/useAppStore";
import { notify } from "@/store/useToastStore";

export function useCreatorOsOpen() {
  return useAppStore((s) => s.creatorOsOpen);
}

export function setCreatorOsOpen(open: boolean) {
  useAppStore.setState({ creatorOsOpen: open });
}

export default function CreatorOsPanel() {
  const open = useAppStore((s) => s.creatorOsOpen);
  const settings = useSettingsStore();
  const [topic, setTopic] = useState("");
  const [tool, setTool] = useState<CreatorOsTool>("hook_writer");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");

  if (!open) return null;

  const run = async () => {
    if (!topic.trim()) {
      notify("error", "Describe your video topic first.");
      return;
    }
    if (!settings.geminiKey.trim()) {
      notify("error", "Add your Gemini key first.");
      return;
    }
    setBusy(true);
    try {
      const text = await runCreatorOsTool(tool, topic.trim(), settings);
      setOutput(text);
      useAppStore.getState().addMessage({ role: "assistant", text: `**Creator OS — ${tool}**\n\n${text}` });
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Creator OS failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        className="glass fixed right-4 top-20 z-50 flex max-h-[70vh] w-96 flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-neon/10 px-3 py-2">
          <div className="flex items-center gap-2 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon">
            <Clapperboard className="size-3.5" /> CREATOR OS
          </div>
          <button type="button" onClick={() => setCreatorOsOpen(false)} className="text-neon-dim hover:text-neon">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Video topic or working title…"
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none focus:border-neon/50"
          />
          <div className="grid grid-cols-1 gap-1">
            {CREATOR_OS_TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                className={`border px-2 py-1.5 text-left text-xs transition-colors ${
                  tool === t.id ? "border-neon/50 bg-neon/10 text-neon" : "border-neon/15 text-neon-dim hover:border-neon/30"
                }`}
              >
                <span className="font-display tracking-wider">{t.label}</span>
                <span className="mt-0.5 block text-[0.65rem] opacity-70">{t.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 border border-neon/40 py-2 text-xs font-display tracking-widest text-neon hover:bg-neon/10 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            GENERATE
          </button>
          {output ? (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap border border-neon/10 bg-abyss/60 p-2 text-[0.7rem] text-ice/90">
              {output}
            </pre>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
