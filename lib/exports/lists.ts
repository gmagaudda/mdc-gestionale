import { z } from "zod";
import { externalStatusSchema } from "@/lib/invoicing/types";
export const listExportEntitySchema = z.enum([
  "brands",
  "customers",
  "seasons",
  "products",
  "budgets",
  "documents",
  "invoices",
]);
export type ListExportEntity = z.infer<typeof listExportEntitySchema>;
type Column = {
  key: string;
  label: string;
  kind?: "money" | "status" | "documentKind" | "visibility";
};
export const listExports: Record<
  ListExportEntity,
  {
    namespace: string;
    sort: readonly string[];
    defaultSort: string;
    columns: Column[];
  }
> = {
  brands: {
    namespace: "brands",
    sort: ["name", "legal_name"],
    defaultSort: "name",
    columns: [
      { key: "name", label: "name" },
      { key: "legal_name", label: "legal_name" },
    ],
  },
  customers: {
    namespace: "customers",
    sort: ["legal_name", "trade_name", "city"],
    defaultSort: "legal_name",
    columns: [
      { key: "legal_name", label: "legal_name" },
      { key: "trade_name", label: "trade_name" },
      { key: "city", label: "city" },
    ],
  },
  seasons: {
    namespace: "catalog",
    sort: ["code", "name"],
    defaultSort: "code",
    columns: [
      { key: "code", label: "code" },
      { key: "name", label: "name" },
      { key: "brand", label: "brand" },
    ],
  },
  products: {
    namespace: "catalog",
    sort: ["name", "sku_base", "wholesale_price_cents"],
    defaultSort: "name",
    columns: [
      { key: "name", label: "name" },
      { key: "sku_base", label: "sku_base" },
      { key: "brand", label: "brand" },
      { key: "season", label: "season" },
      {
        key: "wholesale_price_cents",
        label: "wholesale_price_cents",
        kind: "money",
      },
    ],
  },
  budgets: {
    namespace: "budgets",
    sort: ["period_start", "amount_cents", "created_at"],
    defaultSort: "period_start",
    columns: [
      { key: "brand", label: "brand" },
      { key: "season", label: "season" },
      { key: "customer", label: "customer" },
      { key: "amount_cents", label: "amount", kind: "money" },
      { key: "period_start", label: "start" },
      { key: "period_end", label: "end" },
    ],
  },
  documents: {
    namespace: "documents",
    sort: ["name", "created_at"],
    defaultSort: "created_at",
    columns: [
      { key: "name", label: "name" },
      { key: "brand", label: "brand" },
      { key: "kind", label: "kind", kind: "documentKind" },
      { key: "shared_with_brand", label: "visibility", kind: "visibility" },
      { key: "size_bytes", label: "fileSize" },
    ],
  },
  invoices: {
    namespace: "invoices",
    sort: ["due_date", "issue_date", "number"],
    defaultSort: "due_date",
    columns: [
      { key: "number", label: "number" },
      { key: "brand", label: "supplier" },
      { key: "customer", label: "customer" },
      { key: "status", label: "status", kind: "status" },
      { key: "issue_date", label: "issueDate" },
      { key: "due_date", label: "dueDate" },
      { key: "gross_cents", label: "gross", kind: "money" },
      { key: "paid_cents", label: "paid", kind: "money" },
      { key: "balance_cents", label: "balance", kind: "money" },
    ],
  },
};
export const listExportFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  sort: z.string().optional(),
  direction: z.enum(["asc", "desc"]).default("asc"),
  status: z.union([externalStatusSchema, z.literal("all")]).default("all"),
  overdue: z.enum(["all", "yes"]).default("all"),
});
export const listExportReportSchema = z
  .object({
    rows: z
      .array(
        z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        ),
      )
      .max(10001),
  })
  .strict();
