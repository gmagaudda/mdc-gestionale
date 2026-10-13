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
import { ListCsvDownload } from "@/components/shared/list-csv-download";
import { portalSalesSortSchema } from "@/modules/portal/schema";
export default async function Sales({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams,
    c = await getPortalContext(input),
    t = await getTranslations("portal"),
    q = parseListQuery(
      input,
      portalSalesSortSchema.shape.sort.removeDefault().options,
      "net_cents",
      "desc",
    );
  const summaryBrand =
    c.filters.brand_id || (c.brands.length === 1 ? c.brands[0].id : "");
  const filters = (
    <PortalFilters
      base="/portal/sales"
      initial={c.filters}
      brands={c.brands}
      seasons={c.seasons}
    />
  );
  return (
    <>
      <h1>{t("salesTitle")}</h1>
      <p>{t("salesHint")}</p>

      {!c.parsed.success ? (
        <>
          {filters}
          <Alert tone="danger" title={t("invalidFilters")} />
        </>
      ) : (
        <AsyncReport
          load={getPortalSales(c.filters, (q.page - 1) * q.size, q.size, q)}
          label={t("loadingReport")}
          render={(report) =>
            !report.ok ? (
              <>
                {filters}
                <LoadError title={t("loadError")} />
              </>
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
                  filters={filters}
                  actions={
                    <ListCsvDownload
                      href={`/api/portal/sales/export?${new URLSearchParams(Object.entries({ ...c.filters, sort: q.sort, direction: q.direction }).filter(([, value]) => !!value))}`}
                      fileName="vendite-brand.csv"
                    />
                  }
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
                    { key: "brand", sortKey: "brand_name", label: t("brand") },
                    {
                      key: "season",
                      sortKey: "season_code",
                      label: t("season"),
                    },
                    {
                      key: "customer",
                      sortKey: "customer_display_name",
                      label: t("customer"),
                    },
                    { key: "city", sortKey: "customer_city", label: t("city") },
                    { key: "net", sortKey: "net_cents", label: t("sold") },
                    {
                      key: "orders",
                      sortKey: "order_count",
                      label: t("ordersCount"),
                    },
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
