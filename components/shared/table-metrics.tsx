import { getTranslations } from "next-intl/server";
import { getTableMetrics } from "@/lib/metrics/queries";
import { LoadError } from "./load-error";
import { TableMetricCards } from "./table-metric-cards";
import type { ListQuery } from "@/lib/queries/list";
export async function TableMetrics({
  base,
  query,
  filterParams = {},
}: {
  base: string;
  query?: ListQuery;
  filterParams?: Record<string, string>;
}) {
  const t = await getTranslations("tableMetrics");
  const result = await getTableMetrics(
    base,
    query?.q ?? "",
    filterParams,
    query?.columnFilters,
  );
  return result.ok ? (
    <TableMetricCards data={result.data} />
  ) : (
    <LoadError title={t("loadError")} />
  );
}
