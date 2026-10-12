import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
export default async function LoadingDashboard() {
  const t = await getTranslations("dashboard"),
    lists = await getTranslations("lists");
  return (
    <>
      <h1>{t("title")}</h1>
      <Skeleton label={lists("loading")} lines={4} />
      <div className="report-metrics">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} label={lists("loading")} lines={3} />
        ))}
      </div>
      {["budgetChart", "trendChart", "customersChart"].map((key) => (
        <section className="stack" key={key}>
          <h2>{t(key)}</h2>
          <div className="report-plot">
            <Skeleton label={lists("loading")} lines={8} />
          </div>
        </section>
      ))}
    </>
  );
}
