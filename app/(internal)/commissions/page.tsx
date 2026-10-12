import { LoadError } from "@/components/shared/load-error";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/arc/alert/alert";
import { DataTable } from "@/components/shared/data-table";
import { ListView } from "@/components/shared/list-view";
import { EmptyState } from "@/components/shared/empty-state";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { searchBudgetBrands } from "@/modules/budgets/actions";
import { DashboardFiltersForm } from "@/modules/dashboard/components/dashboard-filters";
import { commissionsFiltersSchema } from "@/modules/commissions/schema";
import { getCommissionsReport } from "@/modules/commissions/queries";
import { CommissionExportButton } from "@/modules/commissions/components/export-button";
export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(internalRoles);
  const t = await getTranslations("commissions"),
    input = await searchParams,
    parsed = commissionsFiltersSchema.safeParse(input),
    filters = parsed.success ? parsed.data : commissionsFiltersSchema.parse({});
  const query = parseListQuery(input, ["order_date"], "order_date", "desc");
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
  const report = parsed.success
    ? await getCommissionsReport(
        filters,
        (query.page - 1) * query.size,
        query.size,
      )
    : null;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => !!v),
  ).toString();
  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("hint")}</p>
      <DashboardFiltersForm
        base="/commissions"
        initial={filters}
        brands={brands.data}
        season={
          season
            ? { value: season.id, label: `${season.code} · ${season.name}` }
            : undefined
        }
      />
      {!parsed.success ? (
        <Alert tone="danger" title={t("invalidFilters")} />
      ) : !report?.ok ? (
        <LoadError title={t("loadError")} />
      ) : (
        <>
          <section className="stack" aria-label={t("summary")}>
            <h2>{t("summary")}</h2>
            <dl className="report-metrics">
              <div>
                <dt>{t("net")}</dt>
                <dd className="report-value">
                  <AnimatedMoney cents={BigInt(report.data.net_cents)} />
                </dd>
              </div>
              <div>
                <dt>{t("total")}</dt>
                <dd className="report-value">
                  <AnimatedMoney cents={BigInt(report.data.commission_cents)} />
                </dd>
              </div>
            </dl>
          </section>
          <CommissionExportButton key={params} params={params} />
          {!report.data.order_count ? (
            <EmptyState title={t("empty")} description={t("emptyHint")} />
          ) : (
            <>
              <section className="stack" aria-label={t("byBrand")}>
                <h2>{t("byBrand")}</h2>
                {report.data.brand_count > report.data.brands.length && (
                  <p>
                    {t("shownBrands", {
                      shown: report.data.brands.length,
                      total: report.data.brand_count,
                    })}
                  </p>
                )}
                <DataTable
                  caption={t("byBrand")}
                  emptyMessage={t("empty")}
                  rows={report.data.brands.map((b) => ({
                    id: b.brand_id,
                    brand: b.brand_name,
                    net: formatMoney(BigInt(b.net_cents)),
                    commission: formatMoney(BigInt(b.commission_cents)),
                    orders: String(b.order_count),
                  }))}
                  columns={[
                    { key: "brand", label: t("brand") },
                    { key: "net", label: t("net") },
                    { key: "commission", label: t("total") },
                    { key: "orders", label: t("orders") },
                  ]}
                />
              </section>
              <h2>{t("orders")}</h2>
              <ListView
                base="/commissions"
                title={t("orders")}
                query={query}
                count={report.data.order_count}
                filterParams={filters}
                rows={report.data.orders.map((o) => ({
                  id: o.id,
                  number: o.number,
                  date: new Intl.DateTimeFormat("it-IT", {
                    timeZone: "UTC",
                  }).format(new Date(`${o.order_date}T00:00:00Z`)),
                  brand: o.brand_name,
                  rate: `${new Intl.NumberFormat("it-IT").format(Number(o.commission_pct))}%`,
                  source: t(o.has_override ? "override" : "brandRate"),
                  net: formatMoney(BigInt(o.net_cents)),
                  commission: formatMoney(BigInt(o.commission_cents)),
                }))}
                columns={[
                  { key: "number", label: t("number"), linkBase: "/orders" },
                  { key: "date", label: t("date") },
                  { key: "brand", label: t("brand") },
                  { key: "rate", label: t("rate") },
                  { key: "source", label: t("source") },
                  { key: "net", label: t("net") },
                  { key: "commission", label: t("total") },
                ]}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
