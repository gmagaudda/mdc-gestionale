import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseListQuery, escapeLike } from "@/lib/queries/list";
import { ListView } from "@/components/shared/list-view";
import { Alert } from "@/components/arc/alert/alert";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const t = await getTranslations("audit");
  const query = parseListQuery(
    await searchParams,
    ["created_at", "action", "table_name", "actor_name"],
    "created_at",
    "desc",
  );
  const client = await createClient();
  const offset = (query.page - 1) * query.size;
  let request = client
    .from("v_audit_list")
    .select("id,created_at,action,table_name,actor_id,actor_name", {
      count: "exact",
    })
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range(offset, offset + query.size - 1);
  if (query.q)
    request = request.ilike("table_search", `%${escapeLike(query.q)}%`);
  const result = await request;
  const columns = [
    { key: "created_at", label: t("date"), linkBase: "/settings/audit" },
    { key: "action", label: t("action") },
    { key: "table_name", label: t("resource") },
    { key: "actor_id", sortKey: "actor_name", label: t("actor") },
  ];
  return (
    <>
      <header className="stack">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </header>
      {result.error ? (
        <Alert tone="danger" title={t("loadError")}>
          <Link className="text-link" href="/settings/audit">
            {t("retry")}
          </Link>
        </Alert>
      ) : (
        <ListView
          base="/settings/audit"
          query={query}
          rows={(result.data ?? []).map((row) => ({
            ...row,
            id: row.id!,
            action: t.has(`actions.${row.action}`)
              ? t(`actions.${row.action}`)
              : row.action,
            table_name: t.has(`resources.${row.table_name}`)
              ? t(`resources.${row.table_name}`)
              : row.table_name,
            created_at: new Intl.DateTimeFormat("it-IT", {
              dateStyle: "short",
              timeStyle: "medium",
              timeZone: "Europe/Rome",
            }).format(new Date(row.created_at!)),
            actor_id: row.actor_id
              ? row.actor_name || row.actor_id
              : t("system"),
          }))}
          count={result.count ?? 0}
          columns={columns}
          title={t("title")}
        />
      )}
    </>
  );
}
