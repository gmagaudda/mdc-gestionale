"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { paginationItems } from "@/lib/queries/pagination";
type Props = { page: number; pageCount: number } & (
  | { hrefs: Record<number, string>; onPageChange?: never }
  | { hrefs?: never; onPageChange: (page: number) => void }
);
export function TablePagination({
  page,
  pageCount,
  hrefs,
  onPageChange,
}: Props) {
  const t = useTranslations("lists");
  const count = Math.max(1, pageCount);
  const control = (target: number, label: string, current = false) => {
    const disabled = target < 1 || target > count;
    const accessibleLabel = /^\d+$/.test(label)
      ? t(current ? "currentPage" : "goToPage", { page: target })
      : label;
    if (hrefs && !disabled)
      return (
        <Link
          href={hrefs[target]}
          className="pagination-item"
          aria-label={accessibleLabel}
          aria-current={current ? "page" : undefined}
        >
          {label}
        </Link>
      );
    if (hrefs)
      return (
        <span className="pagination-item" aria-disabled="true">
          {label}
        </span>
      );
    return (
      <Button
        className="pagination-item"
        variant="secondary"
        disabled={disabled}
        aria-current={current ? "page" : undefined}
        aria-label={accessibleLabel}
        onClick={() => onPageChange?.(target)}
      >
        {label}
      </Button>
    );
  };
  return (
    <nav className="table-pagination" aria-label={t("pagination")}>
      <span>{control(page - 1, t("previous"))}</span>
      {paginationItems(page, count).map((item) =>
        typeof item === "number" ? (
          <span key={item}>{control(item, String(item), item === page)}</span>
        ) : (
          <span className="pagination-gap" key={item} aria-hidden="true">
            …
          </span>
        ),
      )}
      <span>{control(page + 1, t("next"))}</span>
      <span className="sr-only">{t("page", { page, pages: count })}</span>
    </nav>
  );
}
