import { z } from "zod";
import { parseCents } from "@/lib/money";
import { escapeLike } from "./list";
import type { ListExportEntity } from "@/lib/exports/lists";
export type ColumnFilter = {
  key: string;
  label: string;
  kind: "text" | "money" | "date" | "integer";
};
export const columnFilters: Record<ListExportEntity, ColumnFilter[]> = {
  brands: [
    { key: "name", label: "name", kind: "text" },
    { key: "legal_name", label: "legal_name", kind: "text" },
  ],
  customers: [
    { key: "legal_name", label: "legal_name", kind: "text" },
    { key: "trade_name", label: "trade_name", kind: "text" },
    { key: "city", label: "city", kind: "text" },
  ],
  seasons: [
    { key: "code", label: "code", kind: "text" },
    { key: "name", label: "name", kind: "text" },
  ],
  products: [
    { key: "name", label: "name", kind: "text" },
    { key: "sku_base", label: "sku_base", kind: "text" },
    {
      key: "wholesale_price_cents",
      label: "wholesale_price_cents",
      kind: "money",
    },
  ],
  budgets: [
    { key: "amount_cents", label: "amount", kind: "money" },
    { key: "period_start", label: "start", kind: "date" },
    { key: "period_end", label: "end", kind: "date" },
  ],
  documents: [
    { key: "name", label: "name", kind: "text" },
    { key: "size_bytes", label: "fileSizeBytes", kind: "integer" },
  ],
  invoices: [
    { key: "number", label: "number", kind: "text" },
    { key: "issue_date", label: "issueDate", kind: "date" },
    { key: "due_date", label: "dueDate", kind: "date" },
    { key: "gross_cents", label: "gross", kind: "money" },
  ],
};
const rawSchema = z.record(z.string(), z.string().trim().max(100));
export function parseColumnFilters(
  input: unknown,
  entity: ListExportEntity,
): { ok: true; data: Record<string, string> } | { ok: false } {
  const raw = rawSchema.safeParse(input ?? {});
  if (
    !raw.success ||
    Object.keys(raw.data).length > columnFilters[entity].length
  )
    return { ok: false };
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.data)) {
    const field = columnFilters[entity].find((field) => field.key === key);
    if (!field) return { ok: false };
    if (!value) continue;
    if (field.kind === "money") {
      const cents = parseCents(value);
      if (cents === null) return { ok: false };
      data[key] = String(cents);
    } else if (field.kind === "date") {
      if (!z.iso.date().safeParse(value).success || value.startsWith("0000-"))
        return { ok: false };
      data[key] = value;
    } else if (field.kind === "integer") {
      if (!/^\d+$/.test(value) || BigInt(value) > 10_485_760n)
        return { ok: false };
      data[key] = String(BigInt(value));
    } else data[key] = value;
  }
  return { ok: true, data };
}
type FilterQuery<T> = {
  ilike(column: string, pattern: string): T;
  eq(column: string, value: unknown): T;
};
export function applyColumnFilters<T extends FilterQuery<T>>(
  request: T,
  entity: ListExportEntity,
  values: Record<string, string>,
): T {
  for (const [key, value] of Object.entries(values))
    request =
      columnFilters[entity].find((field) => field.key === key)!.kind === "text"
        ? request.ilike(key, `%${escapeLike(value)}%`)
        : request.eq(key, value);
  return request;
}
export function captureColumnFilters(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => key.startsWith("cf_"))
      .map(([key, value]) => [key.slice(3), value]),
  );
}
export function columnFilterParams(input?: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input ?? {})
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [`cf_${key}`, value as string]),
  );
}
