/**
 * Runtime status of the remote-control integrations (Telegram / WhatsApp).
 * Pure UI state — never persisted (tokens & toggles live in useSettingsStore).
 */
import { create } from "zustand";

export type TgState = "off" | "connecting" | "pairing" | "online" | "error";
export type WaState = "off" | "starting" | "qr" | "online" | "error";

interface IntegrationsState {
  /* Telegram */
  tgState: TgState;
  tgDetail: string;       // human status line ("@CinemAiAssistantBot linked", error text, …)
  tgPairCode: string;     // 6-digit pairing code while tgState === "pairing"
  tgBotName: string;      // bot username (no @) once the token is validated
  tgCommands: number;     // commands executed this session
  /* WhatsApp */
  waState: WaState;
  waDetail: string;
  waCommands: number;

  setTg: (p: Partial<Pick<IntegrationsState, "tgState" | "tgDetail" | "tgPairCode" | "tgBotName">>) => void;
  bumpTg: () => void;
  setWa: (p: Partial<Pick<IntegrationsState, "waState" | "waDetail">>) => void;
  bumpWa: () => void;
}

export const useIntegrationsStore = create<IntegrationsState>((set) => ({
  tgState: "off",
  tgDetail: "Not connected",
  tgPairCode: "",
  tgBotName: "",
  tgCommands: 0,
  waState: "off",
  waDetail: "Not connected",
  waCommands: 0,

  setTg: (p) => set(p),
  bumpTg: () => set((s) => ({ tgCommands: s.tgCommands + 1 })),
  setWa: (p) => set(p),
  bumpWa: () => set((s) => ({ waCommands: s.waCommands + 1 })),
}));
