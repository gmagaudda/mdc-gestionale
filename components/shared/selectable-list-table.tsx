"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Button } from "@/components/arc/button/button";
import { DataTable, type ListColumn, type ListRow } from "./data-table";
import { ListCsvDownload } from "./list-csv-download";
import { AnimatedNumber } from "./animated-number";
import { EmptyState } from "./empty-state";

export function SelectableListTable({
  rows,
  columns,
  caption,
  emptyMessage,
  exportHref,
  fileName,
  clearHref,
}: {
  rows: ListRow[];
  columns: ListColumn[];
  caption: string;
  emptyMessage: string;
  exportHref: string;
  fileName: string;
  clearHref?: string;
}) {
  const t = useTranslations("lists");
  const [keys, setKeys] = useState<string[]>([]);
  const selected = keys.filter((key) => rows.some((row) => row.id === key));
  const href = `${exportHref}&${new URLSearchParams({ ids: selected.join(",") })}`;
  return (
    <div className="stack">
      <div className="form-actions report-actions">
        <ListCsvDownload href={exportHref} fileName={fileName} />
        {selected.length > 0 && (
          <ListCsvDownload
            href={href}
            fileName={fileName}
            label={t("exportSelected")}
          />
        )}
      </div>
      {rows.length > 0 && (
        <div className="stack">
          <div className="form-actions report-actions">
            <Checkbox
              label={t("selectPage")}
              checked={
                selected.length === rows.length
                  ? true
                  : selected.length
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) =>
                setKeys(checked === true ? rows.map((row) => row.id) : [])
              }
            />
            <p role="status">
              {t.rich("selectedRows", {
                count: selected.length,
                number: () => <AnimatedNumber value={selected.length} />,
              })}
            </p>
            {selected.length > 0 && (
              <Button variant="ghost" size="lg" onClick={() => setKeys([])}>
                <span className="list-button-copy">{t("clearSelection")}</span>
              </Button>
            )}
          </div>
          <p>{t("selectionHint")}</p>
        </div>
      )}
      {rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          caption={caption}
          emptyMessage={emptyMessage}
          selection={{ keys: selected, onChange: setKeys }}
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
    </div>
  );
}
