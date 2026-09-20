import { create } from "zustand";
import {
  hasClientAssistantAccess,
  shouldHardLockAssistant,
  shouldPromptAssistantUpgrade,
  type CinemAiAssistantUsageResponse,
} from "../../usage-client";
import {
  adoptDesktopSession,
  clearSession,
  consumeAssistantTurn,
  fetchUsage,
  readSession,
  signOutCloud,
  syncDesktopSession,
  type CinemSessionUser,
} from "@/lib/cinemCloud";

type CloudPhase = "checking" | "signed_out" | "ready";

function upgradeOpenFor(usage: CinemAiAssistantUsageResponse | null) {
  if (shouldHardLockAssistant(usage)) return false;
  return shouldPromptAssistantUpgrade(usage);
}

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
    try {
      const session = (await syncDesktopSession()) || (await adoptDesktopSession()) || readSession();
      if (!session?.accessToken && !session?.refreshToken) {
        set({ phase: "signed_out", user: null, usage: null, upgradeOpen: false });
        return;
      }
      const usage = await fetchUsage();
      const fresh = readSession();
      set({
        phase: "ready",
        user: fresh?.user ?? session.user,
        usage,
        upgradeOpen: upgradeOpenFor(usage),
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
      set({ usage, upgradeOpen: upgradeOpenFor(usage), error: "" });
      return usage;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Could not refresh payment status.",
      });
      return get().usage;
    }
  },

  consumeTurn: async () => {
    const current = get().usage;
    if (shouldHardLockAssistant(current) || (current && !hasClientAssistantAccess(current))) {
      set({ usage: current, upgradeOpen: false });
      if (!current) {
        throw new Error("Pro required");
      }
      return { ...current, allowed: false, proRequired: true };
    }
    const usage = await consumeAssistantTurn();
    set({ usage, upgradeOpen: upgradeOpenFor(usage) });
    return usage;
  },

  showUpgrade: (usage) => {
    const next = usage ?? get().usage;
    if (!shouldPromptAssistantUpgrade(next)) {
      set({ usage: next ?? get().usage, upgradeOpen: false });
      return;
    }
    set({
      usage: next,
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
