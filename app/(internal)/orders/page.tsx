import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/money";
import { listHref } from "@/lib/queries/list";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { Alert } from "@/components/arc/alert/alert";
import { OrderFilters } from "@/modules/orders/components/order-filters";
import { listOrders, orderFilterChoices } from "@/modules/orders/queries";
import {
  orderFiltersSchema,
  orderListQuery,
  filterParams,
} from "@/modules/orders/filters";
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("orders");
  const input = await searchParams;
  const parsed = orderFiltersSchema.safeParse(input);
  const query = orderListQuery(input);
  if (!parsed.success)
    return (
      <>
        <h1>{t("title")}</h1>
        <Alert tone="danger" title={t("invalidFilters")}>
          <Link className="text-link" href="/orders">
            {t("clearFilters")}
          </Link>
        </Alert>
      </>
    );
  const filters = parsed.data;
  const [result, choices] = await Promise.all([
    listOrders(query, filters),
    orderFilterChoices(filters.customer_id),
  ]);
  const params = filterParams(filters);
  const columns = [
    { key: "number", label: t("number"), linkBase: "/orders" },
    { key: "order_date", label: t("order_date") },
    { key: "status", label: t("status") },
    { key: "brand", label: t("brand") },
    { key: "customer", label: t("customer") },
    { key: "season", label: t("season") },
    { key: "gross_total_cents", label: t("gross"), numeric: true },
  ];
  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          user.role !== "accounting" && (
            <Link className="text-link" href="/orders/new">
              {t("create")}
            </Link>
          )
        }
      />
      <OrderFilters
        key={JSON.stringify(filters) + query.q}
        initial={filters}
        q={query.q}
        {...choices}
      />
      <Link
        className="text-link"
        href={listHref("/api/orders/export", query, {}, params)}
      >
        {t("exportCsv")}
      </Link>
      {result.error ? (
        <Alert tone="danger" title={t("loadError")} />
      ) : (
        <ListView
          base="/orders"
          query={query}
          filterParams={params}
          title={t("title")}
          count={result.count ?? 0}
          columns={columns}
          sortable={columns.filter((column) =>
            ["number", "order_date", "status", "gross_total_cents"].includes(
              column.key,
            ),
          )}
          rows={(result.data ?? []).map((row) => ({
            id: row.id,
            number: row.number,
            order_date: new Intl.DateTimeFormat("it-IT", {
              dateStyle: "short",
              timeZone: "Europe/Rome",
            }).format(new Date(`${row.order_date}T12:00:00Z`)),
            status: t(`statuses.${row.status}`),
            brand: row.brands?.name ?? "",
            customer: row.customers?.legal_name ?? "",
            season: row.seasons?.code ?? "",
            gross_total_cents: formatMoney(row.gross_total_cents),
          }))}
        />
      )}
    </>
  );
}
