/**
 * Admin approval gate for risky computer-use sessions (assistant-local).
 * Reuses localDb activity patterns — admin panel approves pending sessions.
 */

export interface ComputerUseApprovalRequest {
  id: string;
  task: string;
  userId: string | null;
  userName?: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
}

const LS_KEY = "cinem.computerUse.approvals";
const REQUIRES_ADMIN_KEY = "cinem.computerUse.requiresAdmin";

export function computerUseRequiresAdminApproval(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(REQUIRES_ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setComputerUseRequiresAdminApproval(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(REQUIRES_ADMIN_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function load(): ComputerUseApprovalRequest[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as ComputerUseApprovalRequest[];
  } catch {
    return [];
  }
}

function save(rows: ComputerUseApprovalRequest[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function listPendingComputerUseApprovals(): ComputerUseApprovalRequest[] {
  return load().filter((r) => r.status === "pending");
}

export function requestComputerUseApproval(
  task: string,
  userId: string | null,
  userName?: string,
): ComputerUseApprovalRequest {
  const row: ComputerUseApprovalRequest = {
    id: `cu-approve-${Date.now()}`,
    task: task.slice(0, 500),
    userId,
    userName,
    requestedAt: new Date().toISOString(),
    status: "pending",
  };
  save([row, ...load()]);
  return row;
}

export function decideComputerUseApproval(
  id: string,
  approve: boolean,
  decidedBy = "admin",
): ComputerUseApprovalRequest | null {
  const rows = load();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  rows[idx] = {
    ...rows[idx],
    status: approve ? "approved" : "rejected",
    decidedAt: new Date().toISOString(),
    decidedBy,
  };
  save(rows);
  return rows[idx];
}

export function hasApprovedSession(task: string): boolean {
  const t = task.trim().toLowerCase();
  return load().some(
    (r) => r.status === "approved" && r.task.trim().toLowerCase() === t && r.decidedAt,
  );
}

export function canStartComputerUseSession(task: string): { ok: true } | { ok: false; reason: string } {
  if (!computerUseRequiresAdminApproval()) return { ok: true };
  if (hasApprovedSession(task)) return { ok: true };
  const pending = listPendingComputerUseApprovals().some(
    (r) => r.task.trim().toLowerCase() === task.trim().toLowerCase(),
  );
  if (pending) {
    return { ok: false, reason: "Waiting for admin approval in the Admin panel (Computer Use queue)." };
  }
  return { ok: false, reason: "Admin approval required — request submitted." };
}
