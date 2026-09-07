"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { resolveDeskTheme } from "@/lib/desk-theme";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "light" as const, label: "Light" },
  { id: "dark" as const, label: "Dark" },
];

export function DeskThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = resolveDeskTheme(
    mounted ? theme : "dark",
    mounted ? resolvedTheme !== "light" : true,
  );

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cn(
        "inline-flex rounded-full border border-border bg-muted/80 p-0.5 text-xs",
        className,
      )}
    >
      {MODES.map((mode) => {
        const active = current === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(mode.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-muted-foreground transition-colors",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
