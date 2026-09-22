import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const MAX_REQUESTS_PER_DAY = 500; // same crude abuse guard as the funnel/crash-report beacons

const postSchema = z.object({
  name: z.string().min(1).max(120),
  note: z.string().max(2000).optional(),
  anonId: z.string().max(80).optional(),
});

/** A visitor asking sales to follow up after WhatsApp contact. Logs the funnel's last automatic stage — "approved" is set by hand in Admin once a sale closes. */
export async function POST(request: Request) {
  try {
    const body = postSchema.parse(await request.json());
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const countToday = await prisma.purchaseRequest.count({ where: { createdAt: { gte: since } } });
    if (countToday >= MAX_REQUESTS_PER_DAY) {
      return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    }
    const row = await prisma.purchaseRequest.create({
      data: {
        name: body.name.trim(),
        note: (body.note || "").trim().slice(0, 2000),
        anonId: (body.anonId || "").trim().slice(0, 80),
      },
    });
    return jsonOk({ id: row.id }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
