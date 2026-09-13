import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AGENTS } from "@/data/agents";
import { speakQueued } from "@/lib/announcer";
import { welcomeLine, normalizeWelcomeLang } from "@/lib/character-voices";
import { LANGS, DEFAULT_LANG } from "@/lib/language";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAppStore } from "@/store/useAppStore";
import { sfx } from "@/lib/sfx";

const BOOT_KEY = "cinem-ai-assistant-booted"; // once per app session

/**
 * Cinem AI Assistant boot sequence — short register sweep, then a sweet
 * welcome in the user's language (English default).
 */
export default function BootSequence() {
  const [show, setShow] = useState(() => !sessionStorage.getItem(BOOT_KEY));
  const [registered, setRegistered] = useState(0);

  useEffect(() => {
    if (!show) return;
    sessionStorage.setItem(BOOT_KEY, "1");

    // register agents one by one (ticks)
    const perAgent = 130;
    const timers: ReturnType<typeof setTimeout>[] = [];
    AGENTS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          sfx.tick();
          setRegistered(i + 1);
        }, 350 + i * perAgent),
      );
    });

    // finish: voice line + fade out
    timers.push(
      setTimeout(() => {
        const settings = useSettingsStore.getState();
        const preferred = normalizeWelcomeLang(settings.preferredLanguage);
        const lang = LANGS[preferred] ?? DEFAULT_LANG;
        if (settings.preferredLanguage !== "auto") {
          useAppStore.getState().setLanguage(lang);
        }
        void speakQueued(welcomeLine(lang.code), { lang: lang.bcp47 });
        setShow(false);
      }, 350 + AGENTS.length * perAgent + 600),
    );

    return () => timers.forEach(clearTimeout);
  }, [show]);

  const progress = Math.round((registered / AGENTS.length) * 100);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#04090c]"
        >
          {/* ambient glow + sweeping scanline */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon/10 blur-[140px]" />
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-px bg-neon/60 shadow-[0_0_18px_rgba(var(--glow),0.9)]"
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          />

          <motion.h1
            initial={{ opacity: 0, letterSpacing: "1.2em" }}
            animate={{ opacity: 1, letterSpacing: "0.5em" }}
            transition={{ duration: 0.9 }}
            className="neon-text font-display text-4xl font-black tracking-[0.5em] text-ice"
          >
            Cinem AI Assistant
          </motion.h1>
          <p className="mt-2 font-display text-[0.6rem] tracking-[0.45em] text-neon-dim">
            PERSONAL INTELLIGENT CYBER ASSISTANT
          </p>

          {/* agent registration grid */}
          <div className="mt-8 grid grid-cols-5 gap-1.5">
            {AGENTS.map((a, i) => (
              <div
                key={a.id}
                className={
                  "border px-2 py-1 text-center font-display text-[0.5rem] tracking-[0.15em] transition-all duration-200 " +
                  (i < registered
                    ? "border-neon/60 bg-neon/10 text-neon shadow-[0_0_10px_rgba(var(--glow),0.3)]"
                    : "border-neon/10 text-neon-dim/40")
                }
              >
                {a.codename}
              </div>
            ))}
          </div>

          {/* progress */}
          <div className="mt-6 h-0.5 w-72 overflow-hidden bg-neon/15">
            <motion.div
              className="h-full bg-neon shadow-[0_0_10px_rgba(var(--glow),0.8)]"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.15 }}
            />
          </div>
          <p className="mt-2 font-display text-[0.55rem] tracking-[0.3em] text-neon-dim">
            {progress < 100
              ? `REGISTERING AGENTS… ${registered}/${AGENTS.length}`
              : "READY WHEN YOU ARE"}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
