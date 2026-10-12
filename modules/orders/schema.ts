import {
  object,
  string,
  uuid,
  iso,
  literal,
  number,
  array,
  enum as enumeration,
  type infer as Infer,
} from "zod";
import { MAX_CENTS } from "@/lib/money";
export const orderStatuses = [
  "draft",
  "confirmed",
  "in_production",
  "shipped",
  "delivered",
  "invoiced",
  "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const orderHeaderSchema = object({
  brand_id: uuid(),
  customer_id: uuid(),
  season_id: uuid(),
  order_date: iso.date(),
  delivery_date: iso.date().or(literal("")),
  payment_terms: string().trim().max(500),
  discount_pct: number().min(0).max(100).multipleOf(0.01),
  commission_pct_override: number().min(0).max(100).multipleOf(0.01).nullable(),
  internal_notes: string().trim().max(10000),
}).refine(
  (value) => !value.delivery_date || value.delivery_date >= value.order_date,
  { path: ["delivery_date"], message: "dateRange" },
);
export const orderLineSchema = object({
  variant_id: uuid(),
  quantity: number().int().min(1).max(100000),
  unit_price_cents: number().int().min(0).max(MAX_CENTS),
  discount_pct: number().min(0).max(100).multipleOf(0.01),
});
export const orderSchema = object({
  header: orderHeaderSchema,
  lines: array(orderLineSchema)
    .max(500)
    .refine(
      (value) =>
        new Set(value.map((row) => row.variant_id)).size === value.length,
    ),
});
export const statusSchema = object({
  id: uuid(),
  status: enumeration(orderStatuses),
  note: string().trim().max(1000),
});
export type OrderInput = Infer<typeof orderSchema>;
export type OrderLineInput = Infer<typeof orderLineSchema>;
