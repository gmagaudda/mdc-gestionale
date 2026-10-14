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
export async function listProducts(query: ListQuery, brandId?: string) {
  const db = await createClient();
  let request = db
    .from("products")
    .select(
      "id,name,sku_base,wholesale_price_cents,brands!inner(name,deleted_at),seasons(code)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .is("brands.deleted_at", null)
    .order(listOrderColumn(query.sort), {
      ascending: query.direction === "asc",
    })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q)
    request = request.ilike("table_search", `%${escapeLike(query.q)}%`);
  if (brandId) request = request.eq("brand_id", brandId);
  const filters = parseColumnFilters(query.columnFilters, "products");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "products", filters.data);
}
export async function productBrands() {
  const db = await createClient();
  const brands: { id: string; name: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("brands")
      .select("id,name")
      .is("deleted_at", null)
      .order("name")
      .order("id")
      .range(offset, offset + 499);
    if (error) return { data: [], error };
    brands.push(...data);
    if (data.length < 500) return { data: brands, error: null };
  }
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
