import type { ReactNode } from "react";
import { motion } from "framer-motion";

/** Shared full-screen frame for all license gate screens (branded backdrop). */
export default function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden p-6">
      {/* Ambient orb glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon/10 blur-[120px]" />

      {/* Brand mark */}
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 text-center">
        <h1 className="neon-text font-display text-2xl font-black tracking-[0.5em]">Cinem AI Assistant</h1>
        <p className="mt-1 font-display text-[0.55rem] tracking-[0.4em] text-neon-dim">
          PERSONAL INTELLIGENT CYBER ASSISTANT
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass z-10 w-[440px] max-w-[92vw] p-8"
      >
        {children}
      </motion.div>
    </div>
  );
}
