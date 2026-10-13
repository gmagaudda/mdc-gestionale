import { z } from "zod";
export const metricEntities = [
  "orders",
  "customers",
  "brands",
  "seasons",
  "products",
  "budgets",
  "documents",
  "invoices",
  "commissions",
  "settings/users",
  "settings/audit",
  "imports",
  "portal/orders",
  "portal/sales",
  "portal/documents",
] as const;
export const metricEntitySchema = z.enum(metricEntities);
const integer = z.string().regex(/^-?\d+$/);
const period = z.object({ value: integer, previous: integer });
export const metricsSchema = z.object({
  as_of: z.iso.date(),
  basis: z.enum(["orderDate", "issueDate", "createdAt"]),
  cards: z
    .array(
      z.object({
        label: z.enum([
          "orders",
          "gross",
          "averageOrder",
          "customers",
          "cities",
          "tradeNames",
          "brands",
          "legalNames",
          "externalCodes",
          "seasons",
          "brandsCovered",
          "campaigns",
          "products",
          "averagePrice",
          "budgets",
          "budgetTotal",
          "averageBudget",
          "documents",
          "fileBytes",
          "sharedDocuments",
          "invoices",
          "invoiced",
          "outstanding",
          "net",
          "commissions",
          "users",
          "activeUsers",
          "roles",
          "events",
          "actors",
          "resources",
          "imports",
          "completedImports",
          "failedImports",
          "documentKinds",
          "averageNetOrder",
        ]),
        format: z.enum(["number", "money"]),
        periods: z.object({ "7": period, "30": period, "90": period }),
      }),
    )
    .length(3),
});
export type TableMetricData = z.infer<typeof metricsSchema>;
export function metricChange(value: string, previous: string): string | null {
  const current = BigInt(value),
    prior = BigInt(previous);
  if (prior <= 0n) return current === 0n && prior === 0n ? "0" : null;
  const difference = current - prior;
  const tenths =
    (difference * 1000n + (difference >= 0n ? prior / 2n : -prior / 2n)) /
    prior;
  const absolute = tenths < 0n ? -tenths : tenths;
  const whole = new Intl.NumberFormat("it-IT").format(absolute / 10n);
  const fraction = absolute % 10n;
  return `${tenths > 0n ? "+" : tenths < 0n ? "−" : ""}${whole}${fraction ? `,${fraction}` : ""}`;
}
