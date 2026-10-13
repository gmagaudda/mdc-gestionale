import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { Alert } from "@/components/arc/alert/alert";
import { performanceFilterSchema } from "@/modules/imports/report-schema";
import { getPerformanceReport } from "@/modules/imports/queries";
import { PerformanceFiltersForm } from "@/modules/imports/components/performance-filters";
import { PerformanceResults } from "@/modules/imports/components/performance-results";
import { PerformanceExport } from "@/modules/imports/components/performance-export";
export default async function Analysis({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if ((await getSessionUser())?.role !== "admin") notFound();
  const t = await getTranslations("imports"),
    params = await searchParams,
    db = await createClient();
  const batches = await db
    .from("import_batches")
    .select("id,file_name,created_at")
    .eq("kind", "performance")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(20);
  if (batches.error)
    return (
      <>
        <PageHeader title={t("analysisTitle")} />
        <LoadError title={t("loadError")} />
      </>
    );
  const batch =
    typeof params.batch === "string" ? params.batch : batches.data[0]?.id;
  if (!batch)
    return (
      <>
        <PageHeader
          title={t("analysisTitle")}
          description={t("historicalHint")}
        />
        <EmptyState title={t("noDataset")} description={t("noDatasetHint")} />
        <Link className="text-link" href="/imports/new">
          {t("new")}
        </Link>
      </>
    );
  const parsed = performanceFilterSchema.safeParse({ ...params, batch });
  if (!parsed.success)
    return (
      <>
        <PageHeader title={t("analysisTitle")} />
        <Alert tone="danger" title={t("invalidFilters")} />
        <Link className="text-link" href="/analysis">
          {t("resetFilters")}
        </Link>
      </>
    );
  const result = await getPerformanceReport(parsed.data);
  return (
    <>
      <PageHeader
        title={t("analysisTitle")}
        description={t("historicalHint")}
        action={
          <Link className="text-link" href="/imports/new">
            {t("new")}
          </Link>
        }
      />
      {batches.data.length > 1 && (
        <nav aria-label={t("datasets")} className="stack">
          {batches.data.map((b) => (
            <Link
              className="text-link"
              key={b.id}
              href={`/analysis?batch=${b.id}`}
              aria-current={b.id === batch ? "page" : undefined}
            >
              {b.file_name} (
              {new Intl.DateTimeFormat("it-IT", {
                timeZone: "Europe/Rome",
              }).format(new Date(b.created_at))}
              )
            </Link>
          ))}
        </nav>
      )}
      {!result.ok ? (
        <div className="stack">
          <LoadError title={t("loadError")} />
          <Link className="text-link" href="/analysis">
            {t("resetFilters")}
          </Link>
        </div>
      ) : (
        <>
          {params.imported === "1" && (
            <Alert tone="success" title={t("complete")} />
          )}
          <p className="wrap-value">
            {t("sourceFile", { name: result.data.file_name })}
          </p>
          <PerformanceFiltersForm
            key={JSON.stringify(parsed.data)}
            initial={parsed.data}
            report={result.data}
          />
          {result.data.totals.unnamed_rows > 0 && (
            <p>
              {t("unnamedRows", { count: result.data.totals.unnamed_rows })}
            </p>
          )}
          <PerformanceResults
            groups={result.data.groups}
            totals={result.data.totals}
            count={result.data.group_count}
            dimension={parsed.data.dimension}
          />
          <PerformanceExport
            params={new URLSearchParams(
              Object.fromEntries(
                Object.entries(parsed.data).map(([k, v]) => [k, String(v)]),
              ),
            ).toString()}
          />
          {result.data.group_count > 100 && (
            <nav className="report-actions" aria-label={t("pages")}>
              {parsed.data.page > 1 && (
                <Link
                  className="text-link"
                  href={`/analysis?${new URLSearchParams({ ...Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, String(v)])), page: String(parsed.data.page - 1) })}`}
                >
                  {t("previous")}
                </Link>
              )}
              {parsed.data.page * 100 < result.data.group_count && (
                <Link
                  className="text-link"
                  href={`/analysis?${new URLSearchParams({ ...Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, String(v)])), page: String(parsed.data.page + 1) })}`}
                >
                  {t("next")}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
