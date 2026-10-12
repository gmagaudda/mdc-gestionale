import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { listDocuments } from "@/modules/documents/queries";
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles),
    t = await getTranslations("documents");
  const query = parseListQuery(
      await searchParams,
      ["name", "created_at"],
      "created_at",
    ),
    result = await listDocuments(query);
  const columns = [
    { key: "name", label: t("name"), linkBase: "/documents" },
    { key: "brand", label: t("brand") },
    { key: "kind", label: t("kind") },
    { key: "shared", label: t("visibility") },
    { key: "size", label: t("fileSize") },
  ];
  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          user.role !== "accounting" && (
            <Link className="text-link" href="/documents/new">
              {t("upload")}
            </Link>
          )
        }
      />
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/documents"
          query={query}
          columns={columns}
          rows={(result.data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            brand: row.brands?.name ?? "",
            kind: t(`kinds.${row.kind}`),
            shared: t(row.shared_with_brand ? "sharedState" : "internalState"),
            size: t("sizeValue", {
              value: new Intl.NumberFormat("it-IT", {
                maximumFractionDigits: 1,
              }).format(row.size_bytes / 1024),
            }),
          }))}
          count={result.count ?? 0}
          title={t("title")}
          searchLabel={t("search")}
        />
      )}
    </>
  );
}
