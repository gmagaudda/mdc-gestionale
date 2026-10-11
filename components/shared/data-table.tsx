"use client";
import Link from "next/link";
import { SortableDataTable } from "@/components/arc/sortable-data-table/sortable-data-table";

export type ListRow = { id: string; [key: string]: string | number | null };
export type ListColumn = {
  key: string;
  label: string;
  linkBase?: string;
  numeric?: boolean;
};
export function DataTable({
  rows,
  columns,
  caption,
  emptyMessage,
}: {
  rows: ListRow[];
  columns: ListColumn[];
  caption: string;
  emptyMessage: string;
}) {
  const render = (column: ListColumn, row: ListRow) =>
    column.linkBase ? (
      <Link
        className="text-link wrap-value"
        href={`${column.linkBase}/${row.id}`}
      >
        {String(row[column.key] ?? "")}
      </Link>
    ) : (
      <span className="wrap-value">{String(row[column.key] ?? "")}</span>
    );
  return (
    <>
      <div className="desktop-table">
        <SortableDataTable
          rows={rows}
          rowKey="id"
          caption={caption}
          emptyMessage={emptyMessage}
          columns={columns.map((column) => ({
            ...column,
            sortable: false,
            render: (value: unknown, row: ListRow) =>
              column.linkBase ? (
                <Link
                  className="text-link wrap-value"
                  href={`${column.linkBase}/${row.id}`}
                >
                  {String(value ?? "")}
                </Link>
              ) : (
                <span className="wrap-value">{String(value ?? "")}</span>
              ),
          }))}
        />
      </div>
      <div className="mobile-cards" role="list" aria-label={caption}>
        {rows.map((row) => (
          <article className="data-card" role="listitem" key={row.id}>
            <dl>
              {columns.slice(0, 4).map((column) => (
                <div key={column.key}>
                  <dt>{column.label}</dt>
                  <dd>{render(column, row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
