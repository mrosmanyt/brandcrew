import Image from "next/image";
import {
  CINEM_LOGO_SRC,
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

export function CinemLogoImage({
  className,
  alt = "",
  priority = false,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={CINEM_LOGO_SRC}
      alt={alt}
      width={96}
      height={96}
      className={cn("cinem-logo size-8 shrink-0 dark:invert", className)}
      priority={priority}
      unoptimized
    />
  );
}

export function BrandMark({
  className,
  inverted = false,
  priority = false,
}: {
  className?: string;
  inverted?: boolean;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CinemLogoImage priority={priority} />
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
