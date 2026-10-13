import { z } from "zod";
import { dashboardReportSchema } from "@/modules/dashboard/schema";
import { dashboardFiltersSchema } from "@/modules/dashboard/schema";
import { orderStatuses } from "@/modules/orders/schema";
export { dashboardFiltersSchema as portalFiltersSchema } from "@/modules/dashboard/schema";
export const portalDashboardSchema = z
  .object({
    sold_cents: z.string().regex(/^\d+$/),
    order_count: z.number().int().nonnegative(),
    budget_count: z.number().int().nonnegative(),
    budgets: z
      .array(
        dashboardReportSchema.shape.budgets.element.omit({
          revenue_cents: true,
        }),
      )
      .max(50),
  })
  .strict();
export type PortalDashboard = z.infer<typeof portalDashboardSchema>;
export const portalOrderFiltersSchema = dashboardFiltersSchema.safeExtend({
  status: z.enum(orderStatuses).or(z.literal("")).default(""),
});
export const portalOrderSchema = z
  .object({
    id: z.uuid(),
    number: z.string(),
    brand_id: z.uuid(),
    season_id: z.uuid(),
    status: z.enum(orderStatuses),
    order_date: z.iso.date(),
    delivery_date: z.iso.date().nullable(),
    currency: z.literal("EUR"),
    net_total_cents: z.number().int().nonnegative().safe(),
    vat_total_cents: z.number().int().nonnegative().safe(),
    gross_total_cents: z.number().int().nonnegative().safe(),
    customer_display_name: z.string(),
    customer_city: z.string(),
    brand_name: z.string(),
    season_code: z.string(),
  })
  .strict();
export const portalOrdersSchema = z
  .object({
    count: z.number().int().nonnegative(),
    rows: z.array(portalOrderSchema).max(10000),
  })
  .strict();
export const portalSalesSchema = z
  .object({
    count: z.number().int().nonnegative(),
    sold_cents: z.string().regex(/^\d+$/),
    rows: z
      .array(
        z
          .object({
            brand_id: z.uuid(),
            customer_id: z.uuid(),
            season_id: z.uuid(),
            brand_name: z.string(),
            season_code: z.string(),
            customer_display_name: z.string(),
            customer_city: z.string(),
            net_cents: z.string().regex(/^\d+$/),
            order_count: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict();

export const portalOrdersSortSchema = z.object({
  sort: z
    .enum([
      "order_date",
      "number",
      "brand_name",
      "season_code",
      "customer_display_name",
      "customer_city",
      "status",
      "net_total_cents",
    ])
    .default("order_date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export const portalSalesSortSchema = z.object({
  sort: z
    .enum([
      "net_cents",
      "brand_name",
      "season_code",
      "customer_display_name",
      "customer_city",
      "order_count",
    ])
    .default("net_cents"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
