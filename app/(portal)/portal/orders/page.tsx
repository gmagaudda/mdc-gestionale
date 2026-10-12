import { AsyncReport } from "@/components/shared/async-report";
import { getTranslations } from "next-intl/server";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/arc/alert/alert";
import { ListView } from "@/components/shared/list-view";
import { PortalFilters } from "@/modules/portal/components/portal-filters";
import { getPortalContext } from "@/modules/portal/context";
import { getPortalOrders } from "@/modules/portal/queries";
import { portalOrderFiltersSchema } from "@/modules/portal/schema";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams,
    c = await getPortalContext(input),
    t = await getTranslations("orders"),
    p = await getTranslations("portal"),
    parsed = portalOrderFiltersSchema.safeParse(input),
    query = parseListQuery(input, ["order_date"], "order_date", "desc");
  return (
    <>
      <h1>{t("title")}</h1>
      <p>{p("ordersReadonly")}</p>
      <PortalFilters
        base="/portal/orders"
        initial={c.filters}
        brands={c.brands}
        seasons={c.seasons}
        status={parsed.success ? parsed.data.status : ""}
      />
      {!parsed.success ? (
        <Alert tone="danger" title={p("invalidFilters")} />
      ) : (
        <AsyncReport
          load={getPortalOrders(parsed.data, (query.page - 1) * query.size)}
          label={p("loadingReport")}
          render={(report) =>
            !report.ok ? (
              <Alert tone="danger" title={p("loadError")} />
            ) : (
              <>
                <a
                  className="text-link"
                  href={`/api/portal/orders/export?${new URLSearchParams(Object.entries(parsed.data).filter(([, v]) => !!v))}`}
                >
                  {p("exportOrders")}
                </a>
                <ListView
                  base="/portal/orders"
                  query={query}
                  count={report.data.count}
                  title={t("title")}
                  emptyDescription={p("noOrdersHint")}
                  filterParams={parsed.data}
                  rows={report.data.rows.map((o) => ({
                    id: o.id,
                    number: o.number,
                    brand: o.brand_name,
                    season: o.season_code,
                    customer: o.customer_display_name,
                    city: o.customer_city,
                    date: new Intl.DateTimeFormat("it-IT", {
                      timeZone: "UTC",
                    }).format(new Date(`${o.order_date}T00:00:00Z`)),
                    status: t(`statuses.${o.status}`),
                    net: formatMoney(o.net_total_cents),
                  }))}
                  columns={[
                    {
                      key: "number",
                      label: t("number"),
                      linkBase: "/portal/orders",
                    },
                    { key: "brand", label: t("brand") },
                    { key: "season", label: t("season") },
                    { key: "customer", label: t("customer") },
                    { key: "city", label: p("city") },
                    { key: "date", label: t("order_date") },
                    { key: "status", label: t("status") },
                    { key: "net", label: t("net") },
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
