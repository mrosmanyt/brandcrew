export const AVATAR_SHAPES = [
  "hexagon",
  "blob",
  "circle",
  "squircle",
  "triangle",
  "teardrop",
  "oval",
  "cloud",
] as const;

export type AvatarShape = (typeof AVATAR_SHAPES)[number];

export type AgentAvatarSpec = {
  seed: string;
  shape: AvatarShape;
  hue: number;
  sat: number;
  lit: number;
  accentHue: number;
  tilt: number;
  eyeGap: number;
  eyeY: number;
};

/** FNV-1a so the same id/name always maps to the same shape + palette. */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function avatarSeedFor(input: {
  id?: string | null;
  name?: string | null;
  role?: string | null;
}): string {
  return [input.id?.trim(), input.name?.trim(), input.role?.trim()]
    .filter(Boolean)
    .join(":") || "new-agent";
}

export function agentAvatarSpec(seed: string): AgentAvatarSpec {
  const hash = hashSeed(seed || "new-agent");
  const shape = AVATAR_SHAPES[hash % AVATAR_SHAPES.length];
  const hue = hash % 360;
  const accentHue = (hue + 28 + ((hash >>> 8) % 40)) % 360;
  return {
    seed,
    shape,
    hue,
    sat: 52 + ((hash >>> 4) % 28),
    lit: 42 + ((hash >>> 12) % 16),
    accentHue,
    tilt: ((hash >>> 16) % 11) - 5,
    eyeGap: 7 + ((hash >>> 20) % 4),
    eyeY: 13 + ((hash >>> 24) % 3),
  };
}

export function avatarFill(spec: AgentAvatarSpec): string {
  return `hsl(${spec.hue} ${spec.sat}% ${spec.lit}%)`;
}

export function avatarShade(spec: AgentAvatarSpec): string {
  return `hsl(${spec.hue} ${Math.min(70, spec.sat + 8)}% ${Math.max(22, spec.lit - 16)}%)`;
}

export function avatarHighlight(spec: AgentAvatarSpec): string {
  return `hsl(${spec.accentHue} ${Math.min(70, spec.sat + 6)}% ${Math.min(78, spec.lit + 22)}%)`;
}
