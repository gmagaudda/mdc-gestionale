import "server-only";
import {
  parseColumnFilters,
  applyColumnFilters,
} from "@/lib/queries/column-filters";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, type ListQuery } from "@/lib/queries/list";
export async function listBrands(query: ListQuery) {
  const client = await createClient();
  const offset = (query.page - 1) * query.size;
  let request = client
    .from("brands")
    .select("id,name,legal_name", { count: "exact" })
    .is("deleted_at", null)
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range(offset, offset + query.size - 1);
  if (query.q)
    request = request.ilike("table_search", `%${escapeLike(query.q)}%`);
  const filters = parseColumnFilters(query.columnFilters, "brands");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "brands", filters.data);
}
export async function getBrand(id: string) {
  const client = await createClient();
  const [brand, contacts] = await Promise.all([
    client
      .from("brands")
      .select("*,brand_private(*)")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    client
      .from("brand_contacts")
      .select("*")
      .eq("brand_id", id)
      .is("deleted_at", null)
      .order("name"),
  ]);
  return { brand, contacts };
}
