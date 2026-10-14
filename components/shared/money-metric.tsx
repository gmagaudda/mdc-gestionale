"use client";
import { formatMoney } from "@/lib/money";
import type { ReactNode } from "react";
import { SlotText } from "@/components/arc/slot-text/slot-text";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
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
        {formatted === null ? (
          <span>{context}</span>
        ) : (
          <>
            <span className="metric-money-animated">
              <SlotText
                value={formatted}
                align="end"
                spins={0}
                duration={motionTokens.spring.smooth.visualDuration}
                stagger={motionTokens.stagger.char}
              />
            </span>
            <span className="metric-money-static">{formatted}</span>
          </>
        )}
      </div>
      <div className="metric-context">{context}</div>
    </article>
  );
}
