import "server-only";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, type ListQuery } from "@/lib/queries/list";
export async function listBudgets(query: ListQuery) {
  let request = (await createClient())
    .from("budgets")
    .select(
      "id,amount_cents,period_start,period_end,brands!inner(name),seasons(code,name),customers(legal_name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q)
    request = request.ilike("brands.name", `%${escapeLike(query.q)}%`);
  return request;
}
export async function getBudget(id: string) {
  return (await createClient())
    .from("budgets")
    .select(
      "*,brands(name),seasons(code,name),customers(legal_name),budget_private(notes)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
}
