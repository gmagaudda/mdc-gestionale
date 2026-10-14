"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MetricPeriod } from "./metric-period";
import { MoneyMetric } from "./money-metric";
import { formatMoney } from "@/lib/money";
import { metricChange, type TableMetricData } from "@/lib/metrics/schema";
import { SlotText } from "@/components/arc/slot-text/slot-text";

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
        <MoneyMetric
          label={label}
          value={value}
          format={card.format}
          change={
            change === null ? undefined : (
              <SlotText value={`${change}%`} align="end" />
            )
          }
          context={
            <MetricPeriod label={label} days={days} onChange={setDays} />
          }
          details={
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
          }
        />
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
