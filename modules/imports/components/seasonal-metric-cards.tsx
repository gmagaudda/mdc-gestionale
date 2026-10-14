"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { MoneyMetric } from "@/components/shared/money-metric";
import { formatMoney } from "@/lib/money";
import { metricChange } from "@/lib/metrics/schema";
import type { PerformanceReport } from "../report-schema";
const seasons = ["SS26", "FW26", "SS27"] as const;
type Season = (typeof seasons)[number];
function SeasonalMetric({
  kind,
  totals,
}: {
  kind: "orders" | "budget" | "difference";
  totals: PerformanceReport["totals"];
}) {
  const t = useTranslations("tableMetrics");
  const [season, setSeason] = useState<Season>("SS27");
  const orders =
    season === "SS26"
      ? totals.orders_ss26
      : season === "FW26"
        ? totals.orders_fw26
        : totals.orders_ss27;
  const budget =
    season === "SS26"
      ? null
      : season === "FW26"
        ? totals.budget_fw26
        : totals.budget_ss27;
  const amount =
    kind === "orders"
      ? orders
      : kind === "budget"
        ? budget
        : orders === null || budget === null
          ? null
          : (BigInt(orders) - BigInt(budget)).toString();
  const label = t(`seasonal.${kind}`);
  const previous =
    kind === "orders" && season === "SS27" ? totals.orders_ss26 : null;
  const change =
    amount !== null && previous !== null
      ? metricChange(amount, previous)
      : null;
  return (
    <section className="table-metric table-metric-seasonal" aria-label={label}>
      <div className="metric-content">
        <MoneyMetric
          label={label}
          value={amount === null ? null : BigInt(amount)}
          context={amount === null ? t("seasonal.missing") : season}
        />
        <p
          className="metric-comparison"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">
            {label}, {season}:{" "}
            {amount === null
              ? t("seasonal.missing")
              : formatMoney(BigInt(amount))}
            .{" "}
          </span>
          {kind === "orders"
            ? change === null
              ? t("seasonal.noComparison")
              : t("seasonal.change", { change, season: "SS26" })
            : t("seasonal.budgetHint")}
        </p>
      </div>
      <div
        className="metric-periods"
        role="group"
        aria-label={t("seasonal.periodFor", { label })}
      >
        {seasons.map((option) => (
          <Button
            key={option}
            variant="secondary"
            className="metric-period"
            aria-pressed={season === option}
            onClick={() => setSeason(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </section>
  );
}
export function SeasonalMetricCards({
  totals,
}: {
  totals: PerformanceReport["totals"];
}) {
  const t = useTranslations("tableMetrics");
  return (
    <div className="stack">
      <div className="table-metrics" aria-label={t("summary")}>
        {(["orders", "budget", "difference"] as const).map((kind) => (
          <SeasonalMetric key={kind} kind={kind} totals={totals} />
        ))}
      </div>
      <p className="metric-note">{t("seasonal.hint")}</p>
    </div>
  );
}
