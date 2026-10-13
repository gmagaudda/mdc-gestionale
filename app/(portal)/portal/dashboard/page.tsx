import { LoadError } from "@/components/shared/load-error";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Alert } from "@/components/arc/alert/alert";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { getPortalContext } from "@/modules/portal/context";
import { getPortalDashboard } from "@/modules/portal/queries";
import { PortalFilters } from "@/modules/portal/components/portal-filters";
import { PortalMetrics } from "@/modules/portal/components/portal-metrics";
import { BudgetVsActualChart } from "@/modules/dashboard/components/report-charts";
import type { DashboardFilters } from "@/modules/dashboard/schema";
async function Data({ filters }: { filters: DashboardFilters }) {
  const t = await getTranslations("portal"),
    report = await getPortalDashboard(filters);
  return report.ok ? (
    <>
      <PortalMetrics report={report.data} />
      <BudgetVsActualChart report={report.data} namespace="portal" />
    </>
  ) : (
    <LoadError title={t("loadError")} />
  );
}
export default async function PortalDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("portal"),
    context = await getPortalContext(await searchParams);
  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("readonly")}</p>
      {!context.brands.length ? (
        <EmptyState title={t("noBrands")} description={t("noBrandsHint")} />
      ) : (
        <>
          <PortalFilters
            initial={context.filters}
            brands={context.brands}
            seasons={context.seasons}
          />
          {!context.parsed.success ? (
            <Alert tone="danger" title={t("invalidFilters")} />
          ) : (
            <Suspense
              key={JSON.stringify(context.filters)}
              fallback={
                <>
                  <Skeleton lines={3} />
                  <Skeleton lines={8} />
                </>
              }
            >
              <Data filters={context.filters} />
            </Suspense>
          )}
        </>
      )}
    </>
  );
}
