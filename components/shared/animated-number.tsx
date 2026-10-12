"use client";
import NumberFlow from "@number-flow/react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { formatMoney, MAX_CENTS } from "@/lib/money";
const timing = {
  duration: motionTokens.spring.smooth.visualDuration * 1000,
  easing: `cubic-bezier(${motionTokens.ease.standard.join(",")})`,
};
export function AnimatedNumber({
  value,
  currency = false,
}: {
  value: number;
  currency?: boolean;
}) {
  return (
    <NumberFlow
      value={value}
      locales="it-IT"
      className="tabular-nums"
      format={
        currency
          ? {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          : { maximumFractionDigits: 0 }
      }
      transformTiming={timing}
      opacityTiming={{
        duration: motionTokens.duration.fast * 1000,
        easing: "ease-out",
      }}
      respectMotionPreference
    />
  );
}
export function AnimatedMoney({ cents }: { cents: bigint }) {
  // Keep exact BigInt formatting for an invalid oversized preview as well.
  if (cents > BigInt(MAX_CENTS) || cents < -BigInt(MAX_CENTS))
    return <span className="tabular-nums">{formatMoney(cents)}</span>;
  return <AnimatedNumber value={Number(cents) / 100} currency />;
}
