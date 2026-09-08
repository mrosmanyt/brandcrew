import {
  CINEM_MARK_PATHS,
  CINEM_MARK_VIEWBOX,
} from "@/lib/cinem-mark";
import { cn } from "@/lib/utils";

export function CinemMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={CINEM_MARK_VIEWBOX}
      className={cn("size-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {CINEM_MARK_PATHS.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

export function BrandMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CinemMark
        className={
          inverted ? "text-sidebar-foreground" : "text-foreground"
        }
      />
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
