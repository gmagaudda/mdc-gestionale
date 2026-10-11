import { z } from "zod";
export const emailSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
});
export const loginSchema = emailSchema.extend({
  password: z.string().min(1).max(128),
});
export const passwordSchema = z
  .object({ password: z.string().min(10).max(128), confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });
