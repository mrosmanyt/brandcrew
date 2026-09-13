import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  title?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Reusable glassmorphism panel with sci-fi corner cuts (matches reference UI). */
export default function GlassPanel({
  title,
  actions,
  className,
  bodyClassName,
  children,
}: GlassPanelProps) {
  return (
    <section className={cn("glass flex min-h-0 flex-col", className)}>
      {title && (
        <header className="flex shrink-0 items-center justify-between border-b border-neon/10 px-4 py-2.5">
          <h2 className="panel-title">{title}</h2>
          {actions && <div className="flex items-center gap-2 text-neon-dim">{actions}</div>}
        </header>
      )}
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
