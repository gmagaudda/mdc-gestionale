import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "./empty-state";
import { DataTable, type ListRow, type ListColumn } from "./data-table";
import { listHref, type ListQuery } from "@/lib/queries/list";

export async function ListView({
  base,
  query,
  rows,
  count,
  columns,
  title,
  searchLabel,
  sortable = [],
}: {
  base: string;
  query: ListQuery;
  rows: ListRow[];
  count: number;
  columns: ListColumn[];
  title: string;
  searchLabel?: string;
  sortable?: ListColumn[];
}) {
  const t = await getTranslations("lists");
  const pages = Math.max(1, Math.ceil(count / query.size));
  return (
    <section className="stack" aria-label={title}>
      {searchLabel && (
        <form action={base} className="list-search">
          <input type="hidden" name="sort" value={query.sort} />
          <input type="hidden" name="direction" value={query.direction} />
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
              href={listHref(base, query, {
                page: 1,
                sort: column.key,
                direction:
                  query.sort === column.key && query.direction === "asc"
                    ? "desc"
                    : "asc",
              })}
            >
              {t("sortBy", {
                field: column.label,
                direction: query.sort === column.key ? t(query.direction) : "",
              })}
            </Link>
          ))}
        </nav>
      )}
      {rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          caption={title}
          emptyMessage={t("emptyTitle")}
        />
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          description={t(query.q ? "emptySearch" : "emptyDescription")}
          action={
            query.q ? (
              <Link className="text-link" href={base}>
                {t("clearFilters")}
              </Link>
            ) : undefined
          }
        />
      )}
      <div className="list-footer">
        <p role="status">{t("count", { count })}</p>
        <nav className="list-sort" aria-label={t("pagination")}>
          {query.page > 1 && (
            <Link
              className="text-link"
              href={listHref(base, query, { page: query.page - 1 })}
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
              href={listHref(base, query, { page: query.page + 1 })}
            >
              {t("next")}
            </Link>
          )}
        </nav>
      </div>
    </section>
  );
}
