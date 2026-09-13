import { create } from "zustand";
import type { CinemAiAssistantUsageResponse } from "../../usage-client";
import {
  clearSession,
  consumeAssistantTurn,
  fetchUsage,
  readSession,
  signOutCloud,
  type CinemSessionUser,
} from "@/lib/cinemCloud";

type CloudPhase = "checking" | "signed_out" | "ready";

type CloudState = {
  phase: CloudPhase;
  user: CinemSessionUser | null;
  usage: CinemAiAssistantUsageResponse | null;
  upgradeOpen: boolean;
  error: string;
  hydrate: () => Promise<void>;
  refreshUsage: () => Promise<CinemAiAssistantUsageResponse | null>;
  consumeTurn: () => Promise<CinemAiAssistantUsageResponse>;
  showUpgrade: (usage?: CinemAiAssistantUsageResponse | null) => void;
  hideUpgrade: () => void;
  signOut: () => Promise<void>;
};

export const useCinemCloudStore = create<CloudState>((set, get) => ({
  phase: "checking",
  user: null,
  usage: null,
  upgradeOpen: false,
  error: "",

  hydrate: async () => {
    const session = readSession();
    if (!session?.accessToken && !session?.refreshToken) {
      set({ phase: "signed_out", user: null, usage: null, upgradeOpen: false });
      return;
    }
    try {
      const usage = await fetchUsage();
      set({
        phase: "ready",
        user: session.user,
        usage,
        upgradeOpen: !usage.allowed,
        error: "",
      });
    } catch (error) {
      clearSession();
      set({
        phase: "signed_out",
        user: null,
        usage: null,
        upgradeOpen: false,
        error: error instanceof Error ? error.message : "Sign in again.",
      });
    }
  },

  refreshUsage: async () => {
    try {
      const usage = await fetchUsage();
      set({ usage, upgradeOpen: !usage.allowed });
      return usage;
    } catch {
      return get().usage;
    }
  },

  consumeTurn: async () => {
    const usage = await consumeAssistantTurn();
    set({ usage, upgradeOpen: !usage.allowed });
    return usage;
  },

  showUpgrade: (usage) => {
    set({
      usage: usage ?? get().usage,
      upgradeOpen: true,
    });
  },

  hideUpgrade: () => set({ upgradeOpen: false }),

  signOut: async () => {
    await signOutCloud();
    set({
      phase: "signed_out",
      user: null,
      usage: null,
      upgradeOpen: false,
      error: "",
    });
  },
}));
