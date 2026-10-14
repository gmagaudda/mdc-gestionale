"use client";
import { useTranslations } from "next-intl";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

export function MetricPeriod({
  label,
  days,
  onChange,
}: {
  label: string;
  days: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}) {
  const t = useTranslations("tableMetrics");
  return (
    <SegmentedControl
      className="metric-period-control"
      label={t("periodFor", { label })}
      value={String(days)}
      onValueChange={(value) => onChange(Number(value) as 7 | 30 | 90)}
      options={([7, 30, 90] as const).map((value) => ({
        value: String(value),
        label: t("days", { days: value }),
      }))}
    />
  );
}
