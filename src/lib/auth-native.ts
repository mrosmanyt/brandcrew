/**
 * Native / extension auth: refresh tokens + one-time connect tickets.
 * Web login still uses setSessionCookie only — these helpers are additive.
 */
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, ForbiddenError } from "@/lib/auth";
import {
  ACCESS_TOKEN_TTL_SEC,
  CONNECT_TICKET_TTL_MS,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_MS,
  connectApproveUrl,
  desktopDeepLink,
  isConnectSurface,
  parseConnectNonce,
  type AuthSurface,
  type ConnectSurface,
} from "@/lib/auth-bridge";
import { encryptSecret, decryptSecret, appOrigin } from "@/lib/crypto-secret";
import { generateDeviceToken, serializeDevice } from "@/lib/device-auth";
import { ClientError } from "@/lib/http";

export const NATIVE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Cinem-Client, X-Cinem-Native-Host, X-Cinem-Device-Token",
  "Access-Control-Max-Age": "86400",
};

export function withNativeCors(response: NextResponse) {
  for (const [key, value] of Object.entries(NATIVE_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function nativeCorsPreflight() {
  return new NextResponse(null, { status: 204, headers: NATIVE_CORS_HEADERS });
}

export function isNativeCorsPath(segments: string[]) {
  if (segments[0] === "api" && segments[1] === "device") return true;
  const path = segments.join("/");
  if (path === "api/cinem-ai-assistant/usage") return true;
  if (path === "api/downloads/cinem-ai-assistant") return true;
  return (
    path === "api/auth/token" ||
    path === "api/auth/refresh" ||
    path === "api/auth/revoke" ||
    path === "api/auth/me" ||
    path === "api/auth/connect" ||
    path === "api/auth/connect/approve" ||
    path === "api/auth/connect/claim" ||
    path === "api/auth/login" ||
    path === "api/auth/google"
  );
}

export function hashRefreshToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken() {
  const token = `${REFRESH_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  return { token, tokenHash: hashRefreshToken(token) };
}

async function assertWorkspaceMember(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) {
    throw new ForbiddenError("You do not have access to this workspace.");
  }
  return member;
}

export function readCinemClient(request: Request): AuthSurface {
  const header = (request.headers.get("x-cinem-client") || "").trim().toLowerCase();
  if (header === "assistant") return "desktop";
  if (header === "desktop" || header === "mobile" || header === "extension") return header;
  if (header === "web") return "web";
  return "web";
}

export function wantsNativeTokens(request: Request, body?: { tokens?: unknown }) {
  if (body?.tokens === true) return true;
  const client = readCinemClient(request);
  return client === "desktop" || client === "mobile" || client === "extension";
}

export async function issueNativeSession(input: {
  userId: string;
  surface: AuthSurface;
  deviceName?: string;
}) {
  const accessToken = await createSessionToken(input.userId);
  const refresh = generateRefreshToken();
  await prisma.authRefreshToken.create({
    data: {
      userId: input.userId,
      tokenHash: refresh.tokenHash,
      surface: input.surface,
      deviceName: (input.deviceName || input.surface).slice(0, 80),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true },
  });
  return {
    tokenType: "Bearer" as const,
    accessToken,
    refreshToken: refresh.token,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    user,
  };
}

export async function rotateRefreshToken(raw: string, surface?: AuthSurface) {
  if (!raw.startsWith(REFRESH_TOKEN_PREFIX)) {
    throw new ClientError("Invalid refresh token.", 401, "invalid_refresh");
  }
  const tokenHash = hashRefreshToken(raw);
  const row = await prisma.authRefreshToken.findUnique({ where: { tokenHash } });
  if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
    throw new ClientError("Refresh token is expired or revoked. Sign in again.", 401, "invalid_refresh");
  }
  await prisma.authRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date(), lastUsedAt: new Date() },
  });
  return issueNativeSession({
    userId: row.userId,
    surface: surface || (row.surface as AuthSurface) || "desktop",
    deviceName: row.deviceName,
  });
}

export async function revokeRefreshToken(raw: string) {
  if (!raw.startsWith(REFRESH_TOKEN_PREFIX)) return { ok: true as const, revoked: false };
  const tokenHash = hashRefreshToken(raw);
  const row = await prisma.authRefreshToken.findUnique({ where: { tokenHash } });
  if (!row || row.revokedAt) return { ok: true as const, revoked: false };
  await prisma.authRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true as const, revoked: true };
}

export async function revokeAllRefreshTokens(userId: string) {
  await prisma.authRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

type ConnectPayload =
  | {
      type: "device";
      token: string;
      workspaceId: string;
      deviceId: string;
      name: string;
    }
  | {
      type: "session";
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      workspaceId: string | null;
      user: { id: string; email: string; name: string };
    };

function encodePayload(payload: ConnectPayload) {
  return encryptSecret(JSON.stringify(payload));
}

function decodePayload(enc: string | null): ConnectPayload | null {
  if (!enc) return null;
  try {
    const parsed = JSON.parse(decryptSecret(enc)) as ConnectPayload;
    if (parsed?.type === "device" || parsed?.type === "session") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function generateConnectNonce() {
  return randomBytes(16).toString("hex");
}

export async function startConnectTicket(input: {
  nonce?: string | null;
  surface: string;
  deviceName?: string;
}) {
  if (!isConnectSurface(input.surface)) {
    throw new ClientError("surface must be extension, desktop, or mobile.");
  }
  const nonce = parseConnectNonce(input.nonce) || generateConnectNonce();
  const existing = await prisma.authConnectTicket.findUnique({ where: { nonce } });
  if (existing) {
    if (existing.status === "claimed" || existing.expiresAt.getTime() < Date.now()) {
      throw new ClientError("That connect code was already used. Start again.", 409, "nonce_used");
    }
    return existing;
  }
  return prisma.authConnectTicket.create({
    data: {
      nonce,
      surface: input.surface,
      deviceName: (input.deviceName || input.surface).slice(0, 80),
      expiresAt: new Date(Date.now() + CONNECT_TICKET_TTL_MS),
      status: "pending",
    },
  });
}

export async function approveConnectTicket(input: {
  nonce: string;
  userId: string;
  workspaceId?: string | null;
  deviceName?: string;
}) {
  const nonce = parseConnectNonce(input.nonce);
  if (!nonce) throw new ClientError("Invalid connect code.");
  const ticket = await prisma.authConnectTicket.findUnique({ where: { nonce } });
  if (!ticket || ticket.expiresAt.getTime() < Date.now()) {
    throw new ClientError("That sign-in link expired. Start again from the app.", 410, "expired");
  }
  if (ticket.status === "claimed") {
    throw new ClientError("That sign-in link was already used.", 409, "claimed");
  }
  const surface = ticket.surface as ConnectSurface;
  const deviceName = (input.deviceName || ticket.deviceName || surface).slice(0, 80);

  if (surface === "extension") {
    if (!input.workspaceId) {
      throw new ClientError("Pick a workspace to attach this Chrome.");
    }
    await assertWorkspaceMember(input.userId, input.workspaceId);
    const generated = generateDeviceToken();
    const device = await prisma.localDevice.create({
      data: {
        workspaceId: input.workspaceId,
        name: deviceName || "Chrome",
        tokenHash: generated.tokenHash,
        status: "online",
        lastSeenAt: new Date(),
        linkedUserId: input.userId,
        capabilities: JSON.stringify(["debugger"]),
      },
    });
    const payload: ConnectPayload = {
      type: "device",
      token: generated.token,
      workspaceId: device.workspaceId,
      deviceId: device.id,
      name: device.name,
    };
    const updated = await prisma.authConnectTicket.update({
      where: { id: ticket.id },
      data: {
        status: "approved",
        userId: input.userId,
        workspaceId: input.workspaceId,
        deviceName: device.name,
        payloadEnc: encodePayload(payload),
      },
    });
    return { ticket: updated, device: serializeDevice(device), surface };
  }

  const session = await issueNativeSession({
    userId: input.userId,
    surface,
    deviceName,
  });
  if (!session.user) throw new ClientError("Account not found.", 401);
  let workspaceId = input.workspaceId || null;
  if (workspaceId) await assertWorkspaceMember(input.userId, workspaceId);
  const payload: ConnectPayload = {
    type: "session",
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    workspaceId,
    user: session.user,
  };
  const updated = await prisma.authConnectTicket.update({
    where: { id: ticket.id },
    data: {
      status: "approved",
      userId: input.userId,
      workspaceId,
      deviceName,
      payloadEnc: encodePayload(payload),
    },
  });
  return { ticket: updated, session, surface };
}

export async function claimConnectTicket(nonceRaw: string) {
  const nonce = parseConnectNonce(nonceRaw);
  if (!nonce) throw new ClientError("Invalid connect code.");
  const ticket = await prisma.authConnectTicket.findUnique({ where: { nonce } });
  if (!ticket) {
    return { status: "unknown" as const };
  }
  if (ticket.expiresAt.getTime() < Date.now()) {
    return { status: "expired" as const };
  }
  if (ticket.status === "pending") {
    return { status: "pending" as const, surface: ticket.surface };
  }
  if (ticket.status === "claimed") {
    return { status: "claimed" as const };
  }
  const payload = decodePayload(ticket.payloadEnc);
  if (!payload) throw new ClientError("Connect payload is unreadable. Start again.", 500);
  await prisma.authConnectTicket.update({
    where: { id: ticket.id },
    data: {
      status: "claimed",
      claimedAt: new Date(),
      payloadEnc: null,
    },
  });
  return { status: "approved" as const, surface: ticket.surface, payload };
}

export function connectLinks(origin: string, surface: ConnectSurface, nonce: string) {
  const base = origin.replace(/\/$/, "") || appOrigin();
  return {
    approveUrl: connectApproveUrl(base, surface, nonce),
    desktopLink: surface === "desktop" ? desktopDeepLink(nonce, base) : null,
  };
}
