import { CinemMark } from "@/components/brand/logo";
import {
  agentAvatarSpec,
  avatarFill,
  avatarHighlight,
  avatarSeedFor,
  avatarShade,
  defaultAgentAvatarKind,
  type AgentAvatarSpec,
  type AvatarShape,
} from "@/lib/agent-avatar";
import { cn } from "@/lib/utils";

const SIZE_PX = { sm: 24, md: 32, lg: 40, xl: 56 } as const;

export function AgentAvatar({
  id,
  name,
  role,
  working = false,
  size = "md",
  className,
  title,
  spec: specOverride,
  instanceId,
}: {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  working?: boolean;
  size?: keyof typeof SIZE_PX;
  className?: string;
  title?: string;
  spec?: AgentAvatarSpec;
  instanceId?: string;
}) {
  const px = SIZE_PX[size];
  const label = title || name || "Agent";
  return (
    <span
      className={cn(
        "agent-avatar relative inline-grid shrink-0 place-items-center",
        working ? "is-working" : "is-idle",
        className,
      )}
      style={{ width: px, height: px }}
      title={label}
      aria-hidden
    >
      {defaultAgentAvatarKind(specOverride) === "cinem-mark" ? (
        <CinemMark className="agent-avatar-svg size-full" />
      ) : (
        <GeneratedAgentGlyph
          spec={specOverride ?? agentAvatarSpec(avatarSeedFor({ id, name, role }))}
          size={px}
          instanceId={instanceId}
        />
      )}
    </span>
  );
}

function GeneratedAgentGlyph({
  spec,
  size,
  instanceId,
}: {
  spec: AgentAvatarSpec;
  size: number;
  instanceId?: string;
}) {
  const uid = cssId(`${instanceId || spec.seed}-${size}`);
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className="agent-avatar-svg overflow-visible"
      style={{ transform: `rotate(${spec.tilt}deg)` }}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="18%" y1="8%" x2="88%" y2="96%">
          <stop offset="0%" stopColor={avatarHighlight(spec)} />
          <stop offset="42%" stopColor={avatarFill(spec)} />
          <stop offset="100%" stopColor={avatarShade(spec)} />
        </linearGradient>
        <radialGradient id={`${uid}-shine`} cx="32%" cy="26%" r="55%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id={`${uid}-depth`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.1" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <ShapePath shape={spec.shape} />
        </clipPath>
      </defs>
      <g filter={`url(#${uid}-depth)`}>
        <ShapePath shape={spec.shape} fill={`url(#${uid}-body)`} />
      </g>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect width="40" height="40" fill={`url(#${uid}-shine)`} />
        <ellipse cx="13" cy="11" rx="9" ry="5" fill="rgba(255,255,255,0.18)" />
      </g>
      <Eyes spec={spec} />
    </svg>
  );
}

function cssId(seed: string) {
  return seed.replace(/[^a-zA-Z0-9_-]/g, "");
}

function ShapePath({
  shape,
  fill,
}: {
  shape: AvatarShape;
  fill?: string;
}) {
  const common = { fill };
  switch (shape) {
    case "hexagon":
      return <polygon points="20,3 34,11.5 34,28.5 20,37 6,28.5 6,11.5" {...common} />;
    case "blob":
      return (
        <path
          d="M20 4c7 0 14 5 15 12 1 6-3 11-2 16-1 5-8 7-13 6-6-1-12 1-15-5-3-6 0-12 2-17C9 9 14 4 20 4z"
          {...common}
        />
      );
    case "circle":
      return <circle cx="20" cy="20" r="16" {...common} />;
    case "squircle":
      return <rect x="5" y="5" width="30" height="30" rx="10" {...common} />;
    case "triangle":
      return <path d="M20 5c1.2 0 2.3.6 2.9 1.7l12 22.2c.7 1.3-.2 2.9-1.7 2.9H6.8c-1.5 0-2.4-1.6-1.7-2.9l12-22.2C17.7 5.6 18.8 5 20 5z" {...common} />;
    case "teardrop":
      return <path d="M20 4c9 8 14 14 14 21a14 14 0 1 1-28 0c0-7 5-13 14-21z" {...common} />;
    case "oval":
      return <ellipse cx="20" cy="20" rx="13" ry="16.5" transform="rotate(-16 20 20)" {...common} />;
  }
}

function Eyes({ spec }: { spec: AgentAvatarSpec }) {
  const left = 20 - spec.eyeGap;
  const right = 20 + spec.eyeGap;
  return (
    <g className="agent-avatar-eyes" fill="#16141a">
      <ellipse className="agent-eye" cx={left} cy={spec.eyeY} rx="2.15" ry="2.7" />
      <ellipse className="agent-eye" cx={right} cy={spec.eyeY} rx="2.15" ry="2.7" />
    </g>
  );
}
