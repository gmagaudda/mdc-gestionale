import { getTranslations } from "next-intl/server";
import { columnFilters } from "@/lib/queries/column-filters";
import { listExports, type ListExportEntity } from "@/lib/exports/lists";
import type { ListQuery } from "@/lib/queries/list";
import { tableFilterOptions } from "@/lib/queries/table-filter-options";
import { TableFilter } from "./table-filter";
export async function ListColumnFilters({
  entity,
  base,
  query,
}: {
  entity: ListExportEntity;
  base: string;
  query: ListQuery;
  filterParams?: Record<string, string>;
}) {
  const labels = await getTranslations(listExports[entity].namespace);
  return (
    <>
      {columnFilters[entity]
        .filter((field) => field.kind !== "date")
        .map((field) => {
          const value =
            typeof query.columnFilters?.[field.key] === "string"
              ? (query.columnFilters[field.key] as string)
              : "";
          const load = tableFilterOptions.bind(null, entity, field.key);
          return (
            <TableFilter
              key={field.key}
              base={base}
              name={`cf_${field.key}`}
              label={labels(field.label)}
              value={value}
              options={value ? [{ value, label: value }] : []}
              loadOptions={load}
            />
          );
        })}
    </>
  );
}
