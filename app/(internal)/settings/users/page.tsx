import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseListQuery, escapeLike } from "@/lib/queries/list";
import { ListView } from "@/components/shared/list-view";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const t = await getTranslations("users");
  const query = parseListQuery(
    await searchParams,
    ["email", "full_name", "role", "is_active"],
    "full_name",
  );
  const client = await createClient();
  const offset = (query.page - 1) * query.size;
  let request = client
    .from("profiles")
    .select("id,email,full_name,role,is_active", { count: "exact" })
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range(offset, offset + query.size - 1);
  if (query.q)
    request = request.ilike("table_search", `%${escapeLike(query.q)}%`);
  const result = await request;
  const columns = [
    { key: "full_name", label: t("full_name"), linkBase: "/settings/users" },
    { key: "email", label: t("email") },
    { key: "role", label: t("role") },
    { key: "status", sortKey: "is_active", label: t("status") },
  ];
  return (
    <>
      <header className="stack">
        <h1>{t("title")}</h1>
        {result.error && (
          <Link className="text-link" href="/settings/users/new">
            {t("invite")}
          </Link>
        )}
      </header>
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/settings/users"
          createAction={{ href: "/settings/users/new", label: t("invite") }}
          query={query}
          rows={(result.data ?? []).map((row) => ({
            ...row,
            full_name: row.full_name || row.email,
            role: t(row.role),
            is_active: row.is_active ? 1 : 0,
            status: t(row.is_active ? "active" : "inactive"),
          }))}
          count={result.count ?? 0}
          columns={columns}
          title={t("title")}
        />
      )}
    </>
  );
}
