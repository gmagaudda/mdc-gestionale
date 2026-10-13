export function paginationItems(
  page: number,
  pageCount: number,
): (number | "gap-start" | "gap-end")[] {
  const count = Math.max(1, pageCount);
  const current = Math.min(count, Math.max(1, page));
  if (count <= 5) return Array.from({ length: count }, (_, index) => index + 1);
  const start =
    current <= 3 ? 1 : current >= count - 2 ? count - 2 : current - 1;
  const end = Math.min(count, start + 2);
  return [
    ...(start > 1 ? [1, ...(start > 2 ? ["gap-start" as const] : [])] : []),
    ...Array.from({ length: end - start + 1 }, (_, index) => start + index),
    ...(end < count
      ? [...(end < count - 1 ? ["gap-end" as const] : []), count]
      : []),
  ];
}
