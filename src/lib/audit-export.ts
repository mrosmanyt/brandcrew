import { createHash } from "node:crypto";
import { serializeAudit } from "@/lib/audit";

export const AUDIT_EXPORT_VERSION = 1;

/** Evidence pack — not a certification. Rows are append-only in product code. */
export type AuditExportMeta = {
  workspaceId?: string;
  exportedAt: string;
  exportedBy: string;
  exportedByRole?: string;
  source: "workspace_audit" | "admin_audit";
  certified: false;
  note: string;
};

export type HashedAuditEntry = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  detail?: string;
  data?: Record<string, unknown>;
  jobId?: string | null;
  deviceId?: string | null;
  targetId?: string;
  rowHash: string;
  prevHash: string;
  chainHash: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalAuditPayload(row: Record<string, unknown>): string {
  return JSON.stringify(row, Object.keys(row).sort());
}

export function hashAuditPayload(row: Record<string, unknown>): string {
  return sha256(canonicalAuditPayload(row));
}

export function chainHash(prevHash: string, rowHash: string): string {
  return sha256(`${prevHash}:${rowHash}`);
}

const GENESIS = "0".repeat(64);

export const AUDIT_EXPORT_NOTE =
  "Hash-chained export for later Type I evidence. CINEM Pro is not SOC 2 certified. Rows are not rewritten by the product; this pack is a point-in-time copy with SHA-256 hashes.";

export function packWorkspaceAuditExport(input: {
  workspaceId: string;
  exportedBy: string;
  exportedByRole?: string;
  rows: {
    id: string;
    workspaceId: string;
    jobId: string | null;
    deviceId: string | null;
    actor: string;
    action: string;
    detail: string;
    data: string;
    createdAt: Date;
  }[];
}) {
  const chronological = [...input.rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  let prev = GENESIS;
  const chained: HashedAuditEntry[] = chronological.map((row) => {
    const serialized = serializeAudit(row);
    const rowHash = hashAuditPayload({
      id: serialized.id,
      workspaceId: serialized.workspaceId,
      jobId: serialized.jobId,
      deviceId: serialized.deviceId,
      actor: serialized.actor,
      action: serialized.action,
      detail: serialized.detail,
      data: serialized.data,
      createdAt: serialized.createdAt,
    });
    const linked = chainHash(prev, rowHash);
    const entry: HashedAuditEntry = {
      id: serialized.id,
      createdAt: serialized.createdAt,
      actor: serialized.actor,
      action: serialized.action,
      detail: serialized.detail,
      data: serialized.data,
      jobId: serialized.jobId,
      deviceId: serialized.deviceId,
      rowHash,
      prevHash: prev,
      chainHash: linked,
    };
    prev = linked;
    return entry;
  });

  const packHash = sha256(chained.map((row) => row.chainHash).join("|") || GENESIS);
  return {
    version: AUDIT_EXPORT_VERSION,
    meta: {
      workspaceId: input.workspaceId,
      exportedAt: new Date().toISOString(),
      exportedBy: input.exportedBy,
      exportedByRole: input.exportedByRole,
      source: "workspace_audit" as const,
      certified: false as const,
      note: AUDIT_EXPORT_NOTE,
    },
    count: chained.length,
    packHash,
    entries: chained,
  };
}

export function packAdminAuditExport(input: {
  exportedBy: string;
  rows: {
    id: string;
    actorEmail: string;
    action: string;
    targetId: string;
    meta: string;
    createdAt: Date;
  }[];
}) {
  const chronological = [...input.rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  let prev = GENESIS;
  const entries = chronological.map((row) => {
    let meta: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(row.meta || "{}");
      if (parsed && typeof parsed === "object") meta = parsed as Record<string, unknown>;
    } catch {
      meta = {};
    }
    const createdAt = row.createdAt.toISOString();
    const rowHash = hashAuditPayload({
      id: row.id,
      actorEmail: row.actorEmail,
      action: row.action,
      targetId: row.targetId,
      meta,
      createdAt,
    });
    const linked = chainHash(prev, rowHash);
    const entry = {
      id: row.id,
      createdAt,
      actor: row.actorEmail,
      action: row.action,
      targetId: row.targetId,
      data: meta,
      rowHash,
      prevHash: prev,
      chainHash: linked,
    };
    prev = linked;
    return entry;
  });
  const packHash = sha256(entries.map((row) => row.chainHash).join("|") || GENESIS);
  return {
    version: AUDIT_EXPORT_VERSION,
    meta: {
      exportedAt: new Date().toISOString(),
      exportedBy: input.exportedBy,
      source: "admin_audit" as const,
      certified: false as const,
      note: AUDIT_EXPORT_NOTE,
    },
    count: entries.length,
    packHash,
    entries,
  };
}
