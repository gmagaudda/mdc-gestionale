import Link from "next/link";
import { BudgetComparison } from "@/modules/imports/components/budget-comparison";
import { finalReportSchema } from "@/modules/imports/final-report";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { LoadError } from "@/components/shared/load-error";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { matchingReportSchema } from "@/modules/imports/match-schema";
import { MatchEditor } from "@/modules/imports/components/match-editor";
import { operationalPreviewSchema } from "@/modules/imports/preview-schema";
import { CommitReview } from "@/modules/imports/components/commit-review";
import { rollbackOperationalImport } from "@/modules/imports/commit-actions";
import { Alert } from "@/components/arc/alert/alert";
import { excludeImportErrors } from "@/modules/imports/match-actions";
export default async function ImportBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role)) notFound();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams,
    page = z.coerce
      .number()
      .int()
      .min(1)
      .max(2000)
      .catch(1)
      .parse(query.page ?? 1),
    t = await getTranslations("imports"),
    db = await createClient();
  const batch = await db
    .from("import_batches")
    .select(
      "id,file_name,kind,status,options,stats,created_by,file_removed_at,file_expires_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (batch.error) return <LoadError title={t("batchLoadError")} />;
  if (!batch.data || batch.data.kind === "performance") notFound();
  const revision = z
    .object({ revision: z.uuid() })
    .safeParse(batch.data.options);
  if (!revision.success)
    return (
      <>
        <PageHeader title={batch.data.file_name} />
        <EmptyState
          title={t("mappingStep")}
          description={t("resumeMappingHint")}
          label={t("mappingStep")}
        />
        <Link className="text-link" href="/imports/operational">
          {t("resumeMapping")}
        </Link>
      </>
    );
  const [matched, errors, simulation, comparison] = await Promise.all([
    db.rpc("import_matching", { p_id: id, p_page: page }),
    db
      .from("import_rows")
      .select("id,sheet,row_number,messages", { count: "exact" })
      .eq("batch_id", id)
      .eq("status", "error")
      .order("sheet")
      .order("row_number")
      .limit(100),
    db.rpc("import_preview", {
      p_id: id,
      p_page: z.coerce
        .number()
        .int()
        .min(1)
        .max(1000)
        .catch(1)
        .parse(query.review ?? 1),
    }),
    db.rpc("import_batch_report", {
      p_id: id,
      p_page: z.coerce
        .number()
        .int()
        .min(1)
        .max(200)
        .catch(1)
        .parse(query.comparison ?? 1),
    }),
  ]);
  const final = finalReportSchema.safeParse(comparison.data);
  const preview = operationalPreviewSchema.safeParse(simulation.data);
  const report = matchingReportSchema.safeParse(matched.data),
    readonly =
      batch.data.created_by !== user.id ||
      !["validated", "ready"].includes(batch.data.status);
  return (
    <>
      <PageHeader
        title={batch.data.file_name}
        description={t("matchingHint")}
      />
      {batch.data.file_removed_at ||
      new Date(batch.data.file_expires_at).getTime() <= new Date().getTime() ? (
        <p>{t("originalExpired")}</p>
      ) : (
        <Link className="text-link" href={`/api/imports/${id}`}>
          {t("downloadOriginal")}
        </Link>
      )}
      {batch.data.status === "completed" && (
        <Alert tone="success" title={t("operationalCompleted")} />
      )}
      {batch.data.status === "rolled_back" && (
        <Alert tone="success" title={t("operationalRolledBack")} />
      )}
      {matched.error ||
      errors.error ||
      !report.success ||
      simulation.error ||
      !preview.success ? (
        <LoadError title={t("matchLoadError")} />
      ) : (
        <>
          <CommitReview
            key={id}
            id={id}
            revision={revision.data.revision}
            report={preview.data}
            canEdit={!readonly}
            canCommit={
              user.role === "admin" &&
              ["validated", "ready"].includes(batch.data.status)
            }
            completed={["completed", "rolled_back"].includes(batch.data.status)}
          />
          {comparison.error || !final.success ? (
            <LoadError title={t("loadError")} />
          ) : (
            <BudgetComparison id={id} report={final.data} />
          )}
          {preview.data.page > 1 && (
            <Link
              className="text-link"
              href={`/imports/${id}?page=${page}&review=${preview.data.page - 1}`}
            >
              {t("previousChanges")}
            </Link>
          )}
          {preview.data.page * 100 < preview.data.total && (
            <Link
              className="text-link"
              href={`/imports/${id}?page=${page}&review=${preview.data.page + 1}`}
            >
              {t("nextChanges")}
            </Link>
          )}
          {user.role === "admin" && batch.data.status === "completed" && (
            <ConfirmAction
              label={t("rollback")}
              errorMessages={{ rollbackUnavailable: t("rollbackUnavailable") }}
              question={t("operationalRollbackHint")}
              confirmLabel={t("confirmRollback")}
              action={rollbackOperationalImport.bind(null, id)}
            />
          )}
          {(errors.count ?? 0) > 0 && (
            <section className="stack">
              <h2>{t("rowError")}</h2>
              <p>{t("blockingRows", { count: errors.count ?? 0 })}</p>
              <DataTable
                caption={t("rowError")}
                emptyMessage={t("noIssues")}
                columns={[
                  { key: "sheet", label: t("rowSheet") },
                  { key: "row", label: t("sourceRow"), numeric: true },
                  { key: "messages", label: t("rowMessages") },
                ]}
                rows={(errors.data ?? []).map((r) => ({
                  id: r.id,
                  sheet: r.sheet,
                  row: r.row_number,
                  messages: (Array.isArray(r.messages) ? r.messages : [])
                    .map((m) => {
                      const p = z
                        .object({ field: z.string(), code: z.string() })
                        .safeParse(m);
                      return p.success
                        ? `${p.data.field && t.has(`fields.${p.data.field}`) ? t(`fields.${p.data.field}`) + ": " : ""}${t.has(`row${p.data.code.charAt(0).toUpperCase() + p.data.code.slice(1)}`) ? t(`row${p.data.code.charAt(0).toUpperCase() + p.data.code.slice(1)}`) : t("validation")}`
                        : t("validation");
                    })
                    .join(" "),
                }))}
              />
              {!readonly && (
                <ConfirmAction
                  label={t("excludeShownErrors")}
                  question={t("excludeErrorsHint", {
                    count: errors.data?.length ?? 0,
                  })}
                  confirmLabel={t("confirmExclusion")}
                  action={excludeImportErrors.bind(
                    null,
                    id,
                    (errors.data ?? []).map((r) => r.id),
                    revision.data.revision,
                  )}
                />
              )}
            </section>
          )}
          <section className="stack">
            <h2>{t("matchingStep")}</h2>
            {!report.data.items.length ? (
              <EmptyState
                title={t("noMatches")}
                description={t("noMatchesHint")}
                label={t("matchingStep")}
              />
            ) : (
              report.data.items.map((item) => (
                <MatchEditor
                  key={JSON.stringify([item.kind, item.subject, item.choice])}
                  id={id}
                  revision={revision.data.revision}
                  item={item}
                  readonly={readonly}
                />
              ))
            )}
            <div className="list-footer">
              {page > 1 && (
                <Link
                  className="text-link"
                  href={`/imports/${id}?page=${page - 1}`}
                >
                  {t("previous")}
                </Link>
              )}
              <p>
                {t("pageStatus", {
                  page,
                  pages: Math.max(1, Math.ceil(report.data.total / 50)),
                })}
              </p>
              {page * 50 < report.data.total && (
                <Link
                  className="text-link"
                  href={`/imports/${id}?page=${page + 1}`}
                >
                  {t("next")}
                </Link>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
