import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { listBrands } from "@/modules/brands/queries";
import { ListView } from "@/components/shared/list-view";
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
          result.error &&
          user.role === "admin" && (
            <Link className="text-link" href="/brands/new">
              {t("create")}
            </Link>
          )
        }
      />
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/brands"
          createAction={
            user.role === "admin"
              ? { href: "/brands/new", label: t("create") }
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
