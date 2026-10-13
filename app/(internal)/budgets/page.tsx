import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
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
      [
        "period_start",
        "amount_cents",
        "created_at",
        "brand",
        "season",
        "customer",
        "period_end",
      ],
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
          result.error &&
          user.role !== "staff" && (
            <Link className="text-link" href="/budgets/new">
              {t("create")}
            </Link>
          )
        }
      />
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/budgets"
          createAction={
            user.role !== "staff"
              ? { href: "/budgets/new", label: t("create") }
              : undefined
          }
          query={query}
          title={t("title")}

          count={result.count ?? 0}
          columns={[
            { key: "brand", label: t("brand"), linkBase: "/budgets" },
            { key: "season", label: t("season") },
            { key: "customer", label: t("customer") },
            { key: "period", sortKey: "period_start", label: t("period") },
            {
              key: "amount",
              sortKey: "amount_cents",
              label: t("amount"),
              numeric: true,
            },
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
