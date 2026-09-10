/** Write dark-theme Marketplace bot cover SVGs into public/bots. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public/bots");
mkdirSync(ROOT, { recursive: true });

function svg(id, accent, scene) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" role="img" aria-label="${id} cover">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1016"/>
      <stop offset="55%" stop-color="#121820"/>
      <stop offset="100%" stop-color="#0e1412"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="72%" cy="18%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c2430"/>
      <stop offset="100%" stop-color="#141a22"/>
    </linearGradient>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="480" height="360" fill="url(#${id}-bg)"/>
  <rect width="480" height="360" fill="url(#${id}-glow)"/>
  <g opacity="0.18" stroke="${accent}" stroke-width="1" fill="none">
    <path d="M-20 280 C80 220 160 320 260 250 S420 180 520 230"/>
    <path d="M-20 310 C90 250 190 340 300 270 S430 210 520 260"/>
  </g>
  <circle cx="56" cy="48" r="70" fill="${accent}" opacity="0.08"/>
  <g filter="url(#${id}-soft)">${scene}</g>
</svg>
`;
}

const scenes = {
  main: {
    accent: "#c45c26",
    scene: `
    <rect x="86" y="78" width="308" height="204" rx="18" fill="url(#main-panel)" stroke="#2a3442"/>
    <rect x="86" y="78" width="308" height="36" rx="18" fill="#171e28"/>
    <rect x="86" y="96" width="308" height="18" fill="#171e28"/>
    <circle cx="108" cy="96" r="5" fill="#c45c26"/>
    <circle cx="124" cy="96" r="5" fill="#3f6b58"/>
    <circle cx="140" cy="96" r="5" fill="#57534e"/>
    <rect x="108" y="132" width="92" height="118" rx="10" fill="#10161d" stroke="#c45c2644"/>
    <rect x="216" y="132" width="154" height="54" rx="10" fill="#10161d"/>
    <rect x="228" y="146" width="88" height="8" rx="4" fill="#c45c26" opacity="0.85"/>
    <rect x="228" y="162" width="118" height="6" rx="3" fill="#3a4656"/>
    <rect x="216" y="196" width="72" height="54" rx="10" fill="#10161d"/>
    <rect x="298" y="196" width="72" height="54" rx="10" fill="#10161d"/>
    <rect x="228" y="214" width="48" height="6" rx="3" fill="#3f6b58"/>
    <rect x="310" y="214" width="48" height="6" rx="3" fill="#c45c26" opacity="0.7"/>
    `,
  },
  research: {
    accent: "#3f6b58",
    scene: `
    <rect x="70" y="86" width="168" height="196" rx="14" fill="url(#research-panel)" stroke="#2a3442"/>
    <rect x="88" y="108" width="132" height="10" rx="5" fill="#3f6b58"/>
    <rect x="88" y="130" width="118" height="6" rx="3" fill="#3a4656"/>
    <rect x="88" y="146" width="132" height="6" rx="3" fill="#3a4656"/>
    <rect x="88" y="162" width="96" height="6" rx="3" fill="#3a4656"/>
    <rect x="88" y="190" width="132" height="54" rx="8" fill="#10161d"/>
    <path d="M292 128 a52 52 0 1 1 36 88" fill="none" stroke="#3f6b58" stroke-width="14" stroke-linecap="round"/>
    <circle cx="292" cy="128" r="44" fill="#10161d" stroke="#4d7d68" stroke-width="8"/>
    <line x1="328" y1="172" x2="372" y2="226" stroke="#9ec9b4" stroke-width="12" stroke-linecap="round"/>
    `,
  },
  sales: {
    accent: "#9f1239",
    scene: `
    <path d="M96 250 L168 150 L236 198 L318 108 L384 108" fill="none" stroke="#9f1239" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="96" cy="250" r="10" fill="#9f1239"/>
    <circle cx="168" cy="150" r="10" fill="#e11d48"/>
    <circle cx="236" cy="198" r="10" fill="#9f1239"/>
    <circle cx="318" cy="108" r="10" fill="#fb7185"/>
    <rect x="86" y="268" width="308" height="18" rx="9" fill="#1a1016"/>
    <rect x="86" y="268" width="210" height="18" rx="9" fill="#9f1239" opacity="0.85"/>
    <rect x="300" y="86" width="86" height="54" rx="12" fill="url(#sales-panel)" stroke="#2a3442"/>
    <rect x="314" y="102" width="58" height="8" rx="4" fill="#fb7185"/>
    <rect x="314" y="116" width="40" height="6" rx="3" fill="#3a4656"/>
    `,
  },
  marketing: {
    accent: "#6d28d9",
    scene: `
    <path d="M118 118 L214 156 L214 220 L118 258 Z" fill="#1a1428" stroke="#6d28d9" stroke-width="6"/>
    <path d="M214 156 L302 118 L302 258 L214 220 Z" fill="#221834" stroke="#8b5cf6" stroke-width="4"/>
    <circle cx="338" cy="128" r="22" fill="#6d28d9" opacity="0.9"/>
    <circle cx="372" cy="176" r="12" fill="#a78bfa"/>
    <circle cx="348" cy="214" r="8" fill="#c4b5fd"/>
    <rect x="118" y="278" width="70" height="10" rx="5" fill="#6d28d9" opacity="0.7"/>
    <rect x="198" y="278" width="48" height="10" rx="5" fill="#3a4656"/>
    <rect x="254" y="278" width="90" height="10" rx="5" fill="#3a4656"/>
    `,
  },
  whatsapp: {
    accent: "#25d366",
    scene: `
    <rect x="92" y="92" width="210" height="132" rx="22" fill="url(#whatsapp-panel)" stroke="#1f3d32"/>
    <rect x="112" y="114" width="132" height="12" rx="6" fill="#25d366"/>
    <rect x="112" y="138" width="170" height="10" rx="5" fill="#2a3d36"/>
    <rect x="112" y="158" width="148" height="10" rx="5" fill="#2a3d36"/>
    <path d="M140 224 L168 204 L210 204" fill="#25d366"/>
    <rect x="248" y="196" width="168" height="92" rx="22" fill="#102018" stroke="#25d36666"/>
    <rect x="268" y="218" width="128" height="10" rx="5" fill="#86efac"/>
    <rect x="268" y="238" width="96" height="10" rx="5" fill="#2a3d36"/>
    <circle cx="372" cy="112" r="28" fill="#25d366"/>
    <path d="M362 112 h20 m-10 -10 v20" stroke="#052e16" stroke-width="4" stroke-linecap="round"/>
    `,
  },
  content: {
    accent: "#be185d",
    scene: `
    <rect x="108" y="72" width="264" height="216" rx="16" fill="url(#content-panel)" stroke="#2a3442"/>
    <rect x="128" y="96" width="168" height="14" rx="7" fill="#be185d"/>
    <rect x="128" y="124" width="224" height="8" rx="4" fill="#3a4656"/>
    <rect x="128" y="144" width="210" height="8" rx="4" fill="#3a4656"/>
    <rect x="128" y="164" width="188" height="8" rx="4" fill="#3a4656"/>
    <rect x="128" y="196" width="96" height="64" rx="10" fill="#10161d"/>
    <rect x="236" y="196" width="96" height="64" rx="10" fill="#10161d"/>
    <rect x="140" y="214" width="72" height="8" rx="4" fill="#f472b6" opacity="0.8"/>
    <rect x="248" y="214" width="72" height="8" rx="4" fill="#be185d" opacity="0.7"/>
    `,
  },
  website: {
    accent: "#0ea5e9",
    scene: `
    <rect x="78" y="70" width="324" height="220" rx="16" fill="url(#website-panel)" stroke="#2a3442"/>
    <rect x="78" y="70" width="324" height="34" fill="#0f1720"/>
    <circle cx="98" cy="87" r="5" fill="#0ea5e9"/>
    <circle cx="114" cy="87" r="5" fill="#38bdf8"/>
    <circle cx="130" cy="87" r="5" fill="#64748b"/>
    <rect x="154" y="80" width="220" height="14" rx="7" fill="#1e293b"/>
    <rect x="96" y="122" width="120" height="148" rx="10" fill="#0b1220"/>
    <rect x="232" y="122" width="150" height="64" rx="10" fill="#0b1220"/>
    <rect x="232" y="198" width="72" height="72" rx="10" fill="#0b1220"/>
    <rect x="310" y="198" width="72" height="72" rx="10" fill="#0b1220"/>
    <rect x="108" y="140" width="96" height="8" rx="4" fill="#0ea5e9"/>
    <rect x="108" y="158" width="80" height="6" rx="3" fill="#334155"/>
    <rect x="248" y="142" width="118" height="8" rx="4" fill="#38bdf8" opacity="0.8"/>
    `,
  },
  app: {
    accent: "#7c3aed",
    scene: `
    <rect x="168" y="48" width="144" height="264" rx="28" fill="#140c24" stroke="#7c3aed" stroke-width="6"/>
    <rect x="180" y="78" width="120" height="196" rx="8" fill="#1c1233"/>
    <rect x="192" y="96" width="44" height="44" rx="12" fill="#7c3aed"/>
    <rect x="244" y="96" width="44" height="44" rx="12" fill="#5b21b6"/>
    <rect x="192" y="148" width="44" height="44" rx="12" fill="#5b21b6"/>
    <rect x="244" y="148" width="44" height="44" rx="12" fill="#a78bfa"/>
    <rect x="192" y="200" width="96" height="20" rx="10" fill="#7c3aed" opacity="0.7"/>
    <circle cx="240" cy="286" r="10" fill="#2e1065" stroke="#a78bfa"/>
    `,
  },
  manager: {
    accent: "#38bdf8",
    scene: `
    <rect x="72" y="92" width="110" height="176" rx="14" fill="#10222c" stroke="#1f3d4c"/>
    <rect x="198" y="92" width="110" height="176" rx="14" fill="#10222c" stroke="#1f3d4c"/>
    <rect x="324" y="92" width="84" height="176" rx="14" fill="#10222c" stroke="#1f3d4c"/>
    <rect x="86" y="108" width="82" height="10" rx="5" fill="#38bdf8"/>
    <rect x="212" y="108" width="82" height="10" rx="5" fill="#7dd3fc"/>
    <rect x="338" y="108" width="56" height="10" rx="5" fill="#64748b"/>
    <rect x="86" y="132" width="82" height="36" rx="8" fill="#0b1720"/>
    <rect x="86" y="176" width="82" height="36" rx="8" fill="#0b1720"/>
    <rect x="212" y="132" width="82" height="52" rx="8" fill="#0b1720"/>
    <rect x="212" y="194" width="82" height="36" rx="8" fill="#0b1720"/>
    <rect x="338" y="132" width="56" height="36" rx="8" fill="#0b1720"/>
    <rect x="98" y="144" width="58" height="6" rx="3" fill="#38bdf8" opacity="0.8"/>
    <rect x="224" y="148" width="58" height="6" rx="3" fill="#7dd3fc" opacity="0.8"/>
    `,
  },
};

for (const [name, row] of Object.entries(scenes)) {
  writeFileSync(join(ROOT, `${name}.svg`), svg(name, row.accent, row.scene));
  console.log("wrote", name);
}
