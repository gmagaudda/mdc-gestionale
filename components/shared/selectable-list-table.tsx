"use client";
import type { ListQuery } from "@/lib/queries/list";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/arc/button/button";
import { DataTable, type ListColumn, type ListRow } from "./data-table";
import { ListCsvDownload } from "./list-csv-download";
import { AnimatedNumber } from "./animated-number";
import { EmptyState } from "@/components/arc/empty-state/empty-state";

export function SelectableListTable({
  rows,
  columns,
  caption,
  emptyMessage,
  exportHref,
  fileName,
  clearHref,
  sorting,
}: {
  rows: ListRow[];
  columns: ListColumn[];
  caption: string;
  emptyMessage: string;
  exportHref: string;
  fileName: string;
  clearHref?: string;
  sorting?: {
    base: string;
    query: ListQuery;
    filterParams: Record<string, string>;
  };
}) {
  const t = useTranslations("lists");
  const [keys, setKeys] = useState<string[]>([]);
  const selected = keys.filter((key) => rows.some((row) => row.id === key));
  const href = `${exportHref}&${new URLSearchParams({ ids: selected.join(",") })}`;
  return (
    <div className="stack">
      {rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          caption={caption}
          emptyMessage={emptyMessage}
          selection={{ keys: selected, onChange: setKeys }}
          sorting={sorting}
        />
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          description={emptyMessage}
          label={caption}
          action={
            clearHref ? (
              <Link className="text-link" href={clearHref}>
                {t("clearFilters")}
              </Link>
            ) : undefined
          }
        />
      )}
      {rows.length > 0 && (
        <div className="list-selection-footer">
          <p role="status">
            {t.rich("selectedRows", {
              count: selected.length,
              number: () => <AnimatedNumber value={selected.length} />,
            })}
          </p>
          {selected.length > 0 && (
            <>
              <Button variant="ghost" size="lg" onClick={() => setKeys([])}>
                <span className="list-button-copy">{t("clearSelection")}</span>
              </Button>
              <ListCsvDownload
                href={href}
                fileName={fileName}
                label={t("exportSelected")}
              />
            </>
          )}
          <p>{t("selectionHint")}</p>
        </div>
      )}
    </div>
  );
}
