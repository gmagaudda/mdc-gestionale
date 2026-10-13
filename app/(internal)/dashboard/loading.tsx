import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageHeader } from "@/components/shared/page-header";
export default async function LoadingDashboard() {
  const t = await getTranslations("dashboard"),
    lists = await getTranslations("lists");
  return (
    <>
      <PageHeader title={t("title")} description={t("overviewHint")} />
      <Skeleton label={lists("loading")} lines={1} />
      <div className="report-metrics">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} label={lists("loading")} lines={3} />
        ))}
      </div>
      <div className="report-sections">
        {["budgetChart", "trendChart", "customersChart"].map((key) => (
          <section className="stack" key={key}>
            <h2>{t(key)}</h2>
            <div className="report-plot">
              <Skeleton label={lists("loading")} lines={8} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
