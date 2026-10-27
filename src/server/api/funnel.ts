import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const FUNNEL_KINDS = ["site_visit", "whatsapp_click"] as const;
const MAX_EVENTS_PER_DAY = 20_000; // crude abuse guard on a public, unauthenticated beacon

const postSchema = z.object({
  kind: z.enum(FUNNEL_KINDS),
  anonId: z.string().min(1).max(80),
  path: z.string().max(200).optional(),
});

/**
 * Anonymous funnel beacon — no auth, no cookies, no IP/UA stored. anonId is
 * a client-generated random id (localStorage), only ever used to dedupe
 * "same visitor across two events," never to identify anyone.
 */
export async function POST(request: Request) {
  try {
    const body = postSchema.parse(await request.json());
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const countToday = await prisma.funnelEvent.count({ where: { createdAt: { gte: since } } });
    if (countToday >= MAX_EVENTS_PER_DAY) {
      return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    }
    await prisma.funnelEvent.create({
      data: {
        kind: body.kind,
        anonId: body.anonId,
        path: (body.path || "").slice(0, 200),
      },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "kind and anonId are required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
