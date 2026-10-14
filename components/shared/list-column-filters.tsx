import { getTranslations } from "next-intl/server";
import { columnFilters } from "@/lib/queries/column-filters";
import { listExports, type ListExportEntity } from "@/lib/exports/lists";
import type { ListQuery } from "@/lib/queries/list";
import { formatMoney, parseCents } from "@/lib/money";
import { tableFilterOptions } from "@/lib/queries/table-filter-options";
import type { TableFilterField } from "./table-filter-toolbar";
export async function getListColumnFilters(
  entity: ListExportEntity,
  query: ListQuery,
): Promise<TableFilterField[]> {
  const labels = await getTranslations(listExports[entity].namespace);
  return columnFilters[entity]
    .filter((field) => field.kind !== "date")
    .map((field) => {
      const value =
        typeof query.columnFilters?.[field.key] === "string"
          ? (query.columnFilters[field.key] as string)
          : "";
      const cents = field.kind === "money" ? parseCents(value) : null;
      return {
        name: `cf_${field.key}`,
        label: labels(field.label),
        value,
        options: value
          ? [{ value, label: cents === null ? value : formatMoney(cents) }]
          : [],
        loadOptions: tableFilterOptions.bind(null, entity, field.key),
      };
    });
}
