import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DataTable } from "@/components/shared/data-table";
import type { FinalReport } from "../final-report";
import { formatMoney } from "@/lib/money";
export async function BudgetComparison({
  id,
  report,
}: {
  id: string;
  report: FinalReport;
}) {
  const t = await getTranslations("imports"),
    money = (v: string | null) =>
      v === null ? t("notComparable") : formatMoney(BigInt(v));
  return (
    <section className="stack" aria-label={t("budgetComparison")}>
      <h2>{t("budgetComparison")}</h2>
      <p>{t(report.snapshot ? "reportSnapshot" : "reportDraft")}</p>
      <p>{t("budgetComparisonHint")}</p>
      <DataTable
        caption={t("budgetComparison")}
        emptyMessage={t("noBatchBudgets")}
        rows={report.budgets.map((b) => ({
          id: b.id,
          brand: b.brand,
          season: b.season ?? t("notSpecified"),
          customer: b.customer || t("allCustomers"),
          period: `${b.period_start} / ${b.period_end}`,
          budget: money(b.budget_cents),
          imported: money(b.imported_cents),
          previous: b.previous_season ?? t("notComparable"),
          sold: money(b.sold_cents),
          difference: money(b.difference_cents),
          percent:
            b.difference_pct === null
              ? t("notComparable")
              : `${b.difference_pct.replace(".", ",")}%`,
        }))}
        columns={[
          { key: "brand", width: "24ch", label: t("fields.brand") },
          { key: "season", width: "14ch", label: t("fields.season") },
          { key: "customer", width: "28ch", label: t("fields.customer") },
          { key: "period", width: "26ch", label: t("budgetPeriod") },
          {
            key: "budget",
            width: "22ch",
            label: t("fields.amount_cents"),
            numeric: true,
          },
          {
            key: "imported",
            width: "25ch",
            label: t("importedNet"),
            numeric: true,
          },
          { key: "previous", width: "25ch", label: t("previousSeason") },
          {
            key: "sold",
            width: "25ch",
            label: t("previousSold"),
            numeric: true,
          },
          {
            key: "difference",
            width: "26ch",
            label: t("differenceAmount"),
            numeric: true,
          },
          {
            key: "percent",
            width: "28ch",
            label: t("differencePercent"),
            numeric: true,
          },
        ]}
      />
      <div className="report-actions">
        {report.page > 1 && (
          <Link
            className="text-link"
            href={`/imports/${id}?comparison=${report.page - 1}`}
          >
            {t("previousComparison")}
          </Link>
        )}
        {report.page * 100 < report.budget_count && (
          <Link
            className="text-link"
            href={`/imports/${id}?comparison=${report.page + 1}`}
          >
            {t("nextComparison")}
          </Link>
        )}
        <a className="text-link" href={`/api/imports/${id}/export`}>
          {t("exportBatchXlsx")}
        </a>
        <a className="text-link" href={`/api/imports/${id}/export?format=csv`}>
          {t("exportBatchCsv")}
        </a>
      </div>
    </section>
  );
}
