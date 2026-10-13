import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { listCustomers } from "@/modules/customers/queries";
import { ListView } from "@/components/shared/list-view";
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
      <PageHeader
        title={t("title")}
        action={
          result.error &&
          user.role !== "accounting" && (
            <Link className="text-link" href="/customers/new">
              {t("create")}
            </Link>
          )
        }
      />
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/customers"
          createAction={
            user.role !== "accounting"
              ? { href: "/customers/new", label: t("create") }
              : undefined
          }
          query={query}
          rows={result.data ?? []}
          count={result.count ?? 0}
          columns={columns}
          title={t("title")}
          searchLabel={t("search")}
        />
      )}
    </>
  );
}
