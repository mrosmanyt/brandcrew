/** Shared Cinem AI Assistant ADMIN UI primitives (themed glass components). */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { UserStatus, LicenseStatus } from "@/lib/types";

export function Panel({ title, actions, className, children }: {
  title?: string; actions?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={cn("glass flex min-h-0 flex-col", className)}>
      {title && (
        <header className="flex shrink-0 items-center justify-between border-b border-neon/10 px-4 py-2.5">
          <h2 className="panel-title">{title}</h2>
          {actions}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </section>
  );
}

const STATUS_STYLES: Record<UserStatus | LicenseStatus, string> = {
  active: "border-neon/50 bg-neon/10 text-neon",
  frozen: "border-sky-400/50 bg-sky-400/10 text-sky-300",
  expired: "border-amber-400/50 bg-amber-400/10 text-amber-300",
  blacklisted: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  unused: "border-slate-400/40 bg-slate-400/10 text-slate-300",
  revoked: "border-rose-500/50 bg-rose-500/10 text-rose-300",
};

/** Status pill shared by users + licenses. */
export function StatusBadge({ status }: { status: UserStatus | LicenseStatus }) {
  return (
    <span className={cn(
      "inline-block border px-2 py-0.5 font-display text-[0.55rem] font-bold tracking-[0.15em] uppercase",
      STATUS_STYLES[status],
    )}>
      {status}
    </span>
  );
}

export function Button({ children, variant = "ghost", className, ...props }: {
  variant?: "ghost" | "primary" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors disabled:opacity-40",
        variant === "primary" && "border-neon/50 bg-neon/15 text-neon hover:bg-neon/25",
        variant === "danger" && "border-rose-400/40 text-rose-300 hover:bg-rose-500/10",
        variant === "ghost" && "border-neon/20 text-ice/80 hover:border-neon/40 hover:text-neon",
        className,
      )}
    >
      {children}
    </button>
  );
}
