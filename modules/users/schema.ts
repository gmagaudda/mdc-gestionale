import {
  array,
  boolean,
  email,
  enum as enumSchema,
  type infer as Infer,
  object,
  string,
  uuid,
} from "zod";
export const userSchema = object({
  full_name: string().trim().min(1).max(200),
  role: enumSchema(["admin", "staff", "accounting", "brand"]),
  is_active: boolean(),
  brand_ids: array(uuid())
    .max(100)
    .refine((values) => new Set(values).size === values.length),
}).refine((value) => value.role === "brand" || !value.brand_ids.length, {
  path: ["brand_ids"],
});
export const inviteSchema = userSchema
  .safeExtend({
    email: email()
      .max(254)
      .transform((value) => value.toLowerCase()),
  })
  .refine((value) => value.role !== "brand" || value.brand_ids.length > 0, {
    path: ["brand_ids"],
  });
export type UserValues = Infer<typeof userSchema>;
