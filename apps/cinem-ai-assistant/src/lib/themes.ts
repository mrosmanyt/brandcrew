/**
 * Cinem AI Assistant Theme Engine v2 — 10 premium skins, each a full UI PERSONALITY.
 *
 * A theme is more than colors: it also drives
 *   • shape     — panel geometry (HUD corner-cuts ⇄ rounded luxury ⇄ sharp terminal)
 *   • backdrop  — body background (holo grid / scanlines / aurora / horizon / clean)
 *   • glow      — global glow intensity multiplier (0 = flat, 1 = full neon)
 *   • font      — display-font feel (tech / elegant / mono)
 *
 * applyTheme() overrides the Tailwind v4 design tokens (--color-neon, …) plus
 * --glow ("r, g, b") and --glow-strength on <html>, and sets data-shape /
 * data-backdrop attributes that index.css styles against. Every panel, border,
 * text, shadow — and via the "cinem-ai-assistant:theme" event the Three.js orb, neural
 * wires, radar and waveform — re-skin instantly. Adding a theme = one object.
 */

export type PanelShape = "hud" | "rounded" | "sharp";
export type Backdrop = "grid" | "scanlines" | "aurora" | "horizon" | "clean";
export type FontFeel = "tech" | "elegant" | "mono";

export interface ThemeUI {
  shape: PanelShape;
  backdrop: Backdrop;
  /** Global glow multiplier — 1 = full neon, 0.2 = whisper, 1.2 = extra hot. */
  glow: number;
  font: FontFeel;
}

export interface Theme {
  id: string;
  name: string;
  mood: string;
  colors: {
    void: string;   // app background
    abyss: string;  // deep panel base
    panel: string;  // glass tint
    neon: string;   // primary accent
    neonDim: string;
    ice: string;    // bright text
  };
  ui: ThemeUI;
}

export const THEMES: Theme[] = [
  {
    id: "cyberpunk", name: "Cyberpunk Neon", mood: "The original electric-cyan JARVIS command center",
    colors: { void: "#04070a", abyss: "#070d12", panel: "#0a141a", neon: "#59f0ea", neonDim: "#2ea8a3", ice: "#c9f6f4" },
    ui: { shape: "hud", backdrop: "grid", glow: 1, font: "tech" },
  },
  {
    id: "neon-tokyo", name: "Neon Tokyo", mood: "Hot pink on midnight violet — Shibuya rain",
    colors: { void: "#0a0512", abyss: "#120822", panel: "#1a0c2e", neon: "#ff6ec7", neonDim: "#b04a8f", ice: "#ffe1f2" },
    ui: { shape: "hud", backdrop: "scanlines", glow: 1.15, font: "tech" },
  },
  {
    id: "royal-gold", name: "Royal Gold", mood: "Molten gold on jet black — private-jet luxury",
    colors: { void: "#0a0602", abyss: "#140d04", panel: "#1d1306", neon: "#fbbf24", neonDim: "#b8860b", ice: "#fff3d6" },
    ui: { shape: "rounded", backdrop: "clean", glow: 0.55, font: "elegant" },
  },
  {
    id: "obsidian", name: "Obsidian Executive", mood: "Graphite & silver-blue — stealth CEO minimalism",
    colors: { void: "#030405", abyss: "#0a0c10", panel: "#11141a", neon: "#9fb4cc", neonDim: "#5a6b80", ice: "#e6edf5" },
    ui: { shape: "rounded", backdrop: "clean", glow: 0.25, font: "elegant" },
  },
  {
    id: "matrix", name: "Matrix Terminal", mood: "Terminal green — follow the white rabbit",
    colors: { void: "#020603", abyss: "#04100a", panel: "#061a0d", neon: "#22c55e", neonDim: "#15803d", ice: "#d1fae5" },
    ui: { shape: "sharp", backdrop: "scanlines", glow: 0.8, font: "mono" },
  },
  {
    id: "crimson", name: "Crimson Ops", mood: "Red-alert war room — maximum menace",
    colors: { void: "#0a0303", abyss: "#140606", panel: "#1d0a0a", neon: "#f87171", neonDim: "#b03a3a", ice: "#ffe4e4" },
    ui: { shape: "hud", backdrop: "grid", glow: 1.2, font: "tech" },
  },
  {
    id: "arctic", name: "Arctic Glass", mood: "Glacier ice & aurora — calm, crystalline, airy",
    colors: { void: "#060a10", abyss: "#0b1420", panel: "#101c2a", neon: "#7dd3fc", neonDim: "#4a91b8", ice: "#f0faff" },
    ui: { shape: "rounded", backdrop: "aurora", glow: 0.6, font: "elegant" },
  },
  {
    id: "synthwave", name: "Synthwave Violet", mood: "Violet horizon — retro-future royalty",
    colors: { void: "#070310", abyss: "#0e0618", panel: "#160a24", neon: "#c084fc", neonDim: "#7e4bbd", ice: "#f3e8ff" },
    ui: { shape: "hud", backdrop: "horizon", glow: 1, font: "tech" },
  },
  {
    id: "emerald", name: "Emerald Stealth", mood: "Black-ops emerald — predator night vision",
    colors: { void: "#02080a", abyss: "#051209", panel: "#081a10", neon: "#34d399", neonDim: "#1f8a66", ice: "#d9fbe9" },
    ui: { shape: "hud", backdrop: "grid", glow: 0.7, font: "tech" },
  },
  {
    id: "ghost", name: "Ghost Minimal", mood: "Pure monochrome — whisper-quiet, zero noise",
    colors: { void: "#08090b", abyss: "#0f1114", panel: "#15181c", neon: "#e5e7eb", neonDim: "#9ca3af", ice: "#ffffff" },
    ui: { shape: "rounded", backdrop: "clean", glow: 0.15, font: "elegant" },
  },
];

