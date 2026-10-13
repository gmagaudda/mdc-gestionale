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
import { recommendationProvenanceSchema } from "./recommendation-schema";
export async function getBudgetRecommendation(id: string) {
  const result = await (
    await createClient()
  ).rpc("budget_recommendation_provenance", { p_id: id });
  const parsed = recommendationProvenanceSchema.safeParse(result.data);
  return result.error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
export async function listBudgets(query: ListQuery) {
  let request = (await createClient())
    .from("budgets")
    .select(
      "id,amount_cents,period_start,period_end,brands!inner(name),seasons(code,name),customers(legal_name)",
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
  const filters = parseColumnFilters(query.columnFilters, "budgets");
  if (!filters.ok) return { data: [], count: 0, error: null };
  return applyColumnFilters(request, "budgets", filters.data);
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
