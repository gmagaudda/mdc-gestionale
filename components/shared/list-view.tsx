import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "./empty-state";
import { DataTable, type ListRow, type ListColumn } from "./data-table";
import { listHref, type ListQuery } from "@/lib/queries/list";
import { listExportEntitySchema } from "@/lib/exports/lists";
import {
  columnFilterParams,
  parseColumnFilters,
} from "@/lib/queries/column-filters";
import { ListColumnFilters } from "./list-column-filters";
import { SelectableListTable } from "./selectable-list-table";
import { Alert } from "@/components/arc/alert/alert";

export async function ListView({
  base,
  query,
  rows,
  count,
  columns,
  title,
  searchLabel,
  sortable = [],
  filterParams = {},
  emptyDescription,
  exportBase,
}: {
  base: string;
  query: ListQuery;
  rows: ListRow[];
  count: number;
  columns: ListColumn[];
  title: string;
  searchLabel?: string;
  sortable?: ListColumn[];
  filterParams?: Record<string, string>;
  emptyDescription?: string;
  exportBase?: string;
}) {
  const t = await getTranslations("lists");
  const pages = Math.max(1, Math.ceil(count / query.size));
  const exportEntity = listExportEntitySchema.safeParse(base.slice(1));
  const validColumns =
    !exportEntity.success ||
    parseColumnFilters(query.columnFilters, exportEntity.data).ok;
  const exportHref =
    exportBase ??
    (exportEntity.success
      ? `/api/lists/${exportEntity.data}/export`
      : undefined);
  const parameters = {
    ...filterParams,
    ...columnFilterParams(query.columnFilters),
    q: query.q,
    sort: query.sort,
    direction: query.direction,
  };
  return (
    <section className="stack list-controls" aria-label={title}>
      {exportEntity.success && (
        <ListColumnFilters
          entity={exportEntity.data}
          base={base}
          query={query}
          filterParams={filterParams}
        />
      )}
      {searchLabel && (
        <form action={base} className="list-search">
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="direction" value={query.direction} />
          {Object.entries({
            ...filterParams,
            ...columnFilterParams(query.columnFilters),
          }).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Input
            label={searchLabel}
            name="q"
            type="search"
            defaultValue={query.q}
          />
          <Button variant="secondary" size="lg" type="submit">
            {t("search")}
          </Button>
        </form>
      )}
      {sortable.length > 0 && (
        <nav className="list-sort" aria-label={t("sorting")}>
          {sortable.map((column) => (
            <Link
              className="text-link"
              key={column.key}
              href={listHref(
                base,
                query,
                {
                  page: 1,
                  sort: column.key,
                  direction:
                    query.sort === column.key && query.direction === "asc"
                      ? "desc"
                      : "asc",
                },
                filterParams,
              )}
            >
              {t("sortBy", {
                field: column.label,
                direction: query.sort === column.key ? t(query.direction) : "",
              })}
            </Link>
          ))}
        </nav>
      )}
      {!validColumns ? (
        <Alert tone="danger" title={t("columnFilterInvalid")}>
          <Link
            className="text-link"
            href={listHref(
              base,
              query,
              { page: 1, columnFilters: undefined },
              filterParams,
            )}
          >
            {t("clearColumnFilters")}
          </Link>
        </Alert>
      ) : exportHref ? (
        <SelectableListTable
          key={JSON.stringify({ base, query, filterParams })}
          rows={rows}
          columns={columns}
          caption={title}
          emptyMessage={
            emptyDescription ??
            t(
              query.q || Object.keys(query.columnFilters ?? {}).length
                ? "emptySearch"
                : "emptyDescription",
            )
          }
          exportHref={`${exportHref}?${new URLSearchParams(parameters)}`}
          fileName={`${base.slice(1)}.csv`}
          clearHref={
            query.q ||
            Object.values(query.columnFilters ?? {}).some(Boolean) ||
            Object.values(filterParams).some(
              (value) => value !== "all" && value !== "",
            )
              ? base
              : undefined
          }
        />
      ) : rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          caption={title}
          emptyMessage={t("emptyTitle")}
        />
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          description={
            emptyDescription ?? t(query.q ? "emptySearch" : "emptyDescription")
          }
          action={
            query.q ? (
              <Link className="text-link" href={base}>
                {t("clearFilters")}
              </Link>
            ) : undefined
          }
        />
      )}
      {validColumns && (
        <div className="list-footer">
          <p role="status">{t("count", { count })}</p>
          <nav className="list-sort" aria-label={t("pagination")}>
            {query.page > 1 && (
              <Link
                className="text-link"
                href={listHref(
                  base,
                  query,
                  { page: query.page - 1 },
                  filterParams,
                )}
              >
                {t("previous")}
              </Link>
            )}
            <span className="tabular-nums">
              {t("page", { page: query.page, pages })}
            </span>
            {query.page < pages && (
              <Link
                className="text-link"
                href={listHref(
                  base,
                  query,
                  { page: query.page + 1 },
                  filterParams,
                )}
              >
                {t("next")}
              </Link>
            )}
          </nav>
        </div>
      )}
    </section>
  );
}
