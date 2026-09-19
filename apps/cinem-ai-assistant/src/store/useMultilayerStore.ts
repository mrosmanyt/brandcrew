import { create } from "zustand";
import type { OrchestratorRun } from "@/lib/multilayer/types";

interface MultilayerState {
  run: OrchestratorRun | null;
  /** Agent id → step index for Agent Map handoff glow. */
  activeHandoffs: Record<string, number>;
  hudLine: string;
  setRun: (run: OrchestratorRun | null) => void;
  setActiveHandoff: (agentId: string, stepIndex: number) => void;
  clearHandoff: (agentId: string) => void;
  setHudLine: (line: string) => void;
}

export const useMultilayerStore = create<MultilayerState>((set) => ({
  run: null,
  activeHandoffs: {},
  hudLine: "",
  setRun: (run) => set({ run }),
  setActiveHandoff: (agentId, stepIndex) =>
    set((s) => ({ activeHandoffs: { ...s.activeHandoffs, [agentId]: stepIndex } })),
  clearHandoff: (agentId) =>
    set((s) => {
      const next = { ...s.activeHandoffs };
      delete next[agentId];
      return { activeHandoffs: next };
    }),
  setHudLine: (hudLine) => set({ hudLine }),
}));
