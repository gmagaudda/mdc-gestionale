import { formatMoney } from "@/lib/money";
import type { ExportSheet } from "@/lib/xlsx";
import type { CommissionsReport } from "./schema";
import type { DashboardFilters } from "@/modules/dashboard/schema";
export function commissionSheets(
  report: CommissionsReport,
  t: (key: string) => string,
  filters: DashboardFilters,
): ExportSheet[] {
  return [
    {
      name: t("filters"),
      fields: [t("filter"), t("value")],
      rows: [
        [t("brand"), filters.brand_id || t("all")],
        [t("season"), filters.season_id || t("all")],
        [t("from"), filters.from || t("all")],
        [t("to"), filters.to || t("all")],
      ],
    },
    {
      name: t("byBrand"),
      fields: [
        t("brand"),
        t("net"),
        t("total"),
        t("netCents"),
        t("commissionCents"),
        t("orders"),
      ],
      rows: report.brands.map((r) => [
        r.brand_name,
        formatMoney(BigInt(r.net_cents)),
        formatMoney(BigInt(r.commission_cents)),
        r.net_cents,
        r.commission_cents,
        r.order_count,
      ]),
    },
    {
      name: t("orders"),
      fields: [
        t("number"),
        t("date"),
        t("brand"),
        t("rate"),
        t("source"),
        t("net"),
        t("total"),
        t("netCents"),
        t("commissionCents"),
      ],
      rows: report.orders.map((r) => [
        r.number,
        r.order_date,
        r.brand_name,
        r.commission_pct,
        t(r.has_override ? "override" : "brandRate"),
        formatMoney(BigInt(r.net_cents)),
        formatMoney(BigInt(r.commission_cents)),
        r.net_cents,
        r.commission_cents,
      ]),
    },
    {
      name: t("summary"),
      fields: [t("netCents"), t("commissionCents"), t("orders")],
      rows: [[report.net_cents, report.commission_cents, report.order_count]],
    },
  ];
}
