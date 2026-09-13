/**
 * Official CINEM mark: two mirrored hex-brackets with a vertical diamond void.
 * Geometry is a flat-top hexagon split down the middle (viewBox 0 0 64 64).
 * Each bracket is translated 2 viewBox units outward (4 units extra gap)
 * so the pair reads as `< >` at 16–32px without a wide split.
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

/** Extra outward shift per bracket, in viewBox units. */
export const CINEM_MARK_BRACKET_GAP = 2;

/** Left then right closed polygons (SVG path `d`). */
export const CINEM_MARK_PATHS = [
  "M2 32 L16 8 H28 L18 32 L28 56 H16 Z",
  "M62 32 L48 8 H36 L46 32 L36 56 H46 Z",
] as const;

export const CINEM_MARK_POLYGONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [2, 32],
    [16, 8],
    [28, 8],
    [18, 32],
    [28, 56],
    [16, 56],
  ],
  [
    [62, 32],
    [48, 8],
    [36, 8],
    [46, 32],
    [36, 56],
    [48, 56],
  ],
];

export const CINEM_INK = "#111111";
export const CINEM_PAPER = "#f4f3ef";
export const CINEM_NIGHT = "#1a1915";
