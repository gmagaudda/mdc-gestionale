"use client";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { LineChart } from "@/components/arc/line-chart/line-chart";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { formatMoney } from "@/lib/money";
import { chartCents, type DashboardReport } from "../schema";
const format = (value: number) => formatMoney(BigInt(Math.round(value)));
const dateFormat = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" });
function GroupedBars({
  data,
  series,
}: {
  data: { label: string; [key: string]: string | number }[];
  series: { key: string; fill: string }[];
}) {
  return (
    <div className="report-plot" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)" }} />
          <YAxis
            width={80}
            tickFormatter={format}
            tick={{ fill: "var(--text-secondary)" }}
          />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              fill={item.fill}
              maxBarSize={32}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function BudgetVsActualChart({
  report,
  namespace = "dashboard",
}: {
  report: {
    budget_count: number;
    budgets: Omit<DashboardReport["budgets"][number], "revenue_cents">[];
  };
  namespace?: "dashboard" | "portal";
}) {
  const t = useTranslations(namespace),
    items = report.budgets.slice(0, 10);
  const rows = items.map((item, index) => ({
    id: item.id,
    label: t("budgetOrdinal", { number: index + 1 }),
    scope: t("budgetScope", {
      brand: item.brand_name ?? t("unavailable"),
      season: item.season_code ?? t("general"),
      customer: item.customer_name ?? t("general"),
      start: dateFormat.format(new Date(`${item.period_start}T00:00:00Z`)),
      end: dateFormat.format(new Date(`${item.period_end}T00:00:00Z`)),
    }),
    budget: formatMoney(BigInt(item.budget_cents)),
    actual: formatMoney(BigInt(item.sold_cents)),
    difference: formatMoney(BigInt(item.difference_cents)),
    percent:
      item.difference_pct === null
        ? t("noPercentage")
        : t("percentage", {
            value: new Intl.NumberFormat("it-IT", {
              maximumFractionDigits: 2,
            }).format(Number(item.difference_pct)),
          }),
  }));
  const safe = items.every(
    (item) =>
      chartCents(item.budget_cents) !== null &&
      chartCents(item.sold_cents) !== null,
  );
  return (
    <section className="stack" aria-label={t("budgetChart")}>
      <h2>{t("budgetChart")}</h2>
      <p>{t("budgetHint")}</p>
      {!items.length ? (
        <EmptyState title={t("noBudgets")} description={t("noBudgetsHint")} />
      ) : (
        <>
          <p>
            {t("shownBudgets", {
              shown: items.length,
              total: report.budget_count,
            })}
          </p>
          <div className="report-legend">
            <span>{t("budgetLegend")}</span>
            <span>{t("soldLegend")}</span>
          </div>
          {safe ? (
            <GroupedBars
              data={items.map((item, index) => ({
                label: String(index + 1),
                budget: chartCents(item.budget_cents)!,
                actual: chartCents(item.sold_cents)!,
              }))}
              series={[
                { key: "budget", fill: "var(--text-secondary)" },
                { key: "actual", fill: "var(--accent)" },
              ]}
            />
          ) : (
            <p>{t("largeValues")}</p>
          )}
          <DataTable
            caption={t("budgetChart")}
            rows={rows}
            columns={[
              { key: "label", label: t("budget") },
              { key: "scope", label: t("scope") },
              { key: "budget", label: t("budget") },
              { key: "actual", label: t("sold") },
              { key: "difference", label: t("difference") },
              { key: "percent", label: t("differencePercent") },
            ]}
            emptyMessage={t("noBudgets")}
          />
        </>
      )}
    </section>
  );
}
export function SalesTrendChart({ report }: { report: DashboardReport }) {
  const t = useTranslations("dashboard"),
    safe = report.trend.every((item) => chartCents(item.net_cents) !== null);
  return (
    <section className="stack" aria-label={t("trendChart")}>
      <h2>{t("trendChart")}</h2>
      {!report.trend.length ? (
        <EmptyState title={t("noSales")} description={t("noSalesHint")} />
      ) : (
        <>
          {report.trend_month_count > report.trend.length && (
            <p>
              {t("shownMonths", {
                shown: report.trend.length,
                total: report.trend_month_count,
              })}
            </p>
          )}
          {safe ? (
            <div aria-hidden="true" inert>
              <LineChart
                label={t("trendChart")}
                categoryLabel={t("month")}
                emptyLabel={t("noSales")}
                data={report.trend.map((item) => ({
                  key: item.month,
                  label: new Intl.DateTimeFormat("it-IT", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${item.month}T00:00:00Z`)),
                  axisLabel: new Intl.DateTimeFormat("it-IT", {
                    month: "short",
                    year: "2-digit",
                    timeZone: "UTC",
                  }).format(new Date(`${item.month}T00:00:00Z`)),
                  values: { sales: chartCents(item.net_cents)! },
                }))}
                series={[
                  { key: "sales", label: t("sold"), color: "var(--accent)" },
                ]}
                formatValue={format}
                formatTick={format}
                curve="linear"
              />
            </div>
          ) : (
            <p>{t("largeValues")}</p>
          )}
          <DataTable
            caption={t("trendChart")}
            rows={report.trend.map((item) => ({
              id: item.month,
              month: item.month.slice(0, 7),
              net: formatMoney(BigInt(item.net_cents)),
            }))}
            columns={[
              { key: "month", label: t("month") },
              { key: "net", label: t("sold") },
            ]}
            emptyMessage={t("noSales")}
          />
        </>
      )}
    </section>
  );
}
export function TopCustomersChart({ report }: { report: DashboardReport }) {
  const t = useTranslations("dashboard"),
    safe = report.customers.every(
      (item) => chartCents(item.net_cents) !== null,
    );
  return (
    <section className="stack" aria-label={t("customersChart")}>
      <h2>{t("customersChart")}</h2>
      <p>{t("customersHint")}</p>
      {!report.customers.length ? (
        <EmptyState title={t("noSales")} description={t("noSalesHint")} />
      ) : (
        <>
          {safe ? (
            <GroupedBars
              data={report.customers.map((item, index) => ({
                label: String(index + 1),
                net: chartCents(item.net_cents)!,
              }))}
              series={[{ key: "net", fill: "var(--accent)" }]}
            />
          ) : (
            <p>{t("largeValues")}</p>
          )}
          <DataTable
            caption={t("customersChart")}
            rows={report.customers.map((item, index) => ({
              id: `${item.brand_id}:${item.customer_id}`,
              rank: String(index + 1),
              customer: item.name ?? t("unavailable"),
              city: item.city ?? "",
              net: formatMoney(BigInt(item.net_cents)),
              orders: String(item.order_count),
            }))}
            columns={[
              { key: "rank", label: t("position") },
              { key: "customer", label: t("customer") },
              { key: "city", label: t("city") },
              { key: "net", label: t("sold") },
              { key: "orders", label: t("orders") },
            ]}
            emptyMessage={t("noSales")}
          />
        </>
      )}
    </section>
  );
}
