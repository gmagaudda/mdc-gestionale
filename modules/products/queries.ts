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
export async function listProducts(query: ListQuery) {
  const db = await createClient();
  let request = db
    .from("products")
    .select(
      "id,name,sku_base,wholesale_price_cents,brands(name),seasons(code)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(listOrderColumn(query.sort), {
      ascending: query.direction === "asc",
    })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q)
    request = request.ilike("table_search", `%${escapeLike(query.q)}%`);
  const filters = parseColumnFilters(query.columnFilters, "products");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "products", filters.data);
}
export async function getProduct(id: string) {
  const db = await createClient();
  return db
    .from("products")
    .select("*,brands(name),seasons(code,name),product_variants(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
}
