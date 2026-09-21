import { z } from "zod";
import {
  assertStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-rules";

export const accountPatchSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    email: z.string().email().optional(),
    name: z.string().min(1).max(80).optional(),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).optional(),
    analyticsOptIn: z.boolean().optional(),
  })
  .refine(
    (body) =>
      Boolean(body.email || body.name || body.newPassword || typeof body.analyticsOptIn === "boolean"),
    {
      message: "Change email, name, password, or analytics preference.",
    },
  )
  .superRefine((body, ctx) => {
    if (!body.newPassword) return;
    const weak = assertStrongPassword(body.newPassword, body.email);
    if (weak) {
      ctx.addIssue({ code: "custom", message: weak, path: ["newPassword"] });
    }
  });

export type AccountPatch = z.infer<typeof accountPatchSchema>;
