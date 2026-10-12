import { z } from "zod";
import { operationalPreviewSchema } from "./preview-schema";
import type { ExportSheet } from "@/lib/xlsx";
import { formatMoney } from "@/lib/money";
const money = z
  .string()
  .regex(/^-?\d+(?:\.0+)?$/)
  .transform((v) => v.split(".")[0]);
export const finalReportSchema = z.object({
  status: z.string(),
  snapshot: z.boolean(),
  totals: operationalPreviewSchema.shape.totals,
  budget_count: z.number().int().min(0),
  page: z.number().int().min(1),
  budgets: z.array(
    z.object({
      id: z.uuid(),
      brand: z.string(),
      season: z.string().nullable(),
      customer: z.string(),
      period_start: z.string(),
      period_end: z.string(),
      budget_cents: money,
      imported_cents: money,
      previous_season: z.string().nullable(),
      sold_cents: money.nullable(),
      difference_cents: money.nullable(),
      difference_pct: z.string().nullable(),
    }),
  ),
});
export type FinalReport = z.infer<typeof finalReportSchema>;
export function finalReportSheets(
  report: FinalReport,
  t: (key: string) => string,
): ExportSheet[] {
  const amount = (v: string | null) =>
    v === null ? t("notComparable") : formatMoney(BigInt(v));
  return [
    {
      name: t("brandTotals"),
      fields: [
        t("fields.brand"),
        t("fields.season"),
        t("entities.orders"),
        t("entities.customers"),
        t("fields.quantity"),
        t("operationalNet"),
        t("operationalGross"),
      ],
      rows: report.totals.map((g) => [
        g.brand,
        g.season,
        g.orders,
        g.customers,
        g.pieces,
        amount(g.net_cents),
        amount(g.gross_cents),
      ]),
    },
    {
      name: t("comparison"),
      fields: [
        t("fields.brand"),
        t("fields.season"),
        t("fields.customer"),
        t("fields.period_start"),
        t("fields.period_end"),
        t("fields.amount_cents"),
        t("importedNet"),
        t("previousSeason"),
        t("previousSold"),
        t("differenceAmount"),
        t("differencePercent"),
      ],
      rows: report.budgets.map((b) => [
        b.brand,
        b.season ?? t("notSpecified"),
        b.customer || t("allCustomers"),
        b.period_start,
        b.period_end,
        amount(b.budget_cents),
        amount(b.imported_cents),
        b.previous_season ?? t("notComparable"),
        amount(b.sold_cents),
        amount(b.difference_cents),
        b.difference_pct === null
          ? t("notComparable")
          : `${b.difference_pct.replace(".", ",")}%`,
      ]),
    },
    {
      name: t("summary"),
      fields: [t("status"), t("reportBasis")],
      rows: [
        [
          t(`statuses.${report.status}`),
          t(report.snapshot ? "reportSnapshot" : "reportDraft"),
        ],
      ],
    },
  ];
}
