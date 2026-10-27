/**
 * Pure orb state machine — drives the EXISTING IntelligenceHub orb only.
 */
import type { VoiceStatus } from "@/store/useAppStore";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface OrbStateInput {
  voiceStatus: VoiceStatus;
  /** Any pending orchestrator thought block. */
  thinking: boolean;
  /** Non-empty → error mood (red pulse). */
  error?: string | null;
}

/** Map live assistant signals to a single orb mood. */
export function resolveOrbState(input: OrbStateInput): OrbState {
  if (input.error?.trim()) return "error";
  if (input.thinking || input.voiceStatus === "transcribing") return "thinking";
  if (input.voiceStatus === "listening") return "listening";
  if (input.voiceStatus === "speaking") return "speaking";
  return "idle";
}

/** Human label for the command-center strip. */
export function orbStateLabel(state: OrbState): string {
  switch (state) {
    case "listening":
      return "LISTENING";
    case "thinking":
      return "THINKING";
    case "speaking":
      return "SPEAKING";
    case "error":
      return "ERROR";
    default:
      return "IDLE";
  }
}
