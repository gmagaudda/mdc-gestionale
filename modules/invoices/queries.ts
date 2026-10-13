import "server-only";
import {
  parseColumnFilters,
  applyColumnFilters,
} from "@/lib/queries/column-filters";
import { createClient } from "@/lib/supabase/server";
import {
  escapeLike,
  listOrderColumn,
  type ListQuery,
} from "@/lib/queries/list";
import type { ExternalStatus } from "@/lib/invoicing/types";
export async function listInvoices(
  query: ListQuery,
  status?: ExternalStatus,
  overdue = false,
) {
  let request = (await createClient())
    .from("v_invoice_balances")
    .select("*,brands(name),customers(legal_name)", { count: "exact" })
    .order(listOrderColumn(query.sort), {
      ascending: query.direction === "asc",
    })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q)
    request = request.ilike("table_search", `%${escapeLike(query.q)}%`);
  if (status) request = request.eq("status", status);
  if (overdue) request = request.eq("overdue", true);
  const filters = parseColumnFilters(query.columnFilters, "invoices");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "invoices", filters.data);
}
export async function getInvoice(id: string) {
  return (await createClient())
    .from("invoices")
    .select(
      "*,brands(name),customers(legal_name),payments(id,amount_cents,paid_at,method,note)",
    )
    .eq("id", id)
    .maybeSingle();
}
export async function getOrderInvoice(orderId: string) {
  return (await createClient())
    .from("invoices")
    .select("id,status")
    .eq("order_id", orderId)
    .not("provider", "is", null)
    .maybeSingle();
}
