export type ListQuery = {
  page: number;
  size: number;
  q: string;
  sort: string;
  direction: "asc" | "desc";
  columnFilters?: Record<string, unknown>;
};
export function parseListQuery(
  input: Record<string, string | string[] | undefined>,
  allowed: readonly string[],
  defaultSort = allowed[0],
  defaultDirection: "asc" | "desc" = "asc",
): ListQuery {
  const page = Number(input.page);
  const columnFilters = Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => key.startsWith("cf_"))
      .map(([key, value]) => [key.slice(3), value]),
  );
  return {
    ...(Object.keys(columnFilters).length ? { columnFilters } : {}),
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
    size: 25,
    q: typeof input.q === "string" ? input.q.trim().slice(0, 100) : "",
    sort:
      typeof input.sort === "string" && allowed.includes(input.sort)
        ? input.sort
        : defaultSort,
    direction:
      input.direction === "desc"
        ? "desc"
        : input.direction === "asc"
          ? "asc"
          : defaultDirection,
  };
}
export function listHref(
  base: string,
  query: ListQuery,
  changes: Partial<ListQuery> = {},
  filterParams: Record<string, string> = {},
) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams({
    ...filterParams,
    page: String(next.page),
    q: next.q,
    sort: next.sort,
    direction: next.direction,
    ...Object.fromEntries(
      Object.entries(next.columnFilters ?? {})
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [`cf_${key}`, value as string]),
    ),
  });
  return `${base}?${params}`;
}
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
