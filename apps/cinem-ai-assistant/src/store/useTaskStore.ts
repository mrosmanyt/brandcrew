/**
 * Visual Task Execution — state for Cinem AI Assistant's floating task windows.
 *
 * Every visible action (web pages, live research, editor jobs, …) gets a
 * glassmorphic in-app window with a title bar, agent badge, live status and
 * progress. One task is shown as the floating window at a time; opening a
 * new one auto-minimizes the previous (it stays in the dock, bottom-right).
 */
import { create } from "zustand";
import { sfx } from "@/lib/sfx";

export type TaskKind = "web" | "research" | "editor" | "files";

/** Row in a "files" window (organize preview / search results). */
export interface TaskFileRow {
  name: string;
  sizeMb: number;
  /** Category / folder / extension chip shown next to the row. */
  tag: string;
}

/** Action button in the window footer (EXECUTE / CANCEL / UNDO …). */
export interface TaskAction {
  id: string;
  label: string;
  variant: "primary" | "danger" | "ghost";
}
export type TaskMode = "popup" | "full" | "min";
export type TaskStatus = "working" | "done" | "error";

export interface TaskSource {
  title: string;
  url: string;
}

export interface TaskWin {
  id: string;
  kind: TaskKind;
  /** Window title, e.g. "Google" / "Research: AI news". */
  title: string;
  /** Title-bar subtitle, e.g. "google.com • embedded" / "working…". */
  subtitle: string;
  /** Glowing agent badge, e.g. "ALENA · RESEARCH AGENT". */
  agent: string;
  status: TaskStatus;
  /** 0–100 → determinate bar; null → indeterminate shimmer while working. */
  progress: number | null;
  mode: TaskMode;
  /** kind "web": URL rendered in the embedded frame. */
  url?: string;
  /** Real destination for the "open in browser" button. */
  externalUrl?: string;
  /** Live step log (research/editor). */
  steps: string[];
  /** Final markdown result (research) / completion note (editor). */
  result?: string;
  sources?: TaskSource[];
  /** kind "files": rows shown in the window (preview / results). */
  files?: TaskFileRow[];
  /** Footer action buttons + their handler (MAX: confirm/cancel/undo). */
  actions?: TaskAction[];
  onAction?: (id: string) => void;
  createdAt: number;
}

interface TaskState {
  tasks: TaskWin[];
  /** Opens a window (auto-minimizes any other visible one). Returns id. */
  openTask: (
    t: Omit<TaskWin, "id" | "steps" | "status" | "progress" | "mode" | "createdAt"> &
      Partial<Pick<TaskWin, "status" | "progress" | "mode" | "steps">>,
  ) => string;
  patchTask: (id: string, patch: Partial<TaskWin>) => void;
  appendTaskStep: (id: string, step: string) => void;
  setTaskMode: (id: string, mode: TaskMode) => void;
  closeTask: (id: string) => void;
}

const uid = () => crypto.randomUUID();

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],

  openTask: (t) => {
    const id = uid();
    sfx.open();
    set((s) => ({
      tasks: [
        // only one floating window — older visible tasks drop to the dock
        ...s.tasks.map((x) => (x.mode === "min" ? x : { ...x, mode: "min" as TaskMode })),
        {
          status: "working",
          progress: null,
          mode: "popup",
          steps: [],
          createdAt: Date.now(),
          ...t,
          id,
        },
      ],
    }));
    return id;
  },

  patchTask: (id, patch) => {
    if (patch.status === "done") sfx.done();
    else if (patch.status === "error") sfx.error();
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  appendTaskStep: (id, step) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, steps: [...t.steps, step] } : t)),
    })),

  setTaskMode: (id, mode) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, mode }
          : // restoring one window minimizes any other visible one
            mode !== "min" && t.mode !== "min"
            ? { ...t, mode: "min" }
            : t,
      ),
    })),

  closeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}));
