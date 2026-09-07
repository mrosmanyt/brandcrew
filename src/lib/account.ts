import { z } from "zod";

export const accountPatchSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    email: z.string().email().optional(),
    name: z.string().min(1).max(80).optional(),
    newPassword: z.string().min(8).max(72).optional(),
  })
  .refine((body) => Boolean(body.email || body.name || body.newPassword), {
    message: "Change email, name, or password.",
  });

export type AccountPatch = z.infer<typeof accountPatchSchema>;
