"use client";
import { formatMoney } from "@/lib/money";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SlotText } from "@/components/arc/slot-text/slot-text";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
// MetricCard has no value/footer slot. Compose exact values and controls in
// an app-owned surface, without changing Arc registry files.
export function MoneyMetric({
  label,
  value,
  context,
  change,
  details,
  missing,
  format = "money",
}: {
  label: string;
  value: bigint | null;
  context: ReactNode;
  change?: ReactNode;
  details?: ReactNode;
  missing?: string;
  format?: "money" | "number";
}) {
  const money = useRef<HTMLDivElement>(null);
  const animated = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(false);
  const formatted =
    value === null
      ? null
      : format === "money"
        ? formatMoney(value)
        : new Intl.NumberFormat("it-IT").format(value);
  useLayoutEffect(() => {
    const region = money.current;
    const text = animated.current;
    if (!region || !text) return;
    const measure = () =>
      setFits(text.getBoundingClientRect().width <= region.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    observer.observe(text);
    measure();
    return () => observer.disconnect();
  }, [formatted]);
  return (
    <article className="money-metric">
      <div className="metric-heading">
        <p className="metric-label">
          <span className="metric-dot" aria-hidden="true" />
          {label}
        </p>
        {change && (
          <div className="metric-change" aria-hidden="true">
            {change}
          </div>
        )}
      </div>
      <div ref={money} className="metric-money" data-fits={fits}>
        {formatted === null ? (
          <span className="metric-missing">{missing}</span>
        ) : (
          <>
            <span
              ref={animated}
              className="metric-money-animated"
              aria-hidden={!fits}
            >
              <SlotText
                value={formatted}
                align="end"
                spins={1}
                duration={motionTokens.spring.smooth.visualDuration}
                stagger={motionTokens.stagger.char}
              />
            </span>
            <span className="metric-money-static" aria-hidden={fits}>
              {formatted}
            </span>
          </>
        )}
      </div>
      {details}
      <div className="metric-context">{context}</div>
    </article>
  );
}
