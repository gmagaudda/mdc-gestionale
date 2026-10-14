import { Suspense, type ReactNode } from "react";
import { TableMetrics } from "./table-metrics";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { TablePagination } from "./table-pagination";
import { paginationItems } from "@/lib/queries/pagination";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { DataTable, type ListRow, type ListColumn } from "./data-table";
import {
  listHref,
  columnFilterParams,
  type ListQuery,
} from "@/lib/queries/list";
import { listExportEntitySchema } from "@/lib/exports/lists";
import { parseColumnFilters } from "@/lib/queries/column-filters";
import { getListColumnFilters } from "./list-column-filters";
import { SelectableListTable } from "./selectable-list-table";
import { ListCsvDownload } from "./list-csv-download";
import { ErpIcon } from "./erp-icon";
import { ListToolbar } from "./list-toolbar";
import type { TableFilterField } from "./table-filter-toolbar";
import { Alert } from "@/components/arc/alert/alert";

export async function ListView({
  base,
  query,
  rows,
  count,
  columns,
  title,
  filterParams = {},
  emptyDescription,
  exportBase,
  createAction,
  filters,
  actions,
  showMetrics = true,
  wrapTable,
}: {
  base: string;
  query: ListQuery;
  rows: ListRow[];
  count: number;
  columns: ListColumn[];
  title: string;
  filterParams?: Record<string, string>;
  emptyDescription?: string;
  exportBase?: string;
  createAction?: { href: string; label: string };
  filters?: TableFilterField[];
  actions?: ReactNode;
  showMetrics?: boolean;
  wrapTable?: (table: ReactNode) => ReactNode;
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
  const hiddenFilters = {
    ...filterParams,
    ...columnFilterParams(query.columnFilters),
  };
  const parameters = {
    ...hiddenFilters,
    q: query.q,
    sort: query.sort,
    direction: query.direction,
  };
  const table = !validColumns ? (
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
      sorting={{ base, query, filterParams }}
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
      sorting={{ base, query, filterParams }}
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
  );
  return (
    <section className="stack list-controls" aria-label={title}>
      {validColumns && showMetrics && (
        <Suspense
          fallback={
            <div className="table-metrics">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} label={t("loadingMetrics")} lines={3} />
              ))}
            </div>
          }
        >
          <TableMetrics base={base} query={query} filterParams={filterParams} />
        </Suspense>
      )}
      <ListToolbar
        base={base}
        query={query.q}
        parameters={parameters}
        filters={[
          ...(filters ?? []),
          ...(exportEntity.success
            ? await getListColumnFilters(exportEntity.data, query)
            : []),
        ]}
      >
        {createAction && (
          <Link className="list-add-link" href={createAction.href}>
            <ErpIcon name="plus" />
            <span className="list-button-copy">{createAction.label}</span>
          </Link>
        )}
        {validColumns && exportHref && (
          <ListCsvDownload
            href={`${exportHref}?${new URLSearchParams(parameters)}`}
            fileName={`${base.slice(1)}.csv`}
          />
        )}
        {actions}
      </ListToolbar>
      {wrapTable ? wrapTable(table) : table}
      {validColumns && (
        <div className="list-footer">
          <p role="status">{t("count", { count })}</p>
          <TablePagination
            page={query.page}
            pageCount={pages}
            hrefs={Object.fromEntries(
              [
                ...paginationItems(query.page, pages).filter(
                  (item): item is number => typeof item === "number",
                ),
                query.page - 1,
                query.page + 1,
              ].map((page) => [
                page,
                listHref(base, query, { page }, filterParams),
              ]),
            )}
          />
        </div>
      )}
    </section>
  );
}
