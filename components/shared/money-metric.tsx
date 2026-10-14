"use client";
import { formatMoney } from "@/lib/money";
import type { ReactNode } from "react";
import { AnimatedMoney, AnimatedNumber } from "./animated-number";
// MetricCard has no value/footer slot. Compose exact values and controls in
// an app-owned surface, without changing Arc registry files.
export function MoneyMetric({
  label,
  value,
  context,
  format = "money",
}: {
  label: string;
  value: bigint | null;
  context: ReactNode;
  format?: "money" | "number";
}) {
  const formatted =
    value === null
      ? null
      : format === "money"
        ? formatMoney(value)
        : new Intl.NumberFormat("it-IT").format(value);
  return (
    <article className="money-metric">
      <p className="metric-label">{label}</p>
      <div className="metric-money">
        {value === null ? (
          <span>{context}</span>
        ) : (
          <>
            <span className="metric-money-animated">
              {format === "money" ? (
                <AnimatedMoney cents={value} />
              ) : value <= BigInt(Number.MAX_SAFE_INTEGER) ? (
                <AnimatedNumber value={Number(value)} />
              ) : (
                formatted
              )}
            </span>
            <span className="metric-money-static">{formatted}</span>
          </>
        )}
      </div>
      <div className="metric-context">{context}</div>
    </article>
  );
}
