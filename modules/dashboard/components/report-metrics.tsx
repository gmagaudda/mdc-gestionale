"use client";
import { useTranslations } from "next-intl";
import {
  AnimatedMoney,
  AnimatedNumber,
} from "@/components/shared/animated-number";
import type { DashboardReport } from "../schema";
export function ReportMetrics({ report }: { report: DashboardReport }) {
  const t = useTranslations("dashboard");
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
          <dt>{t("revenue")}</dt>
          <dd className="report-value">
            <AnimatedMoney cents={BigInt(report.revenue_cents)} />
          </dd>
          <dd>{t("revenueHint")}</dd>
        </div>
        <div>
          <dt>{t("orders")}</dt>
          <dd className="report-value">
            <AnimatedNumber value={report.order_count} />
          </dd>
          <dd>{t("ordersHint")}</dd>
        </div>
      </dl>
    </section>
  );
}
