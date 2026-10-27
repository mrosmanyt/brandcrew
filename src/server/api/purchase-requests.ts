import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  name: z.string().min(1).max(120),
  note: z.string().max(2000).optional(),
  anonId: z.string().max(80).optional(),
});

/** A visitor asking sales to follow up after WhatsApp contact. Logs the funnel's last automatic stage — "approved" is set by hand in Admin once a sale closes. */
export async function POST(request: Request) {
  try {
    const body = postSchema.parse(await request.json());
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
