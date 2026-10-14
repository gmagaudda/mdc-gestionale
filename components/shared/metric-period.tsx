"use client";
import { useTranslations } from "next-intl";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { metricPeriods, type MetricPeriodValue } from "@/lib/metrics/schema";

export function MetricPeriod({
  label,
  period,
  onChange,
}: {
  label: string;
  period: MetricPeriodValue;
  onChange: (period: MetricPeriodValue) => void;
}) {
  const t = useTranslations("tableMetrics");
  return (
    <SegmentedControl
      className="metric-period-control"
      label={t("periodFor", { label })}
      value={period}
      onValueChange={(value) => onChange(value as MetricPeriodValue)}
      options={metricPeriods.map((value) => ({
        value,
        label: t(`periods.${value}`),
      }))}
    />
  );
}
