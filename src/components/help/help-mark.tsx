import {
  CINEM_MARK_PATHS,
  CINEM_NIGHT,
  CINEM_PAPER,
} from "@/lib/cinem-mark";
import { cn } from "@/lib/utils";

/**
 * CINEM Help FAB glyph: night disc + cream brackets, same mark as the
 * official night-tile favicon so it reads on light marketing and the dark desk.
 */
export function CinemHelpMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 56 56"
      className={cn("size-full", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-cinem-help-mark=""
    >
      <circle cx="28" cy="28" r="28" fill={CINEM_NIGHT} />
      <circle
        cx="28"
        cy="28"
        r="26.2"
        fill="none"
        stroke={CINEM_PAPER}
        strokeWidth="1.35"
        opacity="0.38"
      />
      <g transform="translate(6.72 6.72) scale(0.76)">
        {CINEM_MARK_PATHS.map((d) => (
          <path key={d} d={d} fill={CINEM_PAPER} />
        ))}
      </g>
    </svg>
  );
}
