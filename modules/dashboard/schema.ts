import { z } from "zod";
const optionalId = z.uuid().or(z.literal("")).default("");
const date = z.iso.date().or(z.literal("")).default("");
export const dashboardFiltersSchema = z
  .object({ brand_id: optionalId, season_id: optionalId, from: date, to: date })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "dateRange",
  });
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
const cents = z.string().regex(/^-?\d+$/),
  nonnegative = cents.refine((value) => BigInt(value) >= 0n);
export const dashboardReportSchema = z.object({
  sold_cents: nonnegative,
  revenue_cents: nonnegative,
  order_count: z.number().int().nonnegative(),
  invoice_count: z.number().int().nonnegative(),
  budget_count: z.number().int().nonnegative(),
  trend_month_count: z.number().int().nonnegative(),
  trend: z
    .array(z.object({ month: z.iso.date(), net_cents: nonnegative }))
    .max(120),
  customers: z
    .array(
      z.object({
        brand_id: z.uuid(),
        customer_id: z.uuid(),
        name: z.string().nullable(),
        city: z.string().nullable(),
        net_cents: nonnegative,
        order_count: z.number().int().nonnegative(),
      }),
    )
    .max(10),
  budgets: z
    .array(
      z.object({
        id: z.uuid(),
        brand_id: z.uuid(),
        season_id: z.uuid().nullable(),
        customer_id: z.uuid().nullable(),
        budget_cents: nonnegative,
        sold_cents: nonnegative,
        revenue_cents: nonnegative,
        period_start: z.iso.date(),
        period_end: z.iso.date(),
        difference_cents: cents,
        difference_pct: z.string().nullable(),
        brand_name: z.string().nullable(),
        season_code: z.string().nullable(),
        customer_name: z.string().nullable(),
      }),
    )
    .max(50),
});
export type DashboardReport = z.infer<typeof dashboardReportSchema>;
export function chartCents(value: string): number | null {
  const exact = BigInt(value);
  return exact >= 0n && exact <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(exact)
    : null;
}
