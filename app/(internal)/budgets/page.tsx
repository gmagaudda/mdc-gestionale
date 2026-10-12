import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { Alert } from "@/components/arc/alert/alert";
import { listBudgets } from "@/modules/budgets/queries";
export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles),
    t = await getTranslations("budgets"),
    query = parseListQuery(
      await searchParams,
      ["period_start", "amount_cents", "created_at"],
      "period_start",
    ),
    result = await listBudgets(query);
  const date = (value: string) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
      new Date(`${value}T00:00:00Z`),
    );
  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          user.role !== "staff" && (
            <Link className="text-link" href="/budgets/new">
              {t("create")}
            </Link>
          )
        }
      />
      {result.error ? (
        <Alert tone="danger" title={t("loadError")} />
      ) : (
        <ListView
          base="/budgets"
          query={query}
          title={t("title")}
          searchLabel={t("search")}
          count={result.count ?? 0}
          columns={[
            { key: "brand", label: t("brand"), linkBase: "/budgets" },
            { key: "season", label: t("season") },
            { key: "customer", label: t("customer") },
            { key: "period", label: t("period") },
            { key: "amount", label: t("amount") },
          ]}
          rows={(result.data ?? []).map((row) => ({
            id: row.id,
            brand: row.brands.name,
            season: row.seasons?.code ?? t("none"),
            customer: row.customers?.legal_name ?? t("none"),
            period: t("periodValue", {
              start: date(row.period_start),
              end: date(row.period_end),
            }),
            amount: formatMoney(row.amount_cents),
          }))}
        />
      )}
    </>
  );
}
