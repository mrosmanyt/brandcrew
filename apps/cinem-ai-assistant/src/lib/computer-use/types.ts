/** Computer-use session status shown in the HUD and Assistant UI. */
export type ComputerUseStatus = "idle" | "working" | "paused" | "terminated";

/** One logged step in a supervised computer-use session. */
export interface ComputerUseStep {
  index: number;
  action: string;
  detail?: string;
  at: number;
  ok: boolean;
}

/** Allowlisted desktop app identifiers (Windows-first). */
export type AllowlistedApp =
  | "explorer"
  | "chrome"
  | "edge"
  | "firefox"
  | "chatgpt"
  | "premiere"
  | "notepad";

/** Action kinds the step runner accepts. */
export type ComputerUseActionKind =
  | "focus_app"
  | "open_url"
  | "type_text"
  | "shell_powershell"
  | "wait"
  | "noop";

export interface ComputerUseAction {
  kind: ComputerUseActionKind;
  /** Human-readable label for HUD + logs. */
  label: string;
  /** App id when kind is focus_app. */
  app?: AllowlistedApp;
  /** URL when kind is open_url. */
  url?: string;
  /** Text when kind is type_text. */
  text?: string;
  /** PowerShell script when kind is shell_powershell (requires confirm). */
  script?: string;
  /** Milliseconds when kind is wait. */
  ms?: number;
}

export interface ComputerUseSession {
  id: string;
  task: string;
  status: ComputerUseStatus;
  currentAction: string;
  step: number;
  maxSteps: number;
  steps: ComputerUseStep[];
  shellConfirmed: boolean;
  startedAt: number;
  endedAt?: number;
}

export const DEFAULT_MAX_STEPS = 50;

/** Mouse-move pause threshold in pixels (documented in docs/computer-use-mvp.md). */
export const MOUSE_PAUSE_THRESHOLD_PX = 12;
