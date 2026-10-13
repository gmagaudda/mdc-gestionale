import "server-only";
import {
  parseColumnFilters,
  applyColumnFilters,
} from "@/lib/queries/column-filters";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, type ListQuery } from "@/lib/queries/list";
export async function listSeasons(query: ListQuery) {
  const db = await createClient();
  let request = db
    .from("seasons")
    .select("*,brands(name)", { count: "exact" })
    .is("deleted_at", null)
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q) request = request.ilike("name", `%${escapeLike(query.q)}%`);
  const filters = parseColumnFilters(query.columnFilters, "seasons");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "seasons", filters.data);
}
export async function getSeason(id: string) {
  const db = await createClient();
  return db
    .from("seasons")
    .select("*,brands(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
}
export async function catalogChoices() {
  const db = await createClient();
  const [brands, seasons] = await Promise.all([
    db.from("brands").select("id,name").is("deleted_at", null).order("name"),
    db
      .from("seasons")
      .select("id,brand_id,name,code")
      .is("deleted_at", null)
      .order("code"),
  ]);
  if (brands.error || seasons.error) throw Error("Catalog unavailable");
  return { brands: brands.data, seasons: seasons.data };
}
