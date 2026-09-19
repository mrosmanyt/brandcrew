/**
 * ChatGPT → download → Premiere Pro playbook (computer-use allowlist pipeline).
 * Feature-flagged via COMPUTER_USE_ENABLED; honest about user-confirm steps.
 */
import type { ComputerUseAction } from "../types";

export const CHATGPT_PREMIERE_PLAYBOOK_KEY = "chatgpt_premiere_export";

/** Detect user intent for the export pipeline. */
export function isChatGptPremierePlaybook(text: string): boolean {
  const t = text.toLowerCase();
  const wantsChatGpt = /\bchatgpt\b/.test(t);
  const wantsDownload = /\b(download|export|save|get)\b/.test(t);
  const wantsPremiere = /\b(premiere|adobe)\b/.test(t);
  return wantsChatGpt && wantsPremiere && (wantsDownload || /\b(import|open)\b/.test(t));
}

/**
 * Supervised step plan — download steps need user confirmation (honest gate).
 * Sidecar focuses allowlisted apps only; no fake automation claims.
 */
export function chatGptPremierePlan(task: string): ComputerUseAction[] {
  const actions: ComputerUseAction[] = [
    {
      kind: "focus_app",
      app: "chatgpt",
      label: "1. Focus ChatGPT Desktop",
    },
    {
      kind: "wait",
      ms: 800,
      label: "2. Wait for ChatGPT window",
    },
    {
      kind: "noop",
      label: "3. USER: export/download your response in ChatGPT (confirm when saved)",
    },
    {
      kind: "focus_app",
      app: "explorer",
      label: "4. Focus Downloads folder (Explorer)",
    },
    {
      kind: "wait",
      ms: 500,
      label: "5. Wait for Explorer",
    },
    {
      kind: "focus_app",
      app: "premiere",
      label: "6. Focus Premiere Pro",
    },
    {
      kind: "wait",
      ms: 800,
      label: "7. Wait for Premiere",
    },
    {
      kind: "noop",
      label: "8. USER: Import downloaded media into Premiere (File → Import)",
    },
  ];

  // Preserve task context in first noop detail for HUD
  if (task.trim()) {
    actions[2] = {
      ...actions[2],
      label: `3. USER: In ChatGPT, download/export — then confirm. Task: ${task.slice(0, 60)}`,
    };
  }
  return actions;
}

export function playbookRequiresUserConfirm(stepLabel: string): boolean {
  return /^USER:/i.test(stepLabel) || /\bUSER:\b/i.test(stepLabel);
}
