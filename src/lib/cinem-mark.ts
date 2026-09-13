/**
 * Official CINEM mark: two mirrored hex-brackets with a vertical diamond void.
 * Geometry is a flat-top hexagon split down the middle (viewBox 0 0 64 64).
 * Raster: `public/brand/cinem-logo.png` (black mark, transparent ground).
 */
export const CINEM_LOGO_SRC = "/brand/cinem-logo.png";
export const CINEM_MARK_SRC = "/brand/cinem-mark.svg";
export const CINEM_OG_SRC = "/og.png";
/** SaaS tab tile: night ground + cream mark. Source of truth is public/icon.svg. */
export const CINEM_APP_ICON_SRC = "/icon.svg";
export const CINEM_FAVICON_ICO_SRC = "/favicon.ico";
export const CINEM_FAVICON_PNG_SRC = "/icon-32.png";
export const CINEM_APPLE_TOUCH_SRC = "/apple-touch-icon.png";
/** Bump when raster/SVG favicons change so browsers drop a cached white/`<>` tile. */
export const CINEM_FAVICON_VERSION = "20260913";
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
