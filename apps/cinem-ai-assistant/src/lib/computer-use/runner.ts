/**
 * Pure step-runner logic — testable without Windows desktop.
 * Renderer + sidecar call into this for gating, logging, and limits.
 */
import { requiresShellConfirm, validateFocusApp } from "./allowlist";
import type {
  ComputerUseAction,
  ComputerUseSession,
  ComputerUseStatus,
  ComputerUseStep,
} from "./types";
import { DEFAULT_MAX_STEPS as MAX_DEFAULT } from "./types";

export function createSession(task: string, maxSteps = MAX_DEFAULT): ComputerUseSession {
  return {
    id: `cu-${Date.now()}`,
    task,
    status: "idle",
    currentAction: "",
    step: 0,
    maxSteps,
    steps: [],
    shellConfirmed: false,
    startedAt: Date.now(),
  };
}

export function sessionStatusLabel(status: ComputerUseStatus): string {
  switch (status) {
    case "working":
      return "Working";
    case "paused":
      return "Paused";
    case "terminated":
      return "Terminated";
    default:
      return "Idle";
  }
}

/** Validate an action before execution. */
export function validateAction(
  action: ComputerUseAction,
  session: ComputerUseSession,
): { ok: true } | { ok: false; error: string } {
  if (session.status === "terminated") {
    return { ok: false, error: "Session terminated" };
  }
  if (session.step >= session.maxSteps) {
    return { ok: false, error: `Max steps (${session.maxSteps}) reached` };
  }
  if (action.kind === "focus_app") {
    if (!action.app) return { ok: false, error: "focus_app requires app" };
    const v = validateFocusApp(action.app);
    if (!v.ok) return v;
  }
  if (action.kind === "shell_powershell") {
    if (!session.shellConfirmed) {
      return { ok: false, error: "PowerShell requires explicit user confirmation in UI" };
    }
    if (!action.script?.trim()) {
      return { ok: false, error: "shell_powershell requires script" };
    }
  }
  if (requiresShellConfirm(action.kind) && !session.shellConfirmed) {
    return { ok: false, error: "Shell action blocked until user confirms" };
  }
  return { ok: true };
}

/** Record a completed step and advance counter. */
export function appendStep(
  session: ComputerUseSession,
  action: ComputerUseAction,
  ok: boolean,
  detail?: string,
): ComputerUseSession {
  const index = session.step + 1;
  const entry: ComputerUseStep = {
    index,
    action: action.label || action.kind,
    detail,
    at: Date.now(),
    ok,
  };
  const next: ComputerUseSession = {
    ...session,
    step: index,
    currentAction: action.label || action.kind,
    steps: [...session.steps, entry],
    status: ok ? "working" : "paused",
  };
  if (index >= session.maxSteps) {
    return terminateSession(next, "max_steps");
  }
  return next;
}

export function setSessionStatus(session: ComputerUseSession, status: ComputerUseStatus): ComputerUseSession {
  return { ...session, status };
}

export function confirmShell(session: ComputerUseSession): ComputerUseSession {
  return { ...session, shellConfirmed: true };
}

export function terminateSession(session: ComputerUseSession, reason?: string): ComputerUseSession {
  const detail = reason ? `terminated: ${reason}` : "terminated";
  const entry: ComputerUseStep = {
    index: session.step,
    action: detail,
    at: Date.now(),
    ok: false,
  };
  return {
    ...session,
    status: "terminated",
    currentAction: "",
    endedAt: Date.now(),
    steps: session.steps.some((s) => s.action === detail) ? session.steps : [...session.steps, entry],
  };
}

export function pauseOnMouseMove(session: ComputerUseSession): ComputerUseSession {
  if (session.status !== "working") return session;
  return { ...session, status: "paused", currentAction: "Paused — you moved the mouse" };
}

/** Parse a minimal action plan from task text (MVP heuristic). */
export function planFromTask(task: string): ComputerUseAction[] {
  const t = task.toLowerCase();
  const actions: ComputerUseAction[] = [];
  if (/\bexplorer\b|\bfile(s)?\b|\bfolder\b/.test(t)) {
    actions.push({ kind: "focus_app", app: "explorer", label: "Focus File Explorer" });
  }
  if (/\bchrome\b/.test(t)) {
    actions.push({ kind: "focus_app", app: "chrome", label: "Focus Chrome" });
  }
  if (/\bedge\b/.test(t)) {
    actions.push({ kind: "focus_app", app: "edge", label: "Focus Edge" });
  }
  if (/\bchatgpt\b/.test(t)) {
    actions.push({ kind: "focus_app", app: "chatgpt", label: "Focus ChatGPT Desktop" });
  }
  if (/\bpremiere\b/.test(t)) {
    actions.push({ kind: "focus_app", app: "premiere", label: "Focus Premiere Pro" });
  }
  const urlMatch = task.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    actions.push({ kind: "open_url", url: urlMatch[0], label: `Open ${urlMatch[0]}` });
  }
  if (actions.length === 0) {
    actions.push({ kind: "focus_app", app: "explorer", label: "Focus File Explorer (default)" });
  }
  return actions;
}

export { DEFAULT_MAX_STEPS };
