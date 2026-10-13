import { LoadError } from "@/components/shared/load-error";
import { AsyncReport } from "@/components/shared/async-report";
import { getTranslations } from "next-intl/server";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/arc/alert/alert";
import { ListView } from "@/components/shared/list-view";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { PortalFilters } from "@/modules/portal/components/portal-filters";
import { getPortalContext } from "@/modules/portal/context";
import { getPortalSales } from "@/modules/portal/queries";
import { BrandSummaryDownload } from "@/components/shared/brand-summary-download";
export default async function Sales({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams,
    c = await getPortalContext(input),
    t = await getTranslations("portal"),
    q = parseListQuery(input, ["net_cents"], "net_cents", "desc");
  const summaryBrand =
    c.filters.brand_id || (c.brands.length === 1 ? c.brands[0].id : "");
  return (
    <>
      <h1>{t("salesTitle")}</h1>
      <p>{t("salesHint")}</p>
      <PortalFilters
        base="/portal/sales"
        initial={c.filters}
        brands={c.brands}
        seasons={c.seasons}
      />
      {!c.parsed.success ? (
        <Alert tone="danger" title={t("invalidFilters")} />
      ) : (
        <AsyncReport
          load={getPortalSales(c.filters, (q.page - 1) * q.size)}
          label={t("loadingReport")}
          render={(report) =>
            !report.ok ? (
              <LoadError title={t("loadError")} />
            ) : (
              <>
                {summaryBrand && (
                  <BrandSummaryDownload
                    href={`/api/pdf/brand-summary/${summaryBrand}?${new URLSearchParams(Object.entries(c.filters).filter(([key, value]) => key !== "brand_id" && !!value))}`}
                  />
                )}
                <p className="report-value">
                  {t("sold")}:{" "}
                  <AnimatedMoney cents={BigInt(report.data.sold_cents)} />
                </p>
                <ListView
                  base="/portal/sales"
                  query={q}
                  count={report.data.count}
                  title={t("salesTitle")}
                  emptyDescription={t("noSalesHint")}
                  filterParams={c.filters}
                  rows={report.data.rows.map((r) => ({
                    id: `${r.brand_id}:${r.season_id}:${r.customer_id}`,
                    brand: r.brand_name,
                    season: r.season_code,
                    customer: r.customer_display_name,
                    city: r.customer_city,
                    net: formatMoney(BigInt(r.net_cents)),
                    orders: r.order_count,
                  }))}
                  columns={[
                    { key: "brand", label: t("brand") },
                    { key: "season", label: t("season") },
                    { key: "customer", label: t("customer") },
                    { key: "city", label: t("city") },
                    { key: "net", label: t("sold") },
                    { key: "orders", label: t("ordersCount") },
                  ]}
                />
              </>
            )
          }
        />
      )}
    </>
  );
}
