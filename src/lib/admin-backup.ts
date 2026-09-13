import { prisma } from "@/lib/db";
import { recordAdminBackupExport } from "@/lib/admin";
import { PRODUCT_NAME } from "@/lib/constants";

export const BACKUP_KIND = "cinem_pro_admin_backup";
export const BACKUP_VERSION = 1;
export const REDACTED = "[redacted]";

export const BACKUP_NOTE =
  "Point-in-time copy for a founder PC or Drive. Live truth stays on cloud Postgres (app.cinem.tech). This is not a restore image and not a self-host dump. API keys, password hashes, OAuth secrets, and raw tokens are redacted or omitted.";

const DEFAULT_AUDIT_DAYS = 90;
const DEFAULT_AUDIT_TAKE = 2_000;
const FULL_AUDIT_TAKE = 10_000;
const BILLING_TAKE = 2_000;
const JOB_TAKE = 200;

const SECRET_FIELD_RE =
  /(passwordhash|^password$|secret|tokenhash|keyhash|payloadenc|pairingcode|clientsecret|privatekey|accesstoken|refreshtoken|sessionsecret|webhooksecret|secretenc|oauth)/i;

const SECRET_VALUE_RE =
  /^(sk-|rk-|pk_live_|pk_test_|apik_|whop_|ws_|ghp_|xox[baprs]-|Bearer\s)/i;

export function isSecretFieldName(key: string): boolean {
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "haspassword") return false;
  if (
    compact === "password" ||
    compact === "passwordhash" ||
    compact === "secret" ||
    compact === "secretenc" ||
    compact === "token" ||
    compact === "tokenhash" ||
    compact === "apikey" ||
    compact === "authorization" ||
    compact === "cookie" ||
    compact === "nonce" ||
    compact === "pairingcode" ||
    compact === "payloadenc" ||
    compact === "keyhash" ||
    compact === "googleid"
  ) {
    return true;
  }
  return SECRET_FIELD_RE.test(compact);
}

export function redactSecretLikeString(value: string): string {
  if (SECRET_VALUE_RE.test(value.trim())) return REDACTED;
  return value;
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretFieldName(key)) {
        out[key] = nested == null || nested === "" ? nested : REDACTED;
        continue;
      }
      out[key] = redactSecrets(nested);
    }
    return out;
  }
  if (typeof value === "string") return redactSecretLikeString(value);
  return value;
}

export type AdminBackupCounts = {
  users: number;
  workspaces: number;
  memberships: number;
  billingEvents: number;
  webhooks: number;
  usageAggregates: number;
  productUsage: number;
  audit: number;
  flags: number;
  failedJobs: number;
  plugins: number;
  apiKeys: number;
};

export type AdminBackupPayload = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  product: typeof PRODUCT_NAME;
  note: string;
  exportedAt: string;
  exportedBy: string;
  window: {
    auditDays: number | null;
    full: boolean;
    auditTake: number;
  };
  counts: AdminBackupCounts;
  users: unknown[];
  workspaces: unknown[];
  memberships: unknown[];
  billingEvents: unknown[];
  webhooks: unknown[];
  usageAggregates: unknown[];
  productUsage: unknown[];
  audit: unknown[];
  flags: unknown[];
  failedJobs: unknown[];
  plugins: unknown[];
  apiKeys: unknown[];
};

