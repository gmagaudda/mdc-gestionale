"use client";
import { useTranslations } from "next-intl";
import {
  AnimatedMoney,
  AnimatedNumber,
} from "@/components/shared/animated-number";
import type { PortalDashboard } from "../schema";
export function PortalMetrics({ report }: { report: PortalDashboard }) {
  const t = useTranslations("portal");
  return (
    <section className="stack" aria-label={t("metrics")}>
      <h2>{t("metrics")}</h2>
      <dl className="report-metrics">
        <div>
          <dt>{t("sold")}</dt>
          <dd className="report-value">
            <AnimatedMoney cents={BigInt(report.sold_cents)} />
          </dd>
          <dd>{t("soldHint")}</dd>
        </div>
        <div>
          <dt>{t("ordersCount")}</dt>
          <dd className="report-value">
            <AnimatedNumber value={report.order_count} />
          </dd>
          <dd>{t("ordersHint")}</dd>
        </div>
      </dl>
    </section>
  );
}