export const themeById = (id: string): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];

/** Fired on <window> whenever a theme is applied — canvas/Three.js listen. */
export const THEME_EVENT = "cinem-ai-assistant:theme";

const hexToTriplet = (hex: string): string => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ");
};

/* Display-font stacks per feel (all already loaded / system fonts). */
const FONT_STACKS: Record<FontFeel, string> = {
  tech: '"Orbitron", ui-sans-serif, sans-serif',
  elegant: '"Rajdhani", "Segoe UI", ui-sans-serif, sans-serif',
  mono: '"Cascadia Code", "JetBrains Mono", Consolas, ui-monospace, monospace',
};

/* Live snapshot cache so canvas render-loops never touch getComputedStyle. */
let live: Theme = THEMES[0];

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Applies a theme to the whole app.
 * @param animate true → 0.55s crossfade on every color/shadow (theme switch);
 *                false → instant (boot).
 */
export function applyTheme(theme: Theme, animate = false): void {
  const html = document.documentElement;

  if (animate) {
    html.classList.add("theme-fade");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => html.classList.remove("theme-fade"), 650);
  }

  const r = html.style;
  r.setProperty("--color-void", theme.colors.void);
  r.setProperty("--color-abyss", theme.colors.abyss);
  r.setProperty("--color-panel", theme.colors.panel);
  r.setProperty("--color-neon", theme.colors.neon);
  r.setProperty("--color-neon-dim", theme.colors.neonDim);
  r.setProperty("--color-ice", theme.colors.ice);
  r.setProperty("--glow", hexToTriplet(theme.colors.neon));
  r.setProperty("--glow-strength", String(theme.ui.glow));
  r.setProperty("--font-display", FONT_STACKS[theme.ui.font]);

  html.dataset.shape = theme.ui.shape;
  html.dataset.backdrop = theme.ui.backdrop;

  live = theme;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

/* ── Runtime readers for canvas / Three.js / SVG (LIVE theme, cached) ── */

export function neonHex(): string {
  return live.colors.neon;
}

export function neonDimHex(): string {
  return live.colors.neonDim;
}

export function iceHex(): string {
  return live.colors.ice;
}

/** "r, g, b" triplet for canvas rgba() strings. */
export function glowRGB(): string {
  return hexToTriplet(live.colors.neon);
}

/** Glow intensity multiplier of the live theme (0..1.2). */
export function glowStrength(): number {
  return live.ui.glow;
}
