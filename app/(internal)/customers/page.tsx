import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { listCustomers } from "@/modules/customers/queries";
import { ListView } from "@/components/shared/list-view";
import { Alert } from "@/components/arc/alert/alert";
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("customers");
  const query = parseListQuery(
    await searchParams,
    ["legal_name", "trade_name", "city"],
    "legal_name",
  );
  const result = await listCustomers(query);
  const columns = [
    { key: "legal_name", label: t("legal_name"), linkBase: "/customers" },
    { key: "trade_name", label: t("trade_name") },
    { key: "city", label: t("city") },
  ];
  return (
    <>
      <header className="stack">
        <h1>{t("title")}</h1>
        {user.role !== "accounting" && (
          <Link className="text-link" href="/customers/new">
            {t("create")}
          </Link>
        )}
      </header>
      {result.error ? (
        <Alert tone="danger" title={t("loadError")} />
      ) : (
        <ListView
          base="/customers"
          query={query}
          rows={result.data ?? []}
          count={result.count ?? 0}
          columns={columns}
          sortable={columns}
          title={t("title")}
          searchLabel={t("search")}
        />
      )}
    </>
  );
}
