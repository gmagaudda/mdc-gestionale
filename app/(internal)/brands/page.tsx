import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { listBrands } from "@/modules/brands/queries";
import { ListView } from "@/components/shared/list-view";
import { Alert } from "@/components/arc/alert/alert";
export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("brands");
  const query = parseListQuery(
    await searchParams,
    ["name", "legal_name"],
    "name",
  );
  const result = await listBrands(query);
  const columns = [
    { key: "name", label: t("name"), linkBase: "/brands" },
    { key: "legal_name", label: t("legal_name") },
  ];
  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          <>
            {" "}
            {user.role === "admin" && (
              <Link className="text-link" href="/brands/new">
                {t("create")}
              </Link>
            )}
          </>
        }
      />
      {result.error ? (
        <Alert tone="danger" title={t("loadError")} />
      ) : (
        <ListView
          base="/brands"
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
