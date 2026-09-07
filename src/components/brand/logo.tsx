import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-6 place-items-center rounded-[6px] text-[0.65rem] font-semibold tracking-tight",
          inverted
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        CP
      </span>
      <span
        className={cn(
          "text-[0.95rem] font-medium tracking-tight whitespace-nowrap",
          inverted ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        CINEM Pro
      </span>
    </span>
  );
}
