import type { PerformanceFilters, PerformanceReport } from "./report-schema";
import { performanceMetrics, comparePerformance } from "./performance";
import { formatMoney, centsToDecimal } from "@/lib/money";
import type { ExportSheet } from "@/lib/xlsx";
export function performanceSheets(
  report: PerformanceReport,
  filters: PerformanceFilters,
  t: (key: string) => string,
): ExportSheet[] {
  const money = (v: string | null) =>
    v === null ? t("missingValue") : formatMoney(BigInt(v));
  const dimensions = t(`dimensions.${filters.dimension}`);
  const headers = [
    dimensions,
    t("sourceRows"),
    t("namedCustomers"),
    ...performanceMetrics.map((m) => t(`metrics.${m.key}`)),
  ];
  return [
    {
      name: t("summary"),
      fields: [t("indicator"), t("calculated")],
      rows: performanceMetrics.map((m) => [
        t(`metrics.${m.key}`),
        money(report.totals[m.key]),
      ]),
    },
    {
      name: t("aggregation"),
      fields: headers,
      rows: report.groups.map((g) => [
        g.label || t("notSpecified"),
        g.rows,
        g.customers,
        ...performanceMetrics.map((m) => money(g[m.key])),
      ]),
    },
    {
      name: t("comparison"),
      fields: [
        dimensions,
        t("differenceFw26"),
        t("differencePercentFw26"),
        t("differenceSs27"),
        t("differencePercentSs27"),
      ],
      rows: report.groups.map((g) => {
        const a = comparePerformance(g.orders_fw26, g.budget_fw26),
          b = comparePerformance(g.orders_ss27, g.budget_ss27);
        return [
          g.label || t("notSpecified"),
          a.amount === null ? t("missingValue") : formatMoney(a.amount),
          a.percent === null
            ? t("notComparable")
            : `${centsToDecimal(a.percent)}%`,
          b.amount === null ? t("missingValue") : formatMoney(b.amount),
          b.percent === null
            ? t("notComparable")
            : `${centsToDecimal(b.percent)}%`,
        ];
      }),
    },
    {
      name: t("filters"),
      fields: [t("indicator"), t("calculated")],
      rows: [
        [t("file"), report.file_name],
        [t("scope"), t(filters.scope === "pivot" ? "pivotScope" : "allBrands")],
        [t("groupBy"), dimensions],
        ...["brand", "area", "representative", "country", "region"].map((k) => [
          t(`dimensions.${k}`),
          filters[k as "brand"] || t("all"),
        ]),
        [t("search"), filters.search || t("all")],
        [t("pivotBrands"), report.pivotBrands.join(", ")],
      ],
    },
  ];
}
