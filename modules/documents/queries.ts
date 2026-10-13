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
export async function listDocuments(query: ListQuery) {
  const db = await createClient();
  let request = db
    .from("documents")
    .select(
      "id,name,kind,shared_with_brand,size_bytes,created_at,brands(name)",
      { count: "exact" },
    )
    .eq("ready", true)
    .is("deleted_at", null)
    .order(listOrderColumn(query.sort), {
      ascending: query.direction === "asc",
    })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q) request = request.ilike("name", `%${escapeLike(query.q)}%`);
  const filters = parseColumnFilters(query.columnFilters, "documents");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "documents", filters.data);
}
export async function getDocument(id: string) {
  return (await createClient())
    .from("documents")
    .select("*,brands(name),customers(legal_name),orders(number)")
    .eq("id", id)
    .eq("ready", true)
    .is("deleted_at", null)
    .maybeSingle();
}
export async function documentBrands() {
  const result = await (
    await createClient()
  )
    .from("brands")
    .select("id,name")
    .is("deleted_at", null)
    .order("name");
  if (result.error) throw Error("Document choices unavailable");
  return result.data;
}
