import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { LoadError } from "@/components/shared/load-error";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { rollbackPerformanceBatch } from "@/modules/imports/actions";
export default async function Imports() {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role)) notFound();
  const t = await getTranslations("imports");
  const batches = await (
    await createClient()
  )
    .from("import_batches")
    .select("id,file_name,kind,status,created_at,created_by")
    .order("created_at", { ascending: false })
    .limit(100);
  const authorIds = [...new Set((batches.data ?? []).map((b) => b.created_by))];
  const authors = authorIds.length
    ? ((
        await (
          await createClient()
        )
          .from("profiles")
          .select("id,full_name")
          .in("id", authorIds)
      ).data ?? [])
    : [];
  return (
    <>
      <PageHeader
        title={t("history")}
        description={t("historyHint")}
        action={
          user.role === "admin" ? (
            <Link className="text-link" href="/imports/new">
              {t("new")}
            </Link>
          ) : undefined
        }
      />
      {batches.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <>
          <DataTable
            caption={t("history")}
            rows={batches.data.map((b) => ({
              id: b.id,
              file_name: b.file_name,
              kind: t(`entities.${b.kind}`),
              status: t(`statuses.${b.status}`),
              author:
                authors.find((a) => a.id === b.created_by)?.full_name ||
                t("unknownAuthor"),
              original: t("downloadOriginal"),
              date: new Intl.DateTimeFormat("it-IT", {
                timeZone: "Europe/Rome",
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(b.created_at)),
            }))}
            columns={[
              { key: "file_name", label: t("file") },
              { key: "kind", label: t("entity") },
              { key: "status", label: t("status") },
              { key: "author", label: t("author") },
              { key: "date", label: t("createdAt") },
              {
                key: "original",
                label: t("original"),
                linkBase: "/api/imports",
                download: true,
              },
            ]}
            emptyMessage={t("noImports")}
          />
          {batches.data.length === 100 && <p>{t("historyLimit")}</p>}
          {batches.data
            .filter((b) => b.kind === "performance" && b.status === "completed")
            .map((b) => (
              <section key={b.id} className="stack">
                <h2 className="wrap-value">{b.file_name}</h2>
                <Link className="text-link" href={`/analysis?batch=${b.id}`}>
                  {t("viewAnalysis")}
                </Link>
                <ConfirmAction
                  label={t("rollback")}
                  question={t("rollbackHint")}
                  confirmLabel={t("confirmRollback")}
                  action={rollbackPerformanceBatch.bind(null, b.id)}
                />
              </section>
            ))}
        </>
      )}
    </>
  );
}
