import { email, object, string } from "zod";
export const emailSchema = object({
  email: email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
});
export const loginSchema = emailSchema.extend({
  password: string().min(1).max(128),
});
export const passwordSchema = object({
  password: string().min(10).max(128),
  confirm: string(),
}).refine((value) => value.password === value.confirm, {
  path: ["confirm"],
  message: "mismatch",
});
