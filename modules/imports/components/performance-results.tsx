"use client";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/shared/data-table";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { formatMoney, centsToDecimal } from "@/lib/money";
import {
  performanceMetrics,
  comparePerformance,
  type PerformanceMetric,
} from "../performance";
export type PerformanceGroup = {
  label: string;
  rows: number;
  customers: number;
} & Record<PerformanceMetric, string | null>;
export function PerformanceResults({
  groups,
  totals,
  count,
  dimension,
}: {
  groups: PerformanceGroup[];
  totals: Record<PerformanceMetric, string | null> & { rows: number };
  count: number;
  dimension: string;
}) {
  const t = useTranslations("imports");
  const money = (value: string | null) =>
    value === null ? t("missingValue") : formatMoney(BigInt(value));
  const rows = groups.map((g) => ({
    id: `group-${g.label}`,
    label: g.label || t("notSpecified"),
    rows: g.rows,
    customers: g.customers,
    ...Object.fromEntries(
      performanceMetrics.map((m) => [m.key, money(g[m.key])]),
    ),
  }));
  const comparisons = groups.map((g) => {
    const a = comparePerformance(g.orders_fw26, g.budget_fw26),
      b = comparePerformance(g.orders_ss27, g.budget_ss27);
    return {
      id: `comparison-${g.label}`,
      label: g.label || t("notSpecified"),
      fw26: a.amount === null ? t("missingValue") : formatMoney(a.amount),
      fw26_pct:
        a.percent === null
          ? t("notComparable")
          : `${centsToDecimal(a.percent)}%`,
      ss27: b.amount === null ? t("missingValue") : formatMoney(b.amount),
      ss27_pct:
        b.percent === null
          ? t("notComparable")
          : `${centsToDecimal(b.percent)}%`,
    };
  });
  return (
    <>
      <section className="stack" aria-label={t("summary")}>
        <h2>{t("summary")}</h2>
        <dl className="report-metrics">
          {performanceMetrics.map((m) => (
            <div key={m.key}>
              <dt>{t(`metrics.${m.key}`)}</dt>
              <dd className="report-value">
                {totals[m.key] === null ? (
                  t("missingValue")
                ) : (
                  <AnimatedMoney cents={BigInt(totals[m.key]!)} />
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p>{t("rowCount", { count: totals.rows })}</p>
      </section>
      <section className="stack" aria-label={t("aggregation")}>
        <h2>{t("aggregation")}</h2>
        <p>{t("shownGroups", { shown: groups.length, total: count })}</p>
        <DataTable
          caption={t("aggregation")}
          rows={rows}
          emptyMessage={t("noResults")}
          columns={[
            { key: "label", label: t(`dimensions.${dimension}`) },
            { key: "rows", label: t("sourceRows"), numeric: true },
            { key: "customers", label: t("namedCustomers"), numeric: true },
            ...performanceMetrics.map((m) => ({
              key: m.key,
              label: t(`metrics.${m.key}`),
              numeric: true,
            })),
          ]}
        />
      </section>
      <section className="stack" aria-label={t("comparison")}>
        <h2>{t("comparison")}</h2>
        <p>{t("comparisonHint")}</p>
        <DataTable
          caption={t("comparison")}
          rows={comparisons}
          emptyMessage={t("noResults")}
          columns={[
            { key: "label", label: t(`dimensions.${dimension}`) },
            { key: "fw26", label: t("differenceFw26"), numeric: true },
            {
              key: "fw26_pct",
              label: t("differencePercentFw26"),
              numeric: true,
            },
            { key: "ss27", label: t("differenceSs27"), numeric: true },
            {
              key: "ss27_pct",
              label: t("differencePercentSs27"),
              numeric: true,
            },
          ]}
        />
      </section>
    </>
  );
}
