import { AsyncReport } from "@/components/shared/async-report";
import { Alert } from "@/components/arc/alert/alert";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseListQuery, escapeLike } from "@/lib/queries/list";
import { ListView } from "@/components/shared/list-view";
export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["brand"]);
  const t = await getTranslations("documents"),
    p = await getTranslations("portal"),
    q = parseListQuery(
      await searchParams,
      ["created_at", "name", "brand_name", "kind", "size_bytes"],
      "created_at",
      "desc",
    );
  let request = (await createClient())
    .from("portal_documents")
    .select("id,name,kind,brand_name,size_bytes,created_at", {
      count: "exact",
    })
    .order(q.sort, { ascending: q.direction === "asc" })
    .order("id")
    .range((q.page - 1) * q.size, q.page * q.size - 1);
  if (q.q) request = request.ilike("table_search", `%${escapeLike(q.q)}%`);
  const load = Promise.resolve(request);

  return (
    <>
      <h1>{t("title")}</h1>
      <p>{p("documentsHint")}</p>
      <AsyncReport
        label={p("loadingReport")}
        load={load}
        render={(r) =>
          r.error ? (
            <Alert tone="danger" title={p("loadError")} />
          ) : (
            <ListView
              base="/portal/documents"
              query={q}
              count={r.count ?? 0}
              title={t("title")}
              emptyDescription={p("noDocumentsHint")}
              rows={r.data.map((d) => ({
                id: `${d.id}/download`,
                name: d.name,
                brand: d.brand_name,
                kind: t(`kinds.${d.kind}`),
                size: `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format((d.size_bytes ?? 0) / 1024)} KiB`,
              }))}
              columns={[
                {
                  key: "name",
                  label: t("name"),
                  linkBase: "/api/documents",
                  download: true,
                },
                { key: "brand", sortKey: "brand_name", label: t("brand") },
                { key: "kind", label: t("kind") },
                {
                  key: "size",
                  sortKey: "size_bytes",
                  numeric: true,
                  label: t("size"),
                },
              ]}
            />
          )
        }
      />
    </>
  );
}
