import { z } from "zod";
export { dashboardFiltersSchema as commissionsFiltersSchema } from "@/modules/dashboard/schema";
const cents = z.string().regex(/^\d+$/);
export const commissionOrderSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  brand_id: z.uuid(),
  brand_name: z.string(),
  season_id: z.uuid(),
  order_date: z.iso.date(),
  net_cents: cents,
  commission_cents: cents,
  commission_pct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .refine((v) => Number(v) <= 100),
  has_override: z.boolean(),
});
export const commissionsReportSchema = z.object({
  net_cents: cents,
  commission_cents: cents,
  order_count: z.number().int().nonnegative(),
  brand_count: z.number().int().nonnegative(),
  brands: z
    .array(
      z.object({
        brand_id: z.uuid(),
        brand_name: z.string(),
        order_count: z.number().int().nonnegative(),
        net_cents: cents,
        commission_cents: cents,
      }),
    )
    .max(500),
  orders: z.array(commissionOrderSchema).max(10000),
});
export type CommissionsReport = z.infer<typeof commissionsReportSchema>;
