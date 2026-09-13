import type { AgentAvatarSpec } from "@/lib/agent-avatar";

/** Autoplay loop length. Must stay in the 15–40s marketing window. */
export const HERO_DEMO_LOOP_MS = 32_000;

/** Frame shown when `prefers-reduced-motion: reduce`. */
export const HERO_DEMO_STATIC_MS = 28_400;

export const HERO_DEMO_PROMPT = "Run LinkedIn week for Northline";

export const HERO_DEMO_AGENT_NAME = "New Agent";
export const HERO_DEMO_AGENT_ROLE = "Writer";

export const HERO_DEMO_PLAN_COPY =
  "I’ll read the Northline Brand Kit, browse the public site, write five LinkedIn posts, then pause for your approval before they go out.";

export const HERO_DEMO_JOB_TITLE = "LinkedIn week";

export const HERO_DEMO_ARTIFACT = {
  title: "5 LinkedIn posts for the week",
  excerpt:
    "The rooms feel specific. The feed should too. Five drafts in Brand Kit voice — still on the desk.",
  posts: [
    "The rooms feel specific. The feed should too.",
    "Brand Kit first. Then the week.",
    "Tools ran. Five posts, ready for you.",
    "Five drafts. You still sign the work.",
    "Approve what leaves.",
  ],
} as const;

export const HERO_DEMO_SITE = {
  name: "Northline",
  kicker: "Preview only · not published",
  offer: "A week of LinkedIn in your voice. You approve before anything leaves.",
} as const;

export const HERO_DEMO_PLAN_STEPS = [
  { id: "kit", label: "Read the Brand Kit" },
  { id: "browse", label: "Open northline.example" },
  { id: "write", label: "Write 5 LinkedIn posts" },
  { id: "ask", label: "Pause for your approval" },
] as const;

export type HeroDemoPhase =
  | "idle"
  | "typing"
  | "sent"
  | "plan"
  | "kit"
  | "browse"
  | "write"
  | "artifacts"
  | "approve"
  | "website"
  | "hold";

const PHASES: { until: number; phase: HeroDemoPhase }[] = [
  { until: 380, phase: "idle" },
  { until: 3_600, phase: "typing" },
  { until: 4_400, phase: "sent" },
  { until: 9_200, phase: "plan" },
  { until: 12_600, phase: "kit" },
  { until: 16_200, phase: "browse" },
  { until: 19_800, phase: "write" },
  { until: 23_400, phase: "artifacts" },
  { until: 26_800, phase: "approve" },
  { until: 30_200, phase: "website" },
  { until: HERO_DEMO_LOOP_MS, phase: "hold" },
];

export function heroDemoElapsed(ms: number): number {
  const loop = HERO_DEMO_LOOP_MS;
  return ((ms % loop) + loop) % loop;
}

export function heroDemoPhaseAt(ms: number): HeroDemoPhase {
  const t = heroDemoElapsed(ms);
  for (const row of PHASES) {
    if (t < row.until) return row.phase;
  }
  return "hold";
}

const PHASE_ORDER: HeroDemoPhase[] = PHASES.map((row) => row.phase);

