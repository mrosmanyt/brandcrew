/**
 * AI Photo Studio sharing — opt-in public share links for generated images.
 *
 * A share token is a capability: anyone holding `/share/image/<token>` can
 * view that one image, and nobody can enumerate tokens (192-bit random).
 * Tokens are created only by the image's owner, are stable per image
 * (create returns the existing token), and can be revoked by the owner,
 * which immediately 404s the public page and the raw image route.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export type SharedImage = {
  imageData: string | null;
  mediaUrl: string;
  mimeType: string;
  prompt: string;
};

function newShareToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Return the image's share token, creating one on first use. Owner-only:
 * the history row must belong to `userId`. Returns null when the row does
 * not exist or belongs to someone else.
 */
export async function createOrGetShareToken(
  userId: string,
  uuid: string,
): Promise<string | null> {
  const row = await prisma.imageGenAsyncResult.findUnique({
    where: { uuid },
    select: { userId: true, shareToken: true, status: true },
  });
  if (!row || row.userId !== userId || row.status !== 2) return null;
  if (row.shareToken) return row.shareToken;
  // One retry covers the (astronomically unlikely) unique-token collision.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = newShareToken();
    try {
      await prisma.imageGenAsyncResult.update({
        where: { uuid },
        data: { shareToken: token },
      });
      return token;
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

/** Revoke an image's share token. Owner-only. Returns false for non-owners. */
export async function revokeShareToken(
  userId: string,
  uuid: string,
): Promise<boolean> {
  const row = await prisma.imageGenAsyncResult.findUnique({
    where: { uuid },
    select: { userId: true },
  });
  if (!row || row.userId !== userId) return false;
  await prisma.imageGenAsyncResult.update({
    where: { uuid },
    data: { shareToken: null },
  });
  return true;
}

/**
 * Resolve a public share token to its image. No auth — the token is the
 * capability. Expired or unfinished rows resolve to null.
 */
export async function getSharedImage(
  token: string,
): Promise<SharedImage | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const row = await prisma.imageGenAsyncResult.findUnique({
    where: { shareToken: token },
    select: {
      imageData: true,
      mediaUrl: true,
      mimeType: true,
      prompt: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!row || row.status !== 2) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.imageData && !row.mediaUrl) return null;
  return {
    imageData: row.imageData,
    mediaUrl: row.mediaUrl,
    mimeType: row.mimeType || "image/png",
    prompt: row.prompt,
  };
}
