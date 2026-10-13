"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  SortableDataTable,
  type SortableDataTableProps,
} from "@/components/arc/sortable-data-table/sortable-data-table";

// Arc has no locale props. Add Italian accessible names and announcements here.
export function ArcDataTable<T extends Record<string, unknown>>(
  props: SortableDataTableProps<T> & { selectionControl?: ReactNode },
) {
  const { selectionControl, ...tableProps } = props;
  const t = useTranslations("lists");
  const common = useTranslations("common");
  const container = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const [selectionHost, setSelectionHost] = useState<HTMLSpanElement | null>(
    null,
  );
  const hasSelection = Boolean(selectionControl);
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      container.current = node;
      if (!node || !hasSelection) return;
      const header = node.querySelector("thead th");
      const sortButton = header?.querySelector('button[data-nav="head"]');
      if (!header || !sortButton) return;
      const existing = header.querySelector<HTMLSpanElement>(
        ".table-selection-control",
      );
      if (existing) {
        setSelectionHost(existing);
        return;
      }
      // Compose the selection control beside Arc's unchanged sort button.
      const heading = document.createElement("div");
      heading.className = "table-selection-heading";
      const host = document.createElement("span");
      host.className = "table-selection-control";
      header.insertBefore(heading, sortButton);
      heading.append(host, sortButton);
      setSelectionHost(host);
    },
    [hasSelection],
  );
  useEffect(() => {
    const table = container.current?.querySelector("table");
    const scroller = table?.parentElement;
    if (!table || !scroller) return;
    const update = () => {
      table
        .querySelectorAll<HTMLButtonElement>(
          'thead th[data-key] button[data-nav="head"]',
        )
        .forEach((button) => {
          const header = button.closest("th")!;
          const column = props.columns.find(
            (column) => column.key === header.getAttribute("data-key"),
          );
          if (column)
            button.setAttribute(
              "aria-label",
              t("sortBy", {
                field: column.label,
                direction: t(
                  header.getAttribute("aria-sort") === "ascending"
                    ? "desc"
                    : "asc",
                ),
              }),
            );
        });
      table.parentElement?.parentElement
        ?.querySelector('p[role="status"]')
        ?.setAttribute("aria-hidden", "true");
      if (
        scroller.scrollWidth > scroller.clientWidth &&
        !scroller.querySelector("a[href], button, input, select, textarea")
      ) {
        scroller.tabIndex = 0;
        scroller.setAttribute("role", "region");
        scroller.setAttribute(
          "aria-label",
          common("tableRegion", { caption: props.caption ?? "" }),
        );
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
  }, [props.columns, props.caption, t, common, announcement]);
  return (
    <div className="data-table" ref={attach}>
      <SortableDataTable
        {...tableProps}
        onSortChange={(sort) => {
          const column = props.columns.find(
            (column) => column.key === sort.key,
          )!;
          setAnnouncement(
            t("sortAnnouncement", {
              field: column.label,
              direction: t(sort.direction),
            }),
          );
          props.onSortChange?.(sort);
        }}
      />
      {selectionHost &&
        selectionControl &&
        createPortal(selectionControl, selectionHost)}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  );
}