export async function buildAdminBackup(input: {
  actorEmail: string;
  full?: boolean;
}): Promise<AdminBackupPayload> {
  const full = Boolean(input.full);
  const auditSince = full
    ? null
    : new Date(Date.now() - DEFAULT_AUDIT_DAYS * 24 * 60 * 60 * 1000);
  const auditTake = full ? FULL_AUDIT_TAKE : DEFAULT_AUDIT_TAKE;

  const [
    users,
    workspaces,
    memberships,
    supports,
    webhooks,
    usageGroups,
    productUsage,
    audit,
    flags,
    failedJobs,
    plugins,
    apiKeys,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        supporter: true,
        supporterAt: true,
        supporterTotalCents: true,
        createdAt: true,
        passwordHash: true,
      },
    }),
    prisma.workspace.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        tokenUsed: true,
        tokenBudget: true,
        chatTokenUsed: true,
        kind: true,
        clientName: true,
        whopMembershipId: true,
        supporter: true,
        supporterAt: true,
        supporterTotalCents: true,
        suspended: true,
        autoApproveSafe: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.workspaceMember.findMany({
      select: {
        workspaceId: true,
        userId: true,
        role: true,
      },
    }),
    prisma.brandSupport.findMany({
      orderBy: { createdAt: "desc" },
      take: BILLING_TAKE,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        userId: true,
        workspaceId: true,
        email: true,
        paymentId: true,
        status: true,
        provider: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.processedWebhook.findMany({
      orderBy: { createdAt: "desc" },
      take: BILLING_TAKE,
      select: {
        id: true,
        eventType: true,
        externalId: true,
        createdAt: true,
      },
    }),
    prisma.usageEvent.groupBy({
      by: ["workspaceId", "model"],
      _sum: { tokens: true },
      _count: { _all: true },
    }),
    prisma.productUsage.findMany({
      select: {
        userId: true,
        product: true,
        period: true,
        used: true,
        updatedAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      where: auditSince ? { createdAt: { gte: auditSince } } : undefined,
      orderBy: { createdAt: "desc" },
      take: auditTake,
    }),
    prisma.featureFlag.findMany({
      orderBy: { key: "asc" },
    }),
    prisma.job.findMany({
      where: { status: "failed" },
      orderBy: { updatedAt: "desc" },
      take: JOB_TAKE,
      select: {
        id: true,
        workspaceId: true,
        title: true,
        status: true,
        agentRole: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.pluginConnection.findMany({
      select: {
        workspaceId: true,
        pluginId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.apiKey.findMany({
      select: {
        workspaceId: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const safeUsers = users.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    supporter: row.supporter,
    supporterAt: row.supporterAt?.toISOString() ?? null,
    supporterTotalCents: row.supporterTotalCents,
    createdAt: row.createdAt.toISOString(),
    hasPassword: Boolean(row.passwordHash),
  }));

  const payload: AdminBackupPayload = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    product: PRODUCT_NAME,
    note: BACKUP_NOTE,
    exportedAt: new Date().toISOString(),
    exportedBy: input.actorEmail,
    window: {
      auditDays: full ? null : DEFAULT_AUDIT_DAYS,
      full,
      auditTake,
    },
    counts: {
      users: safeUsers.length,
      workspaces: workspaces.length,
      memberships: memberships.length,
      billingEvents: supports.length,
      webhooks: webhooks.length,
      usageAggregates: usageGroups.length,
      productUsage: productUsage.length,
      audit: audit.length,
      flags: flags.length,
      failedJobs: failedJobs.length,
      plugins: plugins.length,
      apiKeys: apiKeys.length,
    },
    users: safeUsers,
    workspaces: workspaces.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      supporterAt: row.supporterAt?.toISOString() ?? null,
    })),
    memberships,
    billingEvents: supports.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
    })),
    webhooks: webhooks.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    usageAggregates: usageGroups.map((row) => ({
      workspaceId: row.workspaceId,
      model: row.model,
      tokens: row._sum.tokens ?? 0,
      events: row._count._all,
    })),
    productUsage: productUsage.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    })),
    audit: audit.map((row) => ({
      id: row.id,
      actorEmail: row.actorEmail,
      action: row.action,
      targetId: row.targetId,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
    })),
    flags: flags.map((row) => ({
      key: row.key,
      enabled: row.enabled,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    })),
    failedJobs: failedJobs.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      title: row.title,
      status: row.status,
      agentRole: row.agentRole,
      error: row.error.slice(0, 400),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    plugins,
    apiKeys: apiKeys.map((row) => ({
      workspaceId: row.workspaceId,
      name: row.name,
      prefix: row.prefix,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };

  const redacted = redactSecrets(payload) as AdminBackupPayload;
  await recordAdminBackupExport({
    actorEmail: input.actorEmail,
    counts: redacted.counts,
    full,
  });
  return redacted;
}

export function backupFilename(exportedAt = new Date()): string {
  const day = exportedAt.toISOString().slice(0, 10);
  return `cinem-pro-backup-${day}.json`;
}
