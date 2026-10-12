import {
  object,
  uuid,
  literal,
  iso,
  enum as enumeration,
  type infer as Infer,
} from "zod";
import { parseListQuery } from "@/lib/queries/list";
import { orderStatuses } from "./schema";
const optionalId = uuid().or(literal("")).default("");
export const orderFiltersSchema = object({
  status: enumeration(orderStatuses).or(literal("")).default(""),
  brand_id: optionalId,
  customer_id: optionalId,
  season_id: optionalId,
  from: iso.date().or(literal("")).default(""),
  to: iso.date().or(literal("")).default(""),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ["to"],
});
export type OrderFilters = Infer<typeof orderFiltersSchema>;
export function orderListQuery(
  input: Record<string, string | string[] | undefined>,
) {
  return parseListQuery(
    input,
    ["number", "order_date", "status", "gross_total_cents"],
    "order_date",
    "desc",
  );
}
export function filterParams(filters: OrderFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  );
}
