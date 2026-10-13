"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listHref, type ListQuery } from "@/lib/queries/list";
import { tableSortValue } from "@/lib/queries/table-sort";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Copy } from "lucide-react";
import { ArcDataTable } from "./arc-data-table";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Checkbox } from "@/components/arc/checkbox/checkbox";

export type ListRow = { id: string; [key: string]: string | number | null };
export type ListColumn = {
  key: string;
  label: string;
  linkBase?: string;
  download?: boolean;
  linkEnabledKey?: string;
  numeric?: boolean;
  width?: string | number;
  copyValue?: boolean;
  sortKey?: string;
};
export function DataTable({
  rows,
  columns,
  caption,
  emptyMessage,
  selection,
  sorting,
}: {
  rows: ListRow[];
  columns: ListColumn[];
  caption: string;
  emptyMessage: string;
  selection?: { keys: string[]; onChange: (keys: string[]) => void };
  sorting?: {
    base: string;
    query: ListQuery;
    filterParams: Record<string, string>;
  };
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const lists = useTranslations("lists");
  const [feedback, setFeedback] = useState("");
  const render = (column: ListColumn, row: ListRow) =>
    column.linkBase &&
    column.download &&
    (!column.linkEnabledKey || row[column.linkEnabledKey] === 1) ? (
      <a className="text-link wrap-value" href={`${column.linkBase}/${row.id}`}>
        {String(row[column.key] ?? "")}
      </a>
    ) : column.linkBase && !column.download ? (
      <Link
        className="text-link wrap-value"
        href={`${column.linkBase}/${row.id}`}
      >
        {String(row[column.key] ?? "")}
      </Link>
    ) : column.copyValue ? (
      <div className="copy-value">
        <span className="wrap-value">{String(row[column.key] ?? "")}</span>
        <Button
          variant="ghost"
          size="lg"
          aria-label={t("copyValue", { value: String(row[column.key] ?? "") })}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                String(row[column.key] ?? ""),
              );
              setFeedback(t("copied"));
            } catch {
              setFeedback(t("copyError"));
            }
          }}
        >
          <Copy size={16} aria-hidden="true" />
        </Button>
      </div>
    ) : (
      <span className="wrap-value">{String(row[column.key] ?? "")}</span>
    );
  const selectRow = (row: ListRow) => {
    const label = lists("selectRow", {
      value: String(row[columns[0]?.key] ?? row.id),
    });
    return (
      <Checkbox
        checked={selection!.keys.includes(row.id)}
        aria-label={label}
        onCheckedChange={(checked) =>
          selection!.onChange(
            checked === true
              ? [...new Set([...selection!.keys, row.id])]
              : selection!.keys.filter((key) => key !== row.id),
          )
        }
      />
    );
  };
  if (!rows.length)
    return (
      <EmptyState title={caption} description={emptyMessage} label={caption} />
    );
  return (
    <>
      <ArcDataTable
        key={sorting ? JSON.stringify(sorting) : caption}
        // The server already sorted the complete result. Ranks preserve its
        // collation and null placement instead of sorting formatted page cells again.
        rows={rows.map((row, index) => ({
          ...row,
          ...Object.fromEntries(
            columns.map((column) => [
              `_sort:${column.sortKey ?? column.key}`,
              sorting
                ? sorting.query.direction === "asc"
                  ? index
                  : -index
                : tableSortValue(row[column.sortKey ?? column.key]),
            ]),
          ),
        }))}
        defaultSort={
          sorting
            ? {
                key: `_sort:${sorting.query.sort}`,
                direction: sorting.query.direction,
              }
            : undefined
        }
        onSortChange={(sort) => {
          const key = sort.key.slice(6);
          if (sorting)
            router.push(
              listHref(
                sorting.base,
                sorting.query,
                { page: 1, sort: key, direction: sort.direction },
                sorting.filterParams,
              ),
            );
        }}
        selectionControl={
          selection ? (
            <Checkbox
              aria-label={lists("selectPage")}
              checked={
                selection.keys.length === rows.length
                  ? true
                  : selection.keys.length
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) =>
                selection.onChange(
                  checked === true ? rows.map((row) => row.id) : [],
                )
              }
            />
          ) : undefined
        }
        rowKey="id"
        caption={caption}
        emptyMessage={emptyMessage}
        columns={[
          ...columns.map((column, index) => ({
            label: column.label,
            // Explicit widths keep Arc's fixed layout from squeezing header labels.
            width:
              column.width ??
              `calc(${column.label.length + 4}ch + var(--space-4) * 2${selection && index === 0 ? " + var(--control-height-md) + var(--space-4)" : ""})`,
            key: `_sort:${column.sortKey ?? column.key}`,
            sortable: true,
            numeric:
              column.numeric ??
              rows.some((row) => typeof row[column.key] === "number"),
            render: (_value: unknown, row: ListRow) => (
              <>
                {index > 0 && (
                  <span className="table-cell-label" aria-hidden="true">
                    {column.label}:{" "}
                  </span>
                )}
                {selection && index === 0 ? (
                  <div className="table-leading-cell">
                    <span className="table-selection-control">
                      {selectRow(row)}
                    </span>
                    <div className="table-leading-value">
                      {render(column, row)}
                    </div>
                  </div>
                ) : (
                  render(column, row)
                )}
              </>
            ),
          })),
        ]}
      />
      <p role="status">{feedback}</p>
    </>
  );
}
