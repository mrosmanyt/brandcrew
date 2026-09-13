/**
 * SECURITY AGENT — defensive system guardian (Phase 4, agent #1).
 *
 * Tools (Rust commands, read-only / defensive):
 *  - system_snapshot : host info, memory pressure, top processes (sysinfo)
 *  - network_audit   : netstat summary — states + top remote endpoints
 *  - firewall_check  : Windows Firewall profile states
 *
 * Flow: run all scans → feed the raw telemetry to the LLM under a strict
 * security-analyst persona → return a structured report with severities.
 */
import { chatLLM } from "@/lib/llm";
import { safeExec, type AgentImpl, type AgentTool } from "@/lib/agents/types";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invokeTool<T>(command: string): Promise<T> {
  if (!IS_TAURI) throw new Error("desktop build required");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command);
}

/* ── Tools ────────────────────────────────────────────────────────── */

const systemSnapshot: AgentTool = {
  name: "system_snapshot",
  description: "Host info, uptime, memory pressure and top processes by memory.",
  execute: async () => JSON.stringify(await invokeTool("security_scan")),
};

const networkAudit: AgentTool = {
  name: "network_audit",
  description: "Connection-state summary and most frequent remote endpoints.",
  execute: async () => JSON.stringify(await invokeTool("network_scan")),
};

const firewallCheck: AgentTool = {
  name: "firewall_check",
  description: "Windows Firewall state for all profiles.",
  execute: async () => await invokeTool<string>("firewall_status"),
};

/* ── Persona ──────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are Cinem AI Assistant's SECURITY AGENT — a calm, precise defensive-security analyst protecting the user's personal computer.

Your duties: monitor system health, spot suspicious signals (unusual processes, abnormal memory/CPU, unexpected outbound connections, disabled firewall), and give clear, actionable alerts.

Rules:
- You work from the telemetry provided below. Be honest about limits: this is a heuristic snapshot, not a full antivirus scan — never claim certainty you don't have.
- Flag findings with a severity tag: [OK], [NOTICE], [WARNING], [CRITICAL].
- Well-known legitimate processes (browsers, system services, IDEs, games) are NOT suspicious just because they use memory. Avoid false alarms.
- Many established connections to one unknown host, a disabled firewall, or near-exhausted memory deserve attention.
- End with a one-line overall verdict and at most 3 concrete recommendations.
- Plain text only, no markdown headers. Keep it under 160 words unless the user asked for detail.`;

/* ── Implementation ───────────────────────────────────────────────── */

export const securityAgent: AgentImpl = {
  id: "security",
  systemPrompt: SYSTEM_PROMPT,
  tools: [systemSnapshot, networkAudit, firewallCheck],

  async run(ctx) {
    ctx.step("Collecting system snapshot…");
    const sysData = await safeExec(systemSnapshot, ctx);

    ctx.step("Auditing network connections…");
    const netData = await safeExec(networkAudit, ctx);

    ctx.step("Checking firewall profiles…");
    const fwData = await safeExec(firewallCheck, ctx);

    ctx.step("Analyzing telemetry for threats…");
    const findings = await chatLLM(
      `${SYSTEM_PROMPT}

=== TELEMETRY ===
[system_snapshot]
${sysData}

[network_audit]
${netData}

[firewall_check]
${fwData}
=== END TELEMETRY ===

User request: """${ctx.request}"""

Write your security report now:`,
      ctx.settings,
    );

    return { findings: findings.trim() };
  },
};
