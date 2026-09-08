/**
 * Official CINEM mark: two mirrored hex-brackets with a vertical diamond void.
 * Geometry is a flat-top hexagon split down the middle (viewBox 0 0 64 64).
 */
export const CINEM_MARK_VIEWBOX = "0 0 64 64";

/** Left then right closed polygons (SVG path `d`). */
export const CINEM_MARK_PATHS = [
  "M4 32 L18 8 H30 L20 32 L30 56 H18 Z",
  "M60 32 L46 8 H34 L44 32 L34 56 H46 Z",
] as const;

export const CINEM_MARK_POLYGONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [4, 32],
    [18, 8],
    [30, 8],
    [20, 32],
    [30, 56],
    [18, 56],
  ],
  [
    [60, 32],
    [46, 8],
    [34, 8],
    [44, 32],
    [34, 56],
    [46, 56],
  ],
];

export const CINEM_INK = "#111111";
export const CINEM_PAPER = "#f4f3ef";
export const CINEM_NIGHT = "#1a1915";
