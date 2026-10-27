/**
 * Multi-step web autopilot runner — Playwright sidecar before general computer-use.
 */
import { playOnYouTube, researchInBrowser } from "@/lib/playwrightActions";
import type { WebAutopilotCommand } from "@/lib/iris/web-autopilot-intents";

export type { WebAutopilotCommand, WebAutopilotKind } from "@/lib/iris/web-autopilot-intents";
export { isWebAutopilotCommand, parseWebAutopilot } from "@/lib/iris/web-autopilot-intents";

export interface WebAutopilotResult {
  ok: boolean;
  reply: string;
  via: "playwright" | "system-browser" | "none";
}

/** Run a deterministic multi-step browser script (search → open → play/click). */
export async function runWebAutopilot(cmd: WebAutopilotCommand): Promise<WebAutopilotResult> {
  if (cmd.kind === "youtube-play") {
    const pw = await playOnYouTube(cmd.query);
    if (pw.via === "playwright" && pw.played) {
      return {
        ok: true,
        via: "playwright",
        reply: `Playing "${pw.title || cmd.query}" on YouTube.`,
      };
    }
    if (pw.via === "playwright") {
      return {
        ok: true,
        via: "playwright",
        reply: `Opened "${pw.title || cmd.query}" on YouTube. ${
          pw.autoplayBlocked ? "Autoplay blocked — press Play in Chromium." : ""
        }`.trim(),
      };
    }
    return {
      ok: true,
      via: "system-browser",
      reply: `Opened YouTube search for "${cmd.query}" in your browser.`,
    };
  }

  const research = await researchInBrowser(cmd.query);
  if (!research.ok || !research.results.length) {
    return {
      ok: false,
      via: research.via,
      reply: research.error || `Could not complete Google search for "${cmd.query}".`,
    };
  }
  const top = research.results[0];
  return {
    ok: true,
    via: research.via === "playwright" ? "playwright" : "none",
    reply: `Opened top result: "${top.title}" — ${top.url}`,
  };
}