export function heroDemoPhaseIndex(phase: HeroDemoPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function heroDemoReached(phase: HeroDemoPhase, at: HeroDemoPhase): boolean {
  return heroDemoPhaseIndex(phase) >= heroDemoPhaseIndex(at);
}

export function heroDemoTypedPrompt(ms: number, prompt = HERO_DEMO_PROMPT): string {
  const t = heroDemoElapsed(ms);
  if (t < 380) return "";
  if (t >= 3_600) return prompt;
  const progress = (t - 380) / (3_600 - 380);
  return prompt.slice(0, Math.max(0, Math.round(prompt.length * progress)));
}

export function heroDemoPlanCount(ms: number): number {
  const t = heroDemoElapsed(ms);
  if (t < 4_400) return 0;
  if (t >= 9_200) return HERO_DEMO_PLAN_STEPS.length;
  return Math.min(
    HERO_DEMO_PLAN_STEPS.length,
    1 + Math.floor((t - 4_400) / 1_050),
  );
}

export function heroDemoComposerText(ms: number): string {
  const phase = heroDemoPhaseAt(ms);
  if (phase === "idle" || phase === "typing") return heroDemoTypedPrompt(ms);
  return "";
}

export function heroDemoShowsCaret(ms: number): boolean {
  const phase = heroDemoPhaseAt(ms);
  return phase === "idle" || phase === "typing";
}

export type HeroToolLine = {
  id: string;
  label: string;
  detail: string;
  tone: "working" | "success" | "wait" | "info";
};

export function heroDemoToolLines(phase: HeroDemoPhase): HeroToolLine[] {
  const lines: HeroToolLine[] = [];
  if (heroDemoReached(phase, "kit")) {
    lines.push({
      id: "kit",
      label: phase === "kit" ? "Now reading Brand Kit…" : "Read the Brand Kit.",
      detail: "Northline · voice, offer, forbidden words",
      tone: phase === "kit" ? "working" : "success",
    });
  }
  if (heroDemoReached(phase, "browse")) {
    lines.push({
      id: "browse",
      label: phase === "browse" ? "Opening URL…" : "Opened northline.example.",
      detail: "northline.example",
      tone: phase === "browse" ? "working" : "success",
    });
  }
  if (heroDemoReached(phase, "write")) {
    lines.push({
      id: "write",
      label: phase === "write" ? "Writing draft…" : "Wrote draft.",
      detail: "5 LinkedIn posts",
      tone: phase === "write" ? "working" : "success",
    });
  }
  if (heroDemoReached(phase, "approve")) {
    lines.push({
      id: "ask",
      label: "Waiting for your approval…",
      detail: "Nothing is published",
      tone: "wait",
    });
  }
  return lines;
}

export function heroDemoNowHeadline(phase: HeroDemoPhase): {
  headline: string;
  detail: string;
  tone: "working" | "wait" | "info";
} {
  switch (phase) {
    case "idle":
    case "typing":
      return {
        headline: "No job yet",
        detail: "Give this agent a job.",
        tone: "info",
      };
    case "sent":
    case "plan":
      return {
        headline: "Planning the week…",
        detail: "Writer · a week of posts",
        tone: "working",
      };
    case "kit":
      return {
        headline: "Now reading Brand Kit…",
        detail: "Brand Kit",
        tone: "working",
      };
    case "browse":
      return {
        headline: "Opening northline.example…",
        detail: "Opening the site",
        tone: "working",
      };
    case "write":
      return {
        headline: "Writing draft…",
        detail: "Writing the draft",
        tone: "working",
      };
    case "artifacts":
      return {
        headline: "Drafts are on the desk.",
        detail: "5 LinkedIn posts · still unpublished",
        tone: "info",
      };
    case "approve":
    case "website":
    case "hold":
      return {
        headline: "Waiting for your approval…",
        detail: "Nothing leaves until you approve",
        tone: "wait",
      };
  }
}

export function heroDemoJobStatus(phase: HeroDemoPhase): "idle" | "running" | "needs_you" {
  if (phase === "idle" || phase === "typing") return "idle";
  if (heroDemoReached(phase, "approve")) return "needs_you";
  return "running";
}

export function heroDemoWorking(phase: HeroDemoPhase): boolean {
  return (
    phase === "plan" ||
    phase === "kit" ||
    phase === "browse" ||
    phase === "write" ||
    phase === "sent"
  );
}

/** Decorative perch characters — CINEM shapes with eyes, not a licensed mascot set. */
export const HERO_DEMO_CAST: {
  id: string;
  role: string;
  perch: "left" | "mid-left" | "mid-right" | "right";
  spec: AgentAvatarSpec;
}[] = [
  {
    id: "cast-writer",
    role: "Writer",
    perch: "left",
    spec: {
      seed: "cast-writer",
      shape: "teardrop",
      hue: 268,
      sat: 58,
      lit: 48,
      accentHue: 296,
      tilt: -8,
      eyeGap: 8,
      eyeY: 14,
    },
  },
  {
    id: "cast-research",
    role: "Research",
    perch: "mid-left",
    spec: {
      seed: "cast-research",
      shape: "squircle",
      hue: 206,
      sat: 62,
      lit: 46,
      accentHue: 188,
      tilt: 5,
      eyeGap: 8,
      eyeY: 15,
    },
  },
  {
    id: "cast-builder",
    role: "Website Builder",
    perch: "mid-right",
    spec: {
      seed: "cast-builder",
      shape: "hexagon",
      hue: 148,
      sat: 46,
      lit: 40,
      accentHue: 166,
      tilt: -4,
      eyeGap: 7,
      eyeY: 14,
    },
  },
  {
    id: "cast-sales",
    role: "Sales",
    perch: "right",
    spec: {
      seed: "cast-sales",
      shape: "triangle",
      hue: 14,
      sat: 70,
      lit: 50,
      accentHue: 32,
      tilt: 6,
      eyeGap: 8,
      eyeY: 18,
    },
  },
];

export const HERO_DEMO_ROSTER = [
  { id: "roster-writer", name: HERO_DEMO_AGENT_NAME, role: HERO_DEMO_AGENT_ROLE, key: "writer" },
  { id: "roster-research", name: HERO_DEMO_AGENT_NAME, role: "Research", key: "research" },
  { id: "roster-builder", name: HERO_DEMO_AGENT_NAME, role: "Website Builder", key: "builder" },
] as const;
