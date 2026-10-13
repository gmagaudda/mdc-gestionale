"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { Button } from "@/components/arc/button/button";
import { MoneyMetric } from "./money-metric";
import { formatMoney } from "@/lib/money";
import { metricChange, type TableMetricData } from "@/lib/metrics/schema";

function TableMetric({ card }: { card: TableMetricData["cards"][number] }) {
  const t = useTranslations("tableMetrics");
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const values = card.periods[days];
  const label = t(`labels.${card.label}`);
  const value = BigInt(values.value);
  const change = metricChange(values.value, values.previous);
  const format = (amount: string) =>
    card.format === "money"
      ? formatMoney(BigInt(amount))
      : new Intl.NumberFormat("it-IT").format(BigInt(amount));
  return (
    <section className="table-metric" aria-label={label}>
      <div className="metric-content">
        {card.format === "number" && value < 1000n ? (
          <MetricCard
            label={label}
            value={Number(value)}
            context={t("lastDays", { days })}
          />
        ) : card.format === "money" ? (
          <MoneyMetric
            label={label}
            value={value}
            context={t("lastDays", { days })}
          />
        ) : (
          <article className="money-metric">
            <p className="metric-label">{label}</p>
            <div className="metric-money">{format(values.value)}</div>
            <p className="metric-context">{t("lastDays", { days })}</p>
          </article>
        )}
        <p
          className="metric-comparison"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">
            {label}: {format(values.value)}.{" "}
          </span>
          {change === null ? t("noBaseline") : t("yearChange", { change })}
          <span className="metric-previous">
            {t("previousValue", { value: format(values.previous) })}
          </span>
        </p>
      </div>
      <div
        className="metric-periods"
        role="group"
        aria-label={t("periodFor", { label })}
      >
        {([7, 30, 90] as const).map((period) => (
          <Button
            key={period}
            variant="secondary"
            aria-pressed={days === period}
            className="metric-period"
            onClick={() => setDays(period)}
          >
            {t("days", { days: period })}
          </Button>
        ))}
      </div>
    </section>
  );
}
export function TableMetricCards({ data }: { data: TableMetricData }) {
  const t = useTranslations("tableMetrics");
  return (
    <div className="stack">
      <div className="table-metrics" aria-label={t("summary")}>
        {data.cards.map((card) => (
          <TableMetric key={card.label} card={card} />
        ))}
      </div>
      <p className="metric-note">
        {t(`basis.${data.basis}`)} {t("filteredHint")}
      </p>
    </div>
  );
}
