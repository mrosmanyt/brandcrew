import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { honeypotFilled } from "@/lib/form-guard";
import { jsonError } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  company_url: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    if (honeypotFilled(raw)) {
      return NextResponse.json({ error: "Could not complete that request." }, { status: 400 });
    }
    const body = schema.parse(raw);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses Google. Continue with Google." },
        { status: 401 },
      );
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }
    await setSessionCookie(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter email and password." }, { status: 400 });
    }
    return jsonError(error);
  }
}
