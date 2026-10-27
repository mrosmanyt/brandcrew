import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore } from "@/store/useToastStore";
import { cn } from "@/lib/utils";

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

/** Bottom-right toast stack — success / error / info feedback. */
export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[60] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className={cn(
                "glass pointer-events-auto flex items-start gap-2.5 p-3 text-sm",
                t.type === "success" && "text-neon",
                t.type === "error" && "text-rose-300",
                t.type === "info" && "text-ice/90",
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <p className="min-w-0 flex-1 break-words text-ice/90">{t.text}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-neon-dim hover:text-neon"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
