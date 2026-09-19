import { create } from "zustand";
import {
  appendStep,
  confirmShell,
  createSession,
  pauseOnMouseMove,
  planFromTask,
  setSessionStatus,
  terminateSession,
  validateAction,
} from "@/lib/computer-use/runner";
import type { ComputerUseAction, ComputerUseSession } from "@/lib/computer-use/types";
import { executeFocusApp, executeOpenUrl, executePowerShell } from "@/lib/computer-use/client";
import { cinemDesktopBridge } from "@/lib/desktop-shell";
import { notify } from "@/store/useToastStore";

interface ComputerUseState {
  session: ComputerUseSession | null;
  pendingShell: boolean;
  envEnabled: boolean;
  startSession: (task: string) => Promise<string>;
  runPlannedTask: (task: string) => Promise<string>;
  terminate: () => void;
  confirmShellAndResume: () => void;
  setEnvEnabled: (on: boolean) => void;
  syncFromHud: (payload: Partial<ComputerUseSession>) => void;
}

async function syncHud(session: ComputerUseSession | null) {
  try {
    const bridge = cinemDesktopBridge();
    if (!bridge?.computerUse?.syncHud) return;
    await bridge.computerUse.syncHud(session ?? {});
  } catch {
    /* HUD sync is best-effort */
  }
}

async function runAction(session: ComputerUseSession, action: ComputerUseAction): Promise<ComputerUseSession> {
  const v = validateAction(action, session);
  if (!v.ok) {
    return appendStep(session, action, false, v.error);
  }
  let result: { ok: boolean; detail?: string; error?: string };
  switch (action.kind) {
    case "focus_app":
      result = await executeFocusApp(action.app!);
      break;
    case "open_url":
      result = await executeOpenUrl(action.url!);
      break;
    case "shell_powershell":
      result = await executePowerShell(action.script!, session.shellConfirmed);
      break;
    case "wait":
      await new Promise((r) => setTimeout(r, action.ms ?? 500));
      result = { ok: true, detail: `waited ${action.ms ?? 500}ms` };
      break;
    default:
      result = { ok: true, detail: "noop" };
  }
  return appendStep(session, action, result.ok, result.detail || result.error);
}

export const useComputerUseStore = create<ComputerUseState>((set, get) => ({
  session: null,
  pendingShell: false,
  envEnabled: false,

  setEnvEnabled: (on) => set({ envEnabled: on }),

  syncFromHud: (payload) => {
    const cur = get().session;
    if (!cur) return;
    set({ session: { ...cur, ...payload } });
  },

  startSession: async (task) => {
    const bridge = cinemDesktopBridge();
    let session = createSession(task);
    session = setSessionStatus(session, "working");
    set({ session, pendingShell: false });
    if (bridge?.computerUse?.startSession) {
      const started = await bridge.computerUse.startSession({ task, maxSteps: session.maxSteps });
      if (started && started.ok === false) {
        session = terminateSession(session, started.error || "sidecar_offline");
        set({ session });
        return `Computer-use could not start: ${started.error || "sidecar offline"}`;
      }
    }
    await syncHud(session);
    return `Computer-use session started: "${task}"`;
  },

  runPlannedTask: async (task) => {
    const { startSession } = get();
    await startSession(task);
    let session = get().session!;
    const actions = planFromTask(task);
    for (const action of actions) {
      if (session.status === "terminated" || session.step >= session.maxSteps) break;
      if (action.kind === "shell_powershell" && !session.shellConfirmed) {
        set({ pendingShell: true });
        session = setSessionStatus(session, "paused");
        set({ session });
        await syncHud(session);
        return "PowerShell step requires confirmation — click Allow PowerShell in the Computer Use panel.";
      }
      session = await runAction(session, action);
      set({ session });
      await syncHud(session);
      if (!session.steps[session.steps.length - 1]?.ok) break;
    }
    if (session.step >= session.maxSteps) {
      session = terminateSession(session, "max_steps");
    } else if (session.status === "working") {
      session = setSessionStatus(session, "idle");
    }
    set({ session });
    await syncHud(session);
    const bridge = cinemDesktopBridge();
    if (bridge?.computerUse?.stopSession) {
      await bridge.computerUse.stopSession().catch(() => undefined);
    }
    const last = session.steps[session.steps.length - 1];
    return last?.ok
      ? `Done — ${session.step} step(s). Last: ${last.action}`
      : `Stopped at step ${session.step}: ${last?.detail || last?.action || "unknown"}`;
  },

  terminate: () => {
    const cur = get().session;
    const session = cur ? terminateSession(cur) : null;
    set({ session, pendingShell: false });
    void syncHud(session);
    const bridge = cinemDesktopBridge();
    if (bridge?.computerUse?.terminate) {
      void bridge.computerUse.terminate().catch(() => undefined);
    }
    notify("info", "Computer-use session terminated");
  },

  confirmShellAndResume: () => {
    const cur = get().session;
    if (!cur) return;
    const session = confirmShell(setSessionStatus(cur, "working"));
    set({ session, pendingShell: false });
    void syncHud(session);
    notify("success", "PowerShell confirmed for this session");
  },
}));

/** Called from Electron when user moves mouse during working session. */
export function onComputerUseMousePause() {
  const store = useComputerUseStore.getState();
  const cur = store.session;
  if (!cur || cur.status !== "working") return;
  const next = pauseOnMouseMove(cur);
  useComputerUseStore.setState({ session: next });
  void syncHud(next);
    notify("info", "Paused — mouse moved");
}
