import { prisma } from "@/lib/db";

export type ApplyPaidSupportInput = {
  amountCents: number;
  userId?: string | null;
  workspaceId?: string | null;
  email?: string | null;
  paymentId?: string | null;
  provider: string;
};

export async function applyPaidSupport(
  input: ApplyPaidSupportInput,
): Promise<{ outcome: "supported" | "duplicate" }> {
  const now = new Date();
  const paymentId = input.paymentId?.trim() || null;
  if (paymentId) {
    const existing = await prisma.brandSupport.findUnique({
      where: { paymentId },
      select: { id: true, status: true },
    });
    if (existing?.status === "paid") return { outcome: "duplicate" };
  }

  const userId = input.userId?.trim() || null;
  const workspaceId = input.workspaceId?.trim() || null;
  const email = (input.email || "").trim().toLowerCase();
  const amountCents = Math.max(0, Math.round(input.amountCents));

  await prisma.$transaction(async (tx) => {
    if (paymentId) {
      const existing = await tx.brandSupport.findUnique({
        where: { paymentId },
        select: { id: true, status: true },
      });
      if (existing?.status === "paid") return;
      if (existing) {
        await tx.brandSupport.update({
          where: { id: existing.id },
          data: {
            status: "paid",
            paidAt: now,
            amountCents,
            userId,
            workspaceId,
            email,
            provider: input.provider,
          },
        });
      } else {
        await tx.brandSupport.create({
          data: {
            amountCents,
            userId,
            workspaceId,
            email,
            paymentId,
            status: "paid",
            provider: input.provider,
            paidAt: now,
          },
        });
      }
    } else {
      await tx.brandSupport.create({
        data: {
          amountCents,
          userId,
          workspaceId,
          email,
          status: "paid",
          provider: input.provider,
          paidAt: now,
        },
      });
    }

    if (userId) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (user) {
        await tx.user.update({
          where: { id: userId },
          data: {
            supporter: true,
            supporterAt: now,
            supporterTotalCents: { increment: amountCents },
          },
        });
      }
    }

    if (workspaceId) {
      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
      if (workspace) {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            supporter: true,
            supporterAt: now,
            supporterTotalCents: { increment: amountCents },
          },
        });
      }
    }
  });

  return { outcome: "supported" };
}
