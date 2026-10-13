import { PageHeader } from "@/components/shared/page-header";
import { ErpIcon } from "@/components/shared/erp-icon";
import Link from "next/link";
import { LoadError } from "@/components/shared/load-error";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/arc/alert/alert";
import { searchBudgetBrands } from "@/modules/budgets/actions";
import { dashboardFiltersSchema } from "@/modules/dashboard/schema";
import { getDashboardReport } from "@/modules/dashboard/queries";
import { DashboardFiltersForm } from "@/modules/dashboard/components/dashboard-filters";
import { ReportMetrics } from "@/modules/dashboard/components/report-metrics";
import {
  BudgetVsActualChart,
  SalesTrendChart,
  TopCustomersChart,
} from "@/modules/dashboard/components/report-charts";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("dashboard"),
    parsed = dashboardFiltersSchema.safeParse(await searchParams),
    filters = parsed.success ? parsed.data : dashboardFiltersSchema.parse({});
  const brands = await searchBudgetBrands("");
  if (!brands.ok) throw Error("Report choices unavailable");
  const db = await createClient();
  if (
    filters.brand_id &&
    !brands.data.some((b) => b.value === filters.brand_id)
  ) {
    const { data } = await db
      .from("brands")
      .select("id,name")
      .eq("id", filters.brand_id)
      .maybeSingle();
    if (data) brands.data.push({ value: data.id, label: data.name });
  }
  const season = filters.season_id
    ? (
        await db
          .from("seasons")
          .select("id,code,name")
          .eq("id", filters.season_id)
          .eq("brand_id", filters.brand_id)
          .maybeSingle()
      ).data
    : null;
  const ti = await getTranslations("imports");
  const latest = ["admin", "accounting"].includes(user.role)
    ? await db
        .from("import_batches")
        .select("id,file_name")
        .neq("kind", "performance")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : null;
  const report = parsed.success ? await getDashboardReport(filters) : null;
  return (
    <>
      <PageHeader title={t("title")} description={t("overviewHint")} />
      <details
        className="dashboard-filters"
        open={Object.values(filters).some(Boolean)}
      >
        <summary className="dashboard-filters-trigger">
          {t("filters")}
          <ErpIcon name="chevron" className="navigation-chevron" />
        </summary>
        <DashboardFiltersForm
          initial={filters}
          brands={brands.data}
          season={
            season
              ? { value: season.id, label: `${season.code} · ${season.name}` }
              : undefined
          }
        />
      </details>
      {!parsed.success ? (
        <Alert tone="danger" title={t("invalidFilters")} />
      ) : report?.ok ? (
        <>
          <ReportMetrics report={report.data} />
          <div className="report-sections">
            <BudgetVsActualChart report={report.data} />
            <SalesTrendChart report={report.data} />
            <TopCustomersChart report={report.data} />
          </div>
        </>
      ) : (
        <LoadError title={t("loadError")} />
      )}
      {latest && (
        <section className="stack" aria-label={ti("latestOperationalImport")}>
          <h2>{ti("latestOperationalImport")}</h2>
          {latest.error ? (
            <LoadError title={ti("loadError")} />
          ) : latest.data ? (
            <>
              <p>{ti("latestOperationalImportHint")}</p>
              <Link
                className="text-link wrap-value"
                href={`/imports/${latest.data.id}`}
              >
                {ti("openBatch", { name: latest.data.file_name })}
              </Link>
            </>
          ) : (
            <p>{ti("noOperationalImports")}</p>
          )}
        </section>
      )}
    </>
  );
}
