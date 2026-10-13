"use client";
import { formatMoney } from "@/lib/money";
import { AnimatedMoney } from "./animated-number";
// MetricCard has no decimals/locale/value slot. Keep amounts exact in an
// app-owned surface; the Arc registry files remain unchanged.
export function MoneyMetric({
  label,
  value,
  context,
}: {
  label: string;
  value: bigint | null;
  context: string;
}) {
  return (
    <article className="money-metric">
      <p className="metric-label">{label}</p>
      <div className="metric-money">
        {value === null ? (
          <span>{context}</span>
        ) : (
          <>
            <span className="metric-money-animated">
              <AnimatedMoney cents={value} />
            </span>
            <span className="metric-money-static">{formatMoney(value)}</span>
          </>
        )}
      </div>
      <p className="metric-context">{context}</p>
    </article>
  );
}
