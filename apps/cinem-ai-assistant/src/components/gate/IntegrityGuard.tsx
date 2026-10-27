import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { startGuard } from "@/lib/guard";

/**
 * Integrity Guard wrapper — renders the app only while the environment
 * passes the shell handshake (see src/lib/guard.ts). If the bundle is
 * running outside the genuine Cinem AI Assistant core (stolen/copied files), the UI
 * is replaced by a permanent lock screen.
 */
export default function IntegrityGuard({ children }: { children: ReactNode }) {
  const [breached, setBreached] = useState(false);

  useEffect(() => startGuard(() => setBreached(true)), []);

  if (breached) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-void px-6 text-center">
        <div className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/10 [animation-duration:2s]" />
          <span className="absolute inset-1 rounded-full border border-rose-400/40 animate-pulse" />
          <ShieldAlert className="size-9 text-rose-400" />
        </div>

        <h1 className="font-display text-base font-bold tracking-[0.3em] text-ice">
          INTEGRITY CHECK FAILED
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-ice/70">
          This copy of Cinem AI Assistant is not running inside the official application core.
          Cinem AI Assistant&apos;s interface only works with its genuine, signed engine.
        </p>
        <p className="max-w-md text-xs leading-relaxed text-neon-dim">
          If you are a licensed user, please reinstall Cinem AI Assistant from the official
          installer. Unauthorized extraction or reuse of Cinem AI Assistant&apos;s files is a
          violation of the license agreement.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
