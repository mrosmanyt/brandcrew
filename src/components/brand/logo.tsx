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
          "grid size-7 place-items-center rounded-md text-[0.7rem] font-semibold tracking-tight",
          inverted ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        Bc
      </span>
      <span
        className={cn(
          "font-heading text-lg tracking-tight",
          inverted ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        Brandcrew
      </span>
    </span>
  );
}
