import { z } from "zod";
import { dashboardReportSchema } from "@/modules/dashboard/schema";
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
