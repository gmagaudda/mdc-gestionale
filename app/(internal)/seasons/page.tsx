import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { listSeasons } from "@/modules/seasons/queries";
export default async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("catalog");
  const query = parseListQuery(await searchParams, ["code", "name"], "code");
  const result = await listSeasons(query);
  const columns = [
    { key: "code", label: t("code"), linkBase: "/seasons" },
    { key: "name", label: t("name") },
    { key: "brand", label: t("brand") },
  ];
  return (
    <>
      <PageHeader
        title={t("seasons")}
        action={
          user.role !== "accounting" && (
            <Link className="text-link" href="/seasons/new">
              {t("createSeason")}
            </Link>
          )
        }
      />
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/seasons"
          query={query}
          rows={(result.data ?? []).map((row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            brand: row.brands?.name ?? "",
          }))}
          count={result.count ?? 0}
          columns={columns}
          sortable={columns.slice(0, 2)}
          title={t("seasons")}
          searchLabel={t("search")}
        />
      )}
    </>
  );
}
