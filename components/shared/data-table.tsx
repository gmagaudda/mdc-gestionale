"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Copy } from "lucide-react";
import { SortableDataTable } from "@/components/arc/sortable-data-table/sortable-data-table";
import { EmptyState } from "./empty-state";

export type ListRow = { id: string; [key: string]: string | number | null };
export type ListColumn = {
  key: string;
  label: string;
  linkBase?: string;
  download?: boolean;
  numeric?: boolean;
  copyValue?: boolean;
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
  const t = useTranslations("common");
  const [feedback, setFeedback] = useState("");
  const desktop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const table = desktop.current?.querySelector("table");
    const scroller = table?.parentElement;
    if (!table || !scroller) return;
    // Add keyboard access around the vendor table without changing Arc source.
    const update = () => {
      const needsFocus =
        scroller.scrollWidth > scroller.clientWidth &&
        !scroller.querySelector("a[href], button, input, select, textarea");
      if (needsFocus) {
        scroller.tabIndex = 0;
        scroller.setAttribute("role", "region");
        scroller.setAttribute("aria-label", t("tableRegion", { caption }));
      } else {
        scroller.removeAttribute("tabindex");
        scroller.removeAttribute("role");
        scroller.removeAttribute("aria-label");
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    observer.observe(table);
    return () => observer.disconnect();
  }, [rows, columns, caption, t]);
  const render = (column: ListColumn, row: ListRow) =>
    column.linkBase && column.download ? (
      <a className="text-link wrap-value" href={`${column.linkBase}/${row.id}`}>
        {String(row[column.key] ?? "")}
      </a>
    ) : column.linkBase ? (
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
  if (!rows.length)
    return (
      <EmptyState title={caption} description={emptyMessage} label={caption} />
    );
  return (
    <>
      <div className="desktop-table" ref={desktop}>
        <SortableDataTable
          rows={rows}
          rowKey="id"
          caption={caption}
          emptyMessage={emptyMessage}
          columns={columns.map((column) => ({
            ...column,
            sortable: false,
            render: (_value: unknown, row: ListRow) => render(column, row),
          }))}
        />
      </div>
      <p role="status">{feedback}</p>
      <div className="mobile-cards" role="list" aria-label={caption}>
        {rows.map((row) => (
          <article className="data-card" role="listitem" key={row.id}>
            <dl>
              {columns.map((column) => (
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
